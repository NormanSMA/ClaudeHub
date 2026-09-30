import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dataDir } from './paths'
import { total, type LimitHit, type Rec } from './types'

/**
 * Limites de uso del plan (ventana de 5 horas y semanal), registrados por scripts/statusline.cjs.
 * Claude Code los envia en `rate_limits` solo a suscriptores Pro y Max, despues de la primera respuesta.
 */
export interface PlanWindow {
  /** porcentaje usado, de 0 a 100 */
  pct: number
  /** instante en que la ventana se restablece, en milisegundos */
  resetsAt: number
  /** tokens de Claude Code de este equipo dentro de la ventana */
  tokens: number
}

export interface PlanReport {
  fiveHour: PlanWindow | null
  sevenDay: PlanWindow | null
  /** limite alcanzado ahora mismo (error 429 registrado por Claude Code); no requiere la linea de estado */
  blocked: { type: string; resetsAt: number } | null
  /** cuando se registro el dato por ultima vez, en milisegundos */
  updatedAt: number
}

const FILE = () => process.env.CLAUDEHUB_PLAN ?? join(dataDir(), 'rate-limits.json')

const FIVE_HOURS = 5 * 3_600_000
const SEVEN_DAYS = 7 * 86_400_000

interface RawWindow {
  pct?: unknown
  resetsAt?: unknown
}

function windowOf(raw: RawWindow | null | undefined, span: number, recs: Rec[], now: number): PlanWindow | null {
  if (!raw || typeof raw.pct !== 'number' || typeof raw.resetsAt !== 'number') return null
  if (!Number.isFinite(raw.pct) || !Number.isFinite(raw.resetsAt)) return null
  // Claude Code descarta una ventana cuando pasa su hora de reinicio: el dato guardado ya no vale
  if (raw.resetsAt <= now) return null
  const start = raw.resetsAt - span
  let tokens = 0
  for (const r of recs) if (r.ts >= start && r.ts <= now) tokens += total(r)
  return { pct: Math.min(100, Math.max(0, raw.pct)), resetsAt: raw.resetsAt, tokens }
}

let memo: { at: number; raw: { fiveHour?: RawWindow; sevenDay?: RawWindow; updatedAt?: number } | null } | null = null

function readRaw() {
  if (memo && Date.now() - memo.at < 3_000) return memo.raw
  let raw = null
  try {
    raw = JSON.parse(readFileSync(FILE(), 'utf8'))
  } catch {
    raw = null
  }
  memo = { at: Date.now(), raw }
  return raw
}

/** Devuelve el estado del plan, o null si nunca se registro o ya expiraron ambas ventanas. */
export function planReport(
  recs: Rec[],
  now = Date.now(),
  raw: { fiveHour?: RawWindow; sevenDay?: RawWindow; updatedAt?: number } | null = readRaw(),
  limitHit: LimitHit | null = null,
): PlanReport | null {
  const valid = raw && typeof raw === 'object' ? raw : {}
  const fiveHour = windowOf(valid.fiveHour, FIVE_HOURS, recs, now)
  const sevenDay = windowOf(valid.sevenDay, SEVEN_DAYS, recs, now)
  const blocked =
    limitHit && limitHit.status === 'rejected' && limitHit.resetsAt > now ? { type: limitHit.type, resetsAt: limitHit.resetsAt } : null
  if (!fiveHour && !sevenDay && !blocked) return null
  return { fiveHour, sevenDay, blocked, updatedAt: typeof valid.updatedAt === 'number' ? valid.updatedAt : 0 }
}
