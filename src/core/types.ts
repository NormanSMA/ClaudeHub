export type Role = 'orchestrator' | 'subagent'

/** Herramienta de origen del registro */
export type Source = 'claude' | 'codex' | 'gemini' | 'omniroute'

/** Estado de lectura de una fuente */
export interface SourceStat {
  enabled: boolean
  files: number
  records: number
  ok: boolean
  reason?: string
  /** lineas con `usage` de un mensaje del asistente que no se pudieron contar. Senal de cambio de formato */
  skipped?: number
  /** version mas alta de la herramienta vista en los registros */
  cliVersion?: string
}

export interface Rec {
  id: string
  ts: number
  model: string
  input: number
  cacheWrite: number
  /** Tokens de escritura de una hora. Subconjunto de cacheWrite. */
  cacheWrite1h?: number
  cacheRead: number
  output: number
  /** tokens de pensamiento. Subconjunto de output: no se suma al total. Solo donde la fuente lo trae */
  reasoning?: number
  session: string
  project: string
  role: Role
  agent?: string
  /** archivo del subagente, para contar subagentes distintos */
  agentFile?: string
  /** origen del registro. Si falta, es claude */
  source?: Source
  /** modo rapido de Claude (`usage.speed`). Si falta, velocidad estandar */
  speed?: 'fast'
}

export const sourceOf = (r: Rec): Source => r.source ?? 'claude'

/** Limite del plan alcanzado: Claude Code lo registra como error 429 con `quotaLimits` */
export interface LimitHit {
  ts: number
  /** cuando se restablece, en milisegundos */
  resetsAt: number
  /** five_hour, seven_day u otro tipo */
  type: string
  status: string
}

export interface SessionMeta {
  title?: string
  lastPrompt?: string
  cwd?: string
  limitHit?: LimitHit
  /** lineas de uso del asistente descartadas por no traer id, modelo, fecha o JSON valido */
  skipped?: number
  /** version de Claude Code que escribio el archivo */
  cliVersion?: string
}

/**
 * Entre dos limites alcanzados gana el rechazado; con el mismo estado, el que reinicia mas tarde.
 * Asi un aviso semanal que no bloquea no tapa un bloqueo real de 5 horas.
 */
export function preferLimitHit(a: LimitHit | null | undefined, b: LimitHit): LimitHit {
  if (!a) return b
  const ra = a.status === 'rejected'
  const rb = b.status === 'rejected'
  if (ra !== rb) return rb ? b : a
  return b.resetsAt >= a.resetsAt ? b : a
}

export type Range = 'all' | '30d' | '7d' | { from: number; to: number }

export const total = (r: Pick<Rec, 'input' | 'cacheWrite' | 'cacheRead' | 'output'>) =>
  r.input + r.cacheWrite + r.cacheRead + r.output

/** Tokens nuevos: todo menos la lectura de cache. */
export const fresh = (r: Pick<Rec, 'input' | 'cacheWrite' | 'output'>) => r.input + r.cacheWrite + r.output

export type LevelId = 1 | 2 | 3 | 4 | 5

export const LEVEL_LABELS = ['Eco', 'Flujo', 'Ritmo Alto', 'Crítico', 'Límite'] as const

/**
 * Nivel de consumo. `basis` indica de donde sale el porcentaje: la ventana de 5 h del plan,
 * la semanal (cuando va mas llena que la de 5 h) o el contexto del chat con mas uso.
 */
export interface TokenLevel {
  level: LevelId
  label: (typeof LEVEL_LABELS)[number]
  pct: number
  basis: 'plan5h' | 'plan7d' | 'context'
  /** tokens por minuto de Claude */
  burnPerMin: number
  /** minutos hasta el limite al ritmo actual. null si no hay datos para proyectar */
  minutesLeft: number | null
  /** true si el limite llega antes del reinicio. null si no hay proyeccion */
  exhaustsBeforeReset: boolean | null
  /** porcentaje de lectura de cache sobre la entrada */
  cacheEfficiency: number
  /** parte de los tokens que gastan los subagentes, de 0 a 1 */
  delegationShare: number
}
