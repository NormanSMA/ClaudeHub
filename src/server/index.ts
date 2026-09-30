import { readFileSync, existsSync } from 'node:fs'
import { join, extname, resolve, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { scan } from '../core/scan'
import { demoData } from '../core/demo'
import { config } from '../core/config'
import { summary, modelsReport, rolesReport, sessionsReport, projectsReport, live, activeReport } from '../core/aggregate'
import type { Range } from '../core/types'
import type { ScanResult } from '../core/scan'

const DEMO = process.env.CLAUDEHUB_DEMO === '1'
const PORT = Number(process.env.PORT ?? (DEMO ? 4318 : 4317))
const HOST = '127.0.0.1'
const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '../../dist')

let cached: { at: number; data: ScanResult } | null = null
function data(): ScanResult {
  if (!cached || Date.now() - cached.at > 4_000) cached = { at: Date.now(), data: DEMO ? demoData() : scan() }
  return cached.data
}
const records = () => data().recs

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
app.get('/api/summary', (c) => c.json(summary(records(), rangeOf((k) => c.req.query(k)))))
app.get('/api/models', (c) => c.json(modelsReport(records(), rangeOf((k) => c.req.query(k)))))
app.get('/api/roles', (c) => c.json(rolesReport(records(), rangeOf((k) => c.req.query(k)))))
app.get('/api/sessions', (c) => c.json(sessionsReport(records(), data().sessions, rangeOf((k) => c.req.query(k)))))
app.get('/api/projects', (c) => c.json(projectsReport(records(), rangeOf((k) => c.req.query(k)))))
app.get('/api/config', (c) => c.json({ name: DEMO ? '' : config().name, demo: DEMO }))
app.get('/api/live', (c) => c.json(once('live', () => live(records()))))
app.get('/api/active', (c) =>
  c.json(
    once('active', () => ({
      alertAt: config().alertAt,
      todayTokens: live(records()).todayTokens,
      chats: activeReport(records(), data().sessions),
    })),
  ),
)

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

serve({ fetch: app.fetch, hostname: HOST, port: PORT }, () => {
  console.log(`ClaudeHub${DEMO ? ' (demo, datos ficticios)' : ''} en http://${HOST}:${PORT}`)
})
