import type { Rec } from '../types'

const ID_PREFIX = 'loom:'
const MAX_LINE_BYTES = 16_384

const nonNeg = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)

function parseTs(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v
  if (typeof v === 'string' && v) {
    const parsed = Date.parse(v)
    if (!Number.isNaN(parsed) && parsed > 0) return parsed
  }
  return null
}

/** Ids de Loom ya registrados en este archivo para evitar duplicados al reanudar lectura. */
export const seenLoomIds = (recs: readonly Rec[]): Set<string> => new Set(recs.map((r) => r.id))

/**
 * Parsea lineas JSONL emitidas por Loom hacia `~/.claudehub/loom-runs.jsonl`.
 * Solo extrae metricas numericas y metadatos de sesion/rol; descarta registros sin tokens o lineas gigantes.
 */
export function parseLoomChunk(text: string, seen: Set<string>): Rec[] {
  const recs: Rec[] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || Buffer.byteLength(line, 'utf8') > MAX_LINE_BYTES) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      continue
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
    const o = parsed as Record<string, unknown>
    if (typeof o.id !== 'string' || !o.id) continue
    const id = o.id.startsWith(ID_PREFIX) ? o.id : ID_PREFIX + o.id
    if (seen.has(id)) continue

    const ts = parseTs(o.ts)
    if (ts === null) continue
    if (typeof o.model !== 'string' || !o.model) continue

    const input = nonNeg(o.input)
    const rawOutput = nonNeg(o.output)
    const reasoning = nonNeg(o.reasoning)
    const output = rawOutput > 0 ? rawOutput : reasoning
    const cacheRead = nonNeg(o.cacheRead ?? o.cache_read)
    const cacheWrite = nonNeg(o.cacheWrite ?? o.cache_write)
    if (input + output + cacheRead + cacheWrite <= 0) continue

    const role: Rec['role'] = o.role === 'subagent' ? 'subagent' : 'orchestrator'
    const session = typeof o.session === 'string' && o.session ? o.session : id
    const project = typeof o.project === 'string' && o.project ? o.project : 'loom'
    const agent = role === 'subagent'
      ? (typeof o.agent === 'string' && o.agent
        ? o.agent
        : typeof o.provider === 'string' && o.provider
          ? o.provider
          : 'loom')
      : undefined

    seen.add(id)
    recs.push({
      id,
      ts,
      model: o.model,
      input,
      cacheRead,
      cacheWrite,
      output,
      ...(reasoning > 0 ? { reasoning } : {}),
      session,
      project,
      role,
      ...(agent ? { agent, agentFile: session } : {}),
      source: 'loom',
    })
  }
  return recs
}
