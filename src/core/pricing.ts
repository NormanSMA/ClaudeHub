import { modelName } from './models'
import type { Rec } from './types'

/** Tarifas en USD por un millon de tokens. */
export interface Price {
  input: number
  output: number
  cacheWrite: number
  cacheWrite1h: number
  cacheRead: number
}

export interface PriceRule {
  match: RegExp
  price: Price
  tierAbove?: { tokens: number; price: Price }
  /** Fin exclusivo de la tarifa temporal, en milisegundos. */
  until?: number
}

const price = (input: number, output: number, cacheWrite: number, cacheWrite1h: number, cacheRead: number): Price =>
  ({ input, output, cacheWrite, cacheWrite1h, cacheRead })

const RULES: PriceRule[] = [
  // Tabla de Claude: 2026-10-06. Fuente: https://platform.claude.com/docs/en/about-claude/pricing
  { match: /^claude-fable-5-1$/, price: price(10, 50, 12.5, 20, 0.25) },
  { match: /^claude-fable-5$/, price: price(10, 50, 12.5, 20, 1) },
  { match: /^claude-opus-5-5$/, price: price(4, 20, 5, 8, 0.2) },
  { match: /^claude-opus-(?:5|4-[678])$/, price: price(5, 25, 6.25, 10, 0.5) },
  // Opus 4.5: tarifa de lanzamiento.
  { match: /^claude-opus-4-5$/, price: price(5, 25, 6.25, 10, 0.5) },
  // Opus 4.1 y 4: tarifa de lanzamiento.
  { match: /^claude-opus-4(?:-1)?$/, price: price(15, 75, 18.75, 30, 1.5) },
  { match: /^claude-sonnet-5(?:-5)?$/, price: price(2, 10, 2.5, 4, 0.2) },
  { match: /^claude-sonnet-4-6$/, price: price(3, 15, 3.75, 6, 0.3) },
  // Sonnet 4.5 y 4: tarifa de lanzamiento.
  { match: /^claude-sonnet-4(?:-5)?$/, price: price(3, 15, 3.75, 6, 0.3) },
  {
    match: /^claude-haiku-5-5$/,
    price: price(0.1, 0.5, 0.125, 0.2, 0.01),
    tierAbove: { tokens: 100_000, price: price(0.5, 2.5, 0.625, 1, 0.05) },
  },
  { match: /^claude-haiku-4-5$/, price: price(1, 5, 1.25, 2, 0.1) },
  // Tabla de OpenAI: 2026-10-22. Fuente: https://openai.com/index/introducing-gpt-6-1-sol/
  {
    match: /^gpt-6\.1-sol$/,
    price: price(2, 10, 2, 2, 0.1),
    tierAbove: { tokens: 272_000, price: price(4, 15, 4, 4, 0.2) },
  },
  // Tabla de Gemini: 2026-10-22. Fuente: https://ai.google.dev/gemini-api/docs/pricing
  { match: /^gemini-3-flash-preview$/, price: price(0.5, 3, 0.5, 0.5, 0.05) },
  // Tabla de Gemini: 2026-10-22. Fuente: https://cloud.google.com/vertex-ai/generative-ai/pricing
  {
    match: /^gemini-3\.8-flash$/,
    price: price(0.75, 3.75, 0.75, 0.75, 0.075),
    until: Date.UTC(2027, 0, 1),
  },
  { match: /^gemini-3\.8-flash$/, price: price(1.5, 7.5, 1.5, 1.5, 0.15) },
  // codex-auto-review: sin tarifa publicada en la tabla de 2026-10-22.
]

/** Resuelve el id, el volumen del prompt, la fecha y los ajustes por nombre visible. */
export function priceOf(
  model: string,
  overrides?: Record<string, Partial<Price>>,
  promptTokens = 0,
  ts = Date.now(),
): Price | null {
  const id = model.toLowerCase().replace(/-\d{8}$/, '').replace(/^claude-(\d+)-(\d+)-([a-z]+)$/, 'claude-$3-$1-$2')
  const rule = RULES.find((r) => r.match.test(id) && (r.until === undefined || ts < r.until))
  const base = rule ? (rule.tierAbove && promptTokens > rule.tierAbove.tokens ? rule.tierAbove.price : rule.price) : null
  const name = modelName(model)
  if (!overrides || !Object.hasOwn(overrides, name)) return base ? { ...base } : null
  return { ...(base ?? price(0, 0, 0, 0, 0)), ...overrides[name] }
}

/** Calcula el costo del registro sin volver a cobrar la escritura de una hora. */
export function costOf(r: Rec, overrides?: Record<string, Partial<Price>>): number | null {
  const p = priceOf(r.model, overrides, r.input + r.cacheWrite + r.cacheRead, r.ts)
  if (!p) return null
  // acotado: un registro incoherente no puede cobrar mas escritura de 1 h que escritura total
  const cacheWrite1h = Math.min(r.cacheWrite1h ?? 0, r.cacheWrite)
  const cacheWrite5m = Math.max(0, r.cacheWrite - cacheWrite1h)
  return (
    r.input * p.input +
    r.output * p.output +
    cacheWrite5m * p.cacheWrite +
    cacheWrite1h * p.cacheWrite1h +
    r.cacheRead * p.cacheRead
  ) / 1_000_000
}
