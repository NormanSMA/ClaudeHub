export type Role = 'orchestrator' | 'subagent'

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
}

export interface SessionMeta {
  title?: string
  lastPrompt?: string
  cwd?: string
}

export type Range = 'all' | '30d' | '7d' | { from: number; to: number }

export const total = (r: Pick<Rec, 'input' | 'cacheWrite' | 'cacheRead' | 'output'>) =>
  r.input + r.cacheWrite + r.cacheRead + r.output
