import type { Rec } from '../types'

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

const WANTED = ['"type":"gemini"', '"sessionId"'] as const

/** Parsea solo las lineas relevantes. Descarta el resto sin hacer JSON.parse. */
function* relevantLines(text: string): Generator<any> {
  for (const line of text.split('\n')) {
    if (!WANTED.some((n) => line.includes(n))) continue
    try {
      yield JSON.parse(line)
    } catch {
      /* linea corrupta o a medio escribir */
    }
  }
}

/**
 * Convierte un chat de Gemini CLI en registros. Un registro por id de mensaje `gemini`
 * (el mismo mensaje se repite en el archivo). `cached` es parte de `input`, y
 * `thoughts` y `tool` se cuentan como salida para que `total(rec)` iguale `tokens.total`.
 * No copia texto de mensajes ni pensamientos.
 */
export function parseGemini(text: string, project: string): Rec[] {
  const recs: Rec[] = []
  const seen = new Set<string>()
  let session = 'unknown'
  for (const o of relevantLines(text)) {
    if (!o || typeof o !== 'object') continue
    if (o.type !== 'gemini') {
      if (typeof o.sessionId === 'string' && o.sessionId) session = o.sessionId
      continue
    }
    const t = o.tokens
    if (typeof o.id !== 'string' || !o.id || seen.has(o.id)) continue
    if (!t || typeof t !== 'object') continue
    const ts = Date.parse(o.timestamp)
    if (Number.isNaN(ts)) continue
    seen.add(o.id)
    const cached = num(t.cached)
    recs.push({
      id: `gemini:${o.id}`,
      ts,
      model: typeof o.model === 'string' && o.model ? o.model : 'gemini',
      input: Math.max(0, num(t.input) - cached),
      cacheRead: cached,
      cacheWrite: 0,
      output: num(t.output) + num(t.thoughts) + num(t.tool),
      session,
      project,
      role: 'orchestrator',
      source: 'gemini',
    })
  }
  return recs
}
