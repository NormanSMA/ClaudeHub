import { readFileSync, existsSync } from 'node:fs'
import { join, extname, resolve, dirname, sep, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { scan, PROJECTS_DIR } from '../core/scan'
import { demoData, demoPlanRaw, demoEvents, demoCodexLimits, demoUpdate } from '../core/demo'
import { getUpdate, manualCheck, startUpdateChecks, type ManualCheck } from '../core/update'
import { planReport } from '../core/plan'
import { activeExtras } from '../core/overview'
import { readEvents } from '../core/agents'
import { latestCodexLimits } from '../core/sources/codex-limits'
import { config, configPath, saveConfig, useDefaultsOnly } from '../core/config'
import { dataDir, codexSessionsDir, geminiTmpDir } from '../core/paths'
import { createEventHub, createWatcher } from './watch'
import { modelName } from '../core/models'
import { demoOmniroute } from '../core/demo-omniroute'
import { attachVia } from '../core/omniroute-via'
import { readOmniroute, type OmnirouteResult } from '../core/sources/omniroute'
import {
  summary,
  modelsReport,
  rolesReport,
  sessionsReport,
  projectsReport,
  live,
  activeReport,
  filterSource,
  parseSource,
} from '../core/aggregate'
import type { Range, SourceStat } from '../core/types'
import type { ScanResult } from '../core/scan'

const DEMO = process.env.CLAUDEHUB_DEMO === '1'
if (DEMO) useDefaultsOnly() // el demo nunca lee ni muestra tu configuracion
const PORT = Number(process.env.PORT ?? (DEMO ? 4318 : 4317))
const HOST = '127.0.0.1'
// Carpeta de la interfaz compilada. En el paquete de Electron la fija CLAUDEHUB_DIST;
// con el servidor empaquetado (dist-server/server.cjs) esta al lado; desde el codigo fuente, dos niveles arriba.
const DIST = resolve(
  process.env.CLAUDEHUB_DIST ??
    (typeof __dirname !== 'undefined' ? join(__dirname, '..', 'dist') : join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist')),
)

// OmniRoute se lee en segundo plano (docker cp o SQLite) y nunca bloquea data().
const OMNI_EVERY_MS = 60_000
let omni: OmnirouteResult | null = null
let omniAt = 0
let omniBusy = false

function refreshOmniroute(): void {
  if (DEMO || omniBusy || !config().sources.omniroute) return
  if (Date.now() - omniAt < OMNI_EVERY_MS) return
  omniBusy = true
  omniAt = Date.now()
  const { container, dbPath } = config().omniroute
  readOmniroute({ container, dbPath, workDir: dataDir() })
    .then((r) => {
      omni = r
      cached = null // datos nuevos: el siguiente data() reconstruye y invalida los reportes
    })
    .catch(() => {
      /* readOmniroute no lanza; por seguridad se conserva el ultimo resultado */
    })
    .finally(() => {
      omniBusy = false
    })
}

function withOmniroute(base: ScanResult): ScanResult {
  if (DEMO || !config().sources.omniroute) return base
  const extra = omni?.recs ?? []
  const ids = new Set(base.recs.map((r) => r.id))
  const recs = [...base.recs, ...extra.filter((r) => !ids.has(r.id))]
  const status = omni?.status
  const stat: SourceStat & { stale?: boolean } = {
    enabled: true,
    files: 1,
    records: extra.length,
    ok: status?.ok ?? false,
    ...(status ? (status.reason ? { reason: status.reason } : {}) : { reason: 'leyendo' }),
    ...(status?.stale ? { stale: true } : {}),
  }
  return { ...base, recs, sources: { ...base.sources, omniroute: stat } }
}

// El vigilante entrega las rutas que cambiaron y scan solo revisa esas.
// Un escaneo completo cada 60 s cubre avisos perdidos; sin vigilancia completa, todos son completos.
const FULL_SCAN_EVERY_MS = 60_000
const changedPaths = new Set<string>()
let lastFullScan = 0
let allWatched = (): boolean => false

function scanNow(): ScanResult {
  const full = !allWatched() || Date.now() - lastFullScan >= FULL_SCAN_EVERY_MS
  const changed = full ? undefined : [...changedPaths]
  changedPaths.clear()
  if (full) lastFullScan = Date.now()
  return scan(PROJECTS_DIR, true, { changed })
}

let cached: { at: number; data: ScanResult } | null = null
function data(): ScanResult {
  refreshOmniroute()
  if (!cached || Date.now() - cached.at > 4_000) {
    cached = { at: Date.now(), data: DEMO ? demoData() : withOmniroute(scanNow()) }
  }
  return cached.data
}
const records = () => data().recs
/** Solo registros de Claude: el plan, los chats activos y los roles no deben mezclarse con otras fuentes. */
const claudeRecords = () => filterSource(records(), 'claude')
const sourceOfQuery = (c: { req: { query: (k: string) => string | undefined } }) => parseSource(c.req.query('source'))

// Los reportes que varias pantallas piden a la vez se calculan una vez por ciclo de escaneo.
const reports = new Map<string, { at: number; value: unknown }>()
function once<T>(key: string, build: () => T): T {
  data()
  const at = cached!.at
  const hit = reports.get(key)
  if (hit && hit.at === at) return hit.value as T
  const value = build()
  reports.set(key, { at, value })
  return value
}

function dayStart(v: string | undefined, end = false): number | null {
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0)
  return d.getTime()
}

/** Acepta ?range=all|30d|7d o ?from=YYYY-MM-DD&to=YYYY-MM-DD (dias locales, ambos incluidos). */
function rangeOf(q: (k: string) => string | undefined): Range {
  const from = dayStart(q('from'))
  const to = dayStart(q('to'), true)
  if (from !== null || to !== null) return { from: from ?? 0, to: to ?? Date.now() }
  const v = q('range')
  return v === '7d' || v === '30d' ? v : 'all'
}

const app = new Hono()

// Anti DNS rebinding: solo se atiende a quien pregunta por 127.0.0.1 o localhost.
const HOST_OK = /^(127\.0\.0\.1|localhost)(:\d+)?$/
app.use('*', async (c, next) => {
  if (!HOST_OK.test(c.req.header('host') ?? '')) return c.text('forbidden', 403)
  await next()
})
app.get('/api/summary', (c) => c.json(summary(filterSource(records(), sourceOfQuery(c)), rangeOf((k) => c.req.query(k)))))
app.get('/api/models', (c) => {
  const source = sourceOfQuery(c)
  const range = rangeOf((k) => c.req.query(k))
  const report = modelsReport(filterSource(records(), source), range)
  // la etiqueta de OmniRoute solo tiene sentido si la tabla incluye esa fuente
  if (source !== 'all' && source !== 'omniroute') return c.json(report)
  return c.json(attachVia(report, { calls: DEMO ? demoOmniroute() : (omni?.calls ?? []), range }))
})
app.get('/api/roles', (c) => c.json(rolesReport(claudeRecords(), rangeOf((k) => c.req.query(k)))))
app.get('/api/sessions', (c) =>
  c.json(sessionsReport(filterSource(records(), sourceOfQuery(c)), data().sessions, rangeOf((k) => c.req.query(k)))),
)
app.get('/api/projects', (c) => c.json(projectsReport(filterSource(records(), sourceOfQuery(c)), rangeOf((k) => c.req.query(k)))))
app.get('/api/sources', (c) => c.json(data().sources))
app.get('/api/config', (c) => c.json({
  name: DEMO ? '' : config().name,
  demo: DEMO,
  billing: DEMO ? 'subscription' : config().billing,
  mascot: DEMO ? { talk: true, talkCooldownMin: 10 } : config().mascot,
}))

// Ajustes: lectura y escritura de config.json desde el dashboard.
app.get('/api/settings', (c) =>
  c.json({
    config: config(),
    path: DEMO ? '(modo demo: no se guarda)' : configPath(),
    demo: DEMO,
    models: [...new Set(records().map((r) => modelName(r.model)))].sort((a, b) => a.localeCompare(b, 'es')),
  }),
)
/** Defensa contra CSRF: sin cabecera Origin (curl) o con un origen propio. */
function originOk(origin: string | undefined): boolean {
  if (!origin) return true
  try {
    return HOST_OK.test(new URL(origin).host)
  } catch {
    return false // origen invalido
  }
}

app.put('/api/settings', async (c) => {
  if (DEMO) return c.json({ error: 'El modo demo no guarda cambios.' }, 403)
  // origen propio, JSON obligatorio (obliga a un preflight que no se concede) y cuerpo pequeno
  if (!originOk(c.req.header('origin'))) return c.json({ error: 'Origen no permitido.' }, 403)
  if (!(c.req.header('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return c.json({ error: 'Se requiere application/json.' }, 415)
  }
  if (Number(c.req.header('content-length') ?? 0) > 20_000) return c.json({ error: 'Cuerpo demasiado grande.' }, 413)
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'JSON invalido.' }, 400)
  }
  const saved = saveConfig(body)
  reports.clear()
  return c.json({ config: saved })
})
app.get('/api/update', (c) => c.json(DEMO ? demoUpdate() : getUpdate()))
// Boton "Buscar actualizacion". POST sin cuerpo: un formulario ajeno no puede leer la respuesta.
app.post('/api/update/check', async (c) => {
  if (!originOk(c.req.header('origin'))) return c.json({ error: 'Origen no permitido.' }, 403)
  if (DEMO) return c.json({ result: 'checked', info: demoUpdate() } satisfies ManualCheck)
  const out = await manualCheck()
  return c.json(out, out.result === 'throttled' ? 429 : 200)
})
app.get('/api/live', (c) => c.json(once('live', () => live(records()))))
app.get('/api/active', (c) =>
  c.json(
    once('active', () => {
      const claude = claudeRecords()
      const now = Date.now()
      const plan = planReport(claude, now, DEMO ? demoPlanRaw(now) : undefined, data().limitHit)
      const codexLimits = DEMO ? demoCodexLimits(now) : config().sources.codex ? latestCodexLimits() : null
      const chats = activeReport(claude, data().sessions, now, undefined, DEMO ? {} : undefined)
      const { todayTokens, todayFresh, todayCacheRead, todayCostUsd } = live(claude, now)
      return {
        alertAt: config().alertAt,
        todayTokens,
        todayFresh,
        todayCacheRead,
        todayCostUsd,
        chats,
        plan,
        ...activeExtras({
          claudePlan: plan,
          contextPct: chats.length ? Math.max(...chats.map((c) => c.context.pct)) : null,
          recs: records(),
          codexLimits,
          events: DEMO ? demoEvents(now) : readEvents(),
          now,
        }),
      }
    }),
  ),
)

