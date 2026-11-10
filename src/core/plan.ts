import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { exchangeReadDirs } from './paths'
import { LEVEL_LABELS, total, type LevelId, type LimitHit, type Rec, type TokenLevel } from './types'
import type { CodexRateLimits, CodexWindow } from './sources/codex'

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
  /** tipo de plan (solo Codex), por ejemplo "plus" o "pro" */
  planType?: string
}

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

type RawPlan = { fiveHour?: RawWindow; sevenDay?: RawWindow; updatedAt?: number }

let memo: { at: number; raw: RawPlan | null } | null = null

// El mod escribe sin renombrado atomico: una lectura puede ver el archivo a medias.
// Se conserva el ultimo contenido valido de cada ruta en vez de perder el dato.
const lastValid = new Map<string, RawPlan>()

function readOne(file: string): RawPlan | null {
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    // sin archivo no hay dato que conservar
    lastValid.delete(file)
    return null
  }
  try {
    const raw = JSON.parse(text)
    if (raw && typeof raw === 'object') {
      lastValid.set(file, raw)
      return raw
    }
  } catch {
    // escritura a medias: vale el ultimo contenido valido
  }
  return lastValid.get(file) ?? null
}

/** Lee rate-limits.json de cada carpeta y devuelve el de mayor updatedAt. */
export function readPlanRaw(dirs: string[]): RawPlan | null {
  let best: RawPlan | null = null
  for (const dir of dirs) {
    const raw = readOne(join(dir, 'rate-limits.json'))
    if (!raw) continue
    const at = typeof raw.updatedAt === 'number' ? raw.updatedAt : 0
    if (!best || at > (typeof best.updatedAt === 'number' ? best.updatedAt : 0)) best = raw
  }
  return best
}

function readRaw(): RawPlan | null {
  if (memo && Date.now() - memo.at < 3_000) return memo.raw
  const override = process.env.CLAUDEHUB_PLAN
  const raw = override ? readOne(override) : readPlanRaw(exchangeReadDirs())
  memo = { at: Date.now(), raw }
  return raw
}

/** Devuelve el estado del plan, o null si nunca se registro o ya expiraron ambas ventanas. */
export function planReport(
  recs: Rec[],
  now = Date.now(),
  raw: RawPlan | null = readRaw(),
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

function codexWindow(w: CodexWindow, minutes: number, recs: Rec[], now: number): PlanWindow | null {
  // ventana con otra duracion: no es la de 5 h ni la semanal
  if (w.windowMinutes !== minutes) return null
  if (!Number.isFinite(w.usedPercent) || !Number.isFinite(w.resetsAt)) return null
  const resetsAt = w.resetsAt * 1000
  // el rollout guarda el dato de cuando se escribio: si ya paso el reinicio, no vale
  if (resetsAt <= now) return null
  const start = resetsAt - minutes * 60_000
  let tokens = 0
  for (const r of recs) if (r.source === 'codex' && r.ts >= start && r.ts <= now) tokens += total(r)
  return { pct: Math.min(100, Math.max(0, w.usedPercent)), resetsAt, tokens }
}

/** Estado del plan de Codex con la misma forma que el de Claude, o null si no hay ventanas vigentes. */
export function codexPlanReport(limits: CodexRateLimits | null, recs: Rec[], now: number): PlanReport | null {
  if (!limits) return null
  const pair = [limits.primary, limits.secondary]
  const w5 = pair.find((w) => w.windowMinutes === 300)
  const w7 = pair.find((w) => w.windowMinutes === 10080)
  const fiveHour = w5 ? codexWindow(w5, 300, recs, now) : null
  const sevenDay = w7 ? codexWindow(w7, 10080, recs, now) : null
  if (!fiveHour && !sevenDay) return null
  return { fiveHour, sevenDay, blocked: null, updatedAt: limits.ts, planType: limits.planType || undefined }
}

/** Nivel de consumo segun el porcentaje usado (0 a 100). */
export function levelOf(pct: number): LevelId {
  if (pct <= 20) return 1
  if (pct <= 50) return 2
  if (pct <= 75) return 3
  if (pct <= 90) return 4
  return 5
}

export interface TokenLevelInput {
  claude: PlanReport | null
  /** mayor uso de contexto entre los chats activos, de 0 a 1. null si no hay chats */
  contextPct: number | null
  burnPerMin: number
  cacheEfficiency: number
  delegationShare: number
  now: number
}

const MIN_PROJECTION_PCT = 5
/** Edad maxima del dato del plan para proyectar: el porcentaje viejo no vale contra tokens de ahora. */
export const MAX_PROJECTION_AGE_MS = 10 * 60_000

/**
 * Nivel de consumo. Base: la ventana del plan mas llena, de 5 h o semanal (un limite alcanzado da nivel 5);
 * sin plan, el chat activo con mas contexto; sin ninguno, null.
 * La proyeccion solo sale con base de 5 h y un dato del plan de menos de 10 minutos.
 */
export function tokenLevel({ claude, contextPct, burnPerMin, cacheEfficiency, delegationShare, now }: TokenLevelInput): TokenLevel | null {
  let pct: number
  let basis: TokenLevel['basis']
  let resetsAt = 0
  const win = claude?.fiveHour ?? null
  const week = claude?.sevenDay ?? null
  if (claude?.blocked) {
    pct = 100
    basis = claude.blocked.type === 'seven_day' ? 'plan7d' : 'plan5h'
    resetsAt = claude.blocked.resetsAt
  } else if (week && (!win || week.pct > win.pct)) {
    pct = week.pct
    basis = 'plan7d'
    resetsAt = week.resetsAt
  } else if (win) {
    pct = win.pct
    basis = 'plan5h'
    resetsAt = win.resetsAt
  } else if (contextPct !== null && Number.isFinite(contextPct)) {
    pct = Math.min(100, Math.max(0, contextPct * 100))
    basis = 'context'
  } else return null

  let minutesLeft: number | null = null
  let exhaustsBeforeReset: boolean | null = null
  const updatedAt = claude?.updatedAt ?? 0
  const fresh = updatedAt > 0 && now - updatedAt <= MAX_PROJECTION_AGE_MS
  if (!claude?.blocked && basis === 'plan5h' && win && fresh && pct >= MIN_PROJECTION_PCT && win.tokens > 0 && burnPerMin > 0) {
    const atLimit = (win.tokens * 100) / pct
    minutesLeft = (atLimit - win.tokens) / burnPerMin
    exhaustsBeforeReset = minutesLeft < (resetsAt - now) / 60_000
  }
  const level = levelOf(pct)
  return { level, label: LEVEL_LABELS[level - 1], pct, basis, burnPerMin, minutesLeft, exhaustsBeforeReset, cacheEfficiency, delegationShare }
}

/** Limites de ambos planes. `plan` de la API sigue siendo el de Claude. */
export function plansReport(
  claude: PlanReport | null,
  codex: PlanReport | null,
): { claude: PlanReport | null; codex: PlanReport | null } {
  return { claude, codex }
}
