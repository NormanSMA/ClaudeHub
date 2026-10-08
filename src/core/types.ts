export type Role = 'orchestrator' | 'subagent'

/** Herramienta de origen del registro */
export type Source = 'claude' | 'codex' | 'gemini' | 'omniroute'

export interface Rec {
  id: string
  ts: number
  model: string
  input: number
  cacheWrite: number
  cacheRead: number
  output: number
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
