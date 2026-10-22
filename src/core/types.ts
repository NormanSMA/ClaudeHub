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
}

export type Range = 'all' | '30d' | '7d' | { from: number; to: number }

export const total = (r: Pick<Rec, 'input' | 'cacheWrite' | 'cacheRead' | 'output'>) =>
  r.input + r.cacheWrite + r.cacheRead + r.output

/** Tokens nuevos: todo menos la lectura de cache. */
export const fresh = (r: Pick<Rec, 'input' | 'cacheWrite' | 'output'>) => r.input + r.cacheWrite + r.output

export type LevelId = 1 | 2 | 3 | 4 | 5

export const LEVEL_LABELS = ['Eco', 'Flujo', 'Ritmo Alto', 'Crítico', 'Límite'] as const

/** Nivel de consumo. `basis` indica si sale del plan de 5 h o del contexto del chat con mas uso */
export interface TokenLevel {
  level: LevelId
  label: (typeof LEVEL_LABELS)[number]
  pct: number
  basis: 'plan5h' | 'context'
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