// Avisos en vivo (SSE). Sin datos de uso: solo "hello", "changed" y latidos.
const hub = createEventHub({ max: 8 })
app.get('/api/events', (c) => {
  const enc = new TextEncoder()
  let ctrl!: ReadableStreamDefaultController<Uint8Array>
  let unsubscribe: (() => void) | null = null
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      ctrl = controller // start corre de forma sincrona en el constructor
    },
    cancel() {
      unsubscribe?.()
    },
  })
  unsubscribe = hub.subscribe((chunk) => ctrl.enqueue(enc.encode(chunk)))
  if (!unsubscribe) {
    void stream.cancel()
    return c.json({ error: 'Demasiados clientes conectados.' }, 429)
  }
  ctrl.enqueue(enc.encode('event: hello\ndata: {}\n\n'))
  c.req.raw.signal.addEventListener('abort', () => {
    unsubscribe?.()
    try {
      ctrl.close()
    } catch {
      /* el flujo ya estaba cerrado */
    }
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
})

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

app.get('*', (c) => {
  const rel = c.req.path === '/' ? 'index.html' : c.req.path.slice(1)
  let file = resolve(DIST, rel)
  if (!(file === DIST || file.startsWith(DIST + sep)) || !existsSync(file)) file = join(DIST, 'index.html')
  if (!existsSync(file)) return c.text('Falta el build. Ejecuta: pnpm build', 404)
  return c.body(readFileSync(file), 200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' })
})

// Vigilancia de carpetas: avisa a los clientes SSE cuando cambian los datos.
// Se ignoran los archivos que escribe el propio servidor para no crear un ciclo.
if (!DEMO) {
  const omniDir = resolve(dataDir(), 'omniroute')
  const ignore = (file: string): boolean => {
    const full = resolve(file)
    return basename(full) === 'cache.json' || basename(full) === 'update.json' || full.endsWith('.tmp') || full === omniDir || full.startsWith(omniDir + sep)
  }
  const watchDirs = [PROJECTS_DIR, codexSessionsDir(), geminiTmpDir(), dataDir()]
  const watcher = createWatcher(
    watchDirs,
    (files) => {
      for (const f of files) changedPaths.add(f)
      cached = null
      reports.clear()
      hub.broadcast('changed')
    },
    { ignore },
  )
  allWatched = () => watcher.watching().length === watchDirs.length
  process.on('exit', () => {
    watcher.close()
    hub.close()
  })
  startUpdateChecks()
}

serve({ fetch: app.fetch, hostname: HOST, port: PORT }, () => {
  console.log(`ClaudeHub${DEMO ? ' (demo, datos ficticios)' : ''} en http://${HOST}:${PORT}`)
})
