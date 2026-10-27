import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

// Formas de scripts/statusline.cjs, copiadas de src/shared/files.d.ts. El mod se instala sin el resto del repo.
type RateWindow = { pct: number; resetsAt: number }
type RateLimitsFile = { fiveHour: RateWindow | null; sevenDay: RateWindow | null; updatedAt: number }
type ContextWindowEntry = { size: number; model: string | undefined; ts: number }
type ContextWindowsFile = Record<string, ContextWindowEntry>
type DataPaths = { rateLimits: string; contextWindows: string }

const ACTIVE_URL = 'http://127.0.0.1:4317/api/active'
const MAX_ENTRIES = 500
const MAX_AGE_MS = 30 * 86_400_000
const REFRESH_MS = 10 * 60_000
const PLAN_REFRESH_MS = 60_000

const fiveHourPct = atom({ plugin: 'claudehub-mod', key: 'pct5h' } as const, null)

// Los nombres de variable deben ser literales: la validacion del mod lee el codigo para listarlos.
async function dataPaths($: EngineInterface): Promise<DataPaths | null> {
  const appData = await $.env.get('APPDATA')
  if (appData) {
    const dir = `${appData}\\ClaudeHub`
    return { rateLimits: `${dir}\\rate-limits.json`, contextWindows: `${dir}\\context-windows.json` }
  }
  const home = await $.env.get('HOME')
  if (!home) return null
  const mac = `${home}/Library/Application Support`
  const dir = (await $.fs.exists(mac)) ? `${mac}/ClaudeHub` : `${home}/.config/ClaudeHub`
  return { rateLimits: `${dir}/rate-limits.json`, contextWindows: `${dir}/context-windows.json` }
}

async function readJson($: EngineInterface, path: string): Promise<unknown> {
  try {
    return JSON.parse(await $.fs.read(path)) || {}
  } catch {
    return {}
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// Un dato ausente o invalido da null: nunca se inventa un porcentaje ni un reinicio.
function toWindow(limit: SessionRateLimit | undefined): RateWindow | null {
  if (!limit || !Number.isFinite(limit.percentUsed) || !limit.resetsAt) return null
  const resetsAt = Date.parse(limit.resetsAt)
  if (!Number.isFinite(resetsAt)) return null
  return { pct: Math.min(100, Math.max(0, limit.percentUsed)), resetsAt }
}

function sameWindow(a: RateWindow | null | undefined, b: RateWindow | null | undefined): boolean {
  return (!a && !b) || (!!a && !!b && a.pct === b.pct && a.resetsAt === b.resetsAt)
}

async function recordPlan($: EngineInterface, limits: SessionRateLimit[], file: string): Promise<void> {
  const now = await $.clock.now()
  const prev = await readJson($, file)
  const old = isRecord(prev) ? (prev as Partial<RateLimitsFile>) : {}
  const next: RateLimitsFile = {
    fiveHour: toWindow(limits.find((l) => l.kind === 'five_hour')),
    sevenDay: toWindow(limits.find((l) => l.kind === 'seven_day')),
    updatedAt: now,
  }
  // una ventana ausente en esta medicion conserva la anterior mientras no haya vencido
  for (const k of ['fiveHour', 'sevenDay'] as const) {
    const before = old[k]
    if (!next[k] && before && before.resetsAt > now) next[k] = before
  }
  if (!next.fiveHour && !next.sevenDay) return
  if (sameWindow(next.fiveHour, old.fiveHour) && sameWindow(next.sevenDay, old.sevenDay) && now - (old.updatedAt || 0) < PLAN_REFRESH_MS) return
  await $.fs.write(file, JSON.stringify(next))
}

async function recordContext($: EngineInterface, size: number, file: string): Promise<void> {
  const sessionId = await $.session.id()
  if (!sessionId || !Number.isFinite(size) || size <= 0) return
  const now = await $.clock.now()
  const raw = await readJson($, file)
  const data = (isRecord(raw) ? raw : {}) as ContextWindowsFile
  const prev = data[sessionId]
  if (prev && prev.size === size && now - prev.ts < REFRESH_MS) return
  data[sessionId] = { size, model: (await $.session.model()) || undefined, ts: now }
  const entries = Object.entries(data)
    .filter(([, v]) => v && now - v.ts < MAX_AGE_MS)
    .sort((a, b) => b[1].ts - a[1].ts)
    .slice(0, MAX_ENTRIES)
  await $.fs.write(file, JSON.stringify(Object.fromEntries(entries)))
}

function compact(n: number): string {
  return n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(Math.round(n))
}

function chubLine(data: unknown): string | null {
  if (!isRecord(data)) return null
  const { todayFresh, todayCacheRead, todayCostUsd } = data
  if (typeof todayFresh !== 'number' || typeof todayCacheRead !== 'number') return null
  const cost = typeof todayCostUsd === 'number' ? `$${todayCostUsd.toFixed(2)}` : 'sin precio'
  return `ClaudeHub hoy: nuevos ${compact(todayFresh)} | cache ${compact(todayCacheRead)} | costo ${cost}`
}

async function chubText($: EngineInterface): Promise<string> {
  const down = 'ClaudeHub no responde en 127.0.0.1:4317. Abre ClaudeHub (pnpm start o la bandeja) y repite /chub.'
  const unknown = 'ClaudeHub respondio con un formato que /chub no reconoce.'
  let text: string
  try {
    const res = await $.http.fetch(ACTIVE_URL)
    if (!res.ok) return down
    text = res.text
  } catch {
    return down
  }
  try {
    return chubLine(JSON.parse(text)) ?? unknown
  } catch {
    return unknown
  }
}

export const register: Register = (on, options) => {
  on('session.measure', async ($, e, next) => {
    try {
      const paths = await dataPaths($)
      if (paths && e.changed.includes('rateLimits')) await recordPlan($, e.rateLimits, paths.rateLimits)
      if (paths && e.changed.includes('context')) await recordContext($, e.context.window, paths.contextWindows)
      const five = toWindow(e.rateLimits.find((l) => l.kind === 'five_hour'))
      if (five) await update($, fiveHourPct, () => five.pct)
    } catch {
      // medir nunca debe fallar la sesion por no poder guardar
    }
    return next(e)
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'chub', description: 'Muestra tokens nuevos, cache y costo de hoy desde ClaudeHub.' })
    return next(e)
  })

  on('command.run', { command: 'chub' }, async ($) => ({ text: await chubText($) }))

  if (options.showBand !== true) return
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const pct = await read($, fiveHourPct)
    if (e.props.hasSurvey || pct === null) return next(e)
    const { Text } = $.ui.resolve(e)
    return Text({ dimColor: true, children: `Plan 5 h: ${Math.round(pct)}%` })
  })
}
