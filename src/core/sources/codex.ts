import type { Rec } from '../types'

/** Una ventana de limite del plan de Codex. `resetsAt` queda tal cual el rollout (segundos epoch). */
export interface CodexWindow {
  usedPercent: number
  windowMinutes: number
  resetsAt: number
}

export interface CodexRateLimits {
  ts: number
  planType: string
  primary: CodexWindow
  secondary: CodexWindow
}

interface Usage {
  input: number
  cached: number
  cacheWrite: number
  output: number
  total: number
}

const ZERO: Usage = { input: 0, cached: 0, cacheWrite: 0, output: 0, total: 0 }

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

function readUsage(u: any): Usage | null {
  if (!u || typeof u !== 'object' || typeof u.total_tokens !== 'number') return null
  return {
    input: num(u.input_tokens),
    cached: num(u.cached_input_tokens),
    cacheWrite: num(u.cache_write_input_tokens),
    output: num(u.output_tokens),
    total: u.total_tokens,
  }
}

function projectFromCwd(cwd: unknown): string {
  if (typeof cwd !== 'string') return 'unknown'
  const parts = cwd.split(/[\\/]+/).filter(Boolean)
  return parts[parts.length - 1] ?? 'unknown'
}

/** Parsea solo las lineas relevantes. Descarta el resto sin hacer JSON.parse. */
function* relevantLines(text: string, needles: readonly string[]): Generator<any> {
  for (const line of text.split('\n')) {
    if (!needles.some((n) => line.includes(n))) continue
    try {
      yield JSON.parse(line)
    } catch {
      /* linea corrupta o a medio escribir */
    }
  }
}

const WANTED = ['session_meta', 'turn_context', 'token_count'] as const

/**
 * Convierte un rollout de Codex en registros. Un registro por cada subida del acumulado
 * `total_token_usage.total_tokens`, con el incremento por campo. No copia texto de mensajes.
 */
export function parseCodex(text: string): Rec[] {
  const recs: Rec[] = []
  const last = new Map<string, Usage>()
  let session = 'unknown'
  let project = 'unknown'
  let model = 'codex'
  for (const o of relevantLines(text, WANTED)) {
    const p = o?.payload
    if (o?.type === 'session_meta') {
      if (typeof p?.id === 'string') session = p.id
      if (typeof p?.cwd === 'string') project = projectFromCwd(p.cwd)
      continue
    }
    if (o?.type === 'turn_context') {
      if (typeof p?.model === 'string' && p.model) model = p.model
      continue
    }
    if (o?.type !== 'event_msg' || p?.type !== 'token_count') continue
    const cur = readUsage(p.info?.total_token_usage)
    const ts = Date.parse(o.timestamp)
    if (!cur || Number.isNaN(ts)) continue
    const prev = last.get(session) ?? ZERO
    if (cur.total <= prev.total) continue
    last.set(session, cur)
    const dInput = Math.max(0, cur.input - cur.cached - (prev.input - prev.cached))
    const dCache = Math.max(0, cur.cached - prev.cached)
    const dWrite = Math.max(0, cur.cacheWrite - prev.cacheWrite)
    const dOutput = Math.max(0, cur.output - prev.output)
    // Sesiones antiguas traen los campos por tipo en 0 y solo `total_tokens` con gasto.
    // El resto del incremento se cuenta como entrada para que el total cuadre.
    const residual = Math.max(0, cur.total - prev.total - (dInput + dCache + dWrite + dOutput))
    recs.push({
      id: `codex:${session}:${cur.total}`,
      ts,
      model,
      input: dInput + residual,
      cacheRead: dCache,
      cacheWrite: dWrite,
      output: dOutput,
      session,
      project,
      role: 'orchestrator',
      source: 'codex',
    })
  }
  return recs
}

function readWindow(w: any): CodexWindow | null {
  if (!w || typeof w !== 'object') return null
  if (typeof w.used_percent !== 'number' || typeof w.window_minutes !== 'number' || typeof w.resets_at !== 'number') return null
  return { usedPercent: w.used_percent, windowMinutes: w.window_minutes, resetsAt: w.resets_at }
}

/** Ultimo `rate_limits` valido (con ventana de 5 h y semanal) del rollout, o null. */
export function codexRateLimits(text: string): CodexRateLimits | null {
  let found: CodexRateLimits | null = null
  for (const o of relevantLines(text, ['token_count'])) {
    if (o?.type !== 'event_msg' || o?.payload?.type !== 'token_count') continue
    const r = o.payload.rate_limits
    const primary = readWindow(r?.primary)
    const secondary = readWindow(r?.secondary)
    const ts = Date.parse(o.timestamp)
    if (!primary || !secondary || Number.isNaN(ts)) continue
    found = { ts, planType: typeof r.plan_type === 'string' ? r.plan_type : '', primary, secondary }
  }
  return found
}
