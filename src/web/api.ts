import { useEffect, useState } from 'react'

export type Range = 'all' | '30d' | '7d'

export interface Breakdown {
  input: number
  cacheWrite: number
  cacheRead: number
  output: number
  total: number
}

export interface Summary {
  sessions: number
  messages: number
  tokens: Breakdown
  activeDays: number
  peakHour: number | null
  favoriteModel: string | null
  heatmap: { day: string; tokens: number }[]
}

export interface ModelsReport {
  daily: { day: string; byModel: Record<string, number> }[]
  models: (Breakdown & { model: string; share: number })[]
}

export interface RolesReport {
  orchestrator: Breakdown & { messages: number; share: number }
  subagent: Breakdown & { messages: number; share: number }
  daily: { day: string; orchestrator: number; subagent: number }[]
  agents: (Breakdown & { agent: string; messages: number })[]
}

export interface SessionRow {
  session: string
  title: string
  cwd: string | null
  project: string
  first: number
  last: number
  orch: number
  sub: number
  total: number
  messages: number
}

export interface ProjectRow {
  project: string
  orch: number
  sub: number
  total: number
  sessions: number
}

export interface Live {
  lastTs: number | null
  working: boolean
  todayTokens: number
  todayMessages: number
}

/** Carga un endpoint y lo refresca cada `every` ms. */
export function useApi<T>(path: string, every = 30_000): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setData(null)
    // ventana oculta o pestana en segundo plano: no se consulta (ahorra CPU)
    const load = () => {
      if (document.hidden) return
      fetch(path)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d) => alive && (setData(d), setError(null)))
        .catch((e) => alive && setError(String(e.message ?? e)))
    }
    const onVisible = () => load()
    load()
    const t = setInterval(load, every)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [path, every])
  return { data, error }
}

export interface ActiveChat {
  session: string
  title: string
  project: string
  cwd: string | null
  model: string
  lastTs: number
  working: boolean
  context: { used: number; limit: number; estimated: boolean; source: 'statusline' | 'config' | 'estimate'; pct: number }
  tokens: { orchestrator: number; subagents: number; total: number }
  activeSubagents: number
}

export interface SettingsInfo {
  config: { name: string; alertAt: number; activeMinutes: number; contextLimits: Record<string, number> }
  path: string
  demo: boolean
  models: string[]
}

export interface ConfigInfo {
  name: string
  demo: boolean
}

export interface PlanWindow {
  pct: number
  resetsAt: number
  tokens: number
}

export interface PlanReport {
  fiveHour: PlanWindow | null
  sevenDay: PlanWindow | null
  blocked: { type: string; resetsAt: number } | null
  updatedAt: number
}

export interface ActiveReport {
  alertAt: number
  todayTokens: number
  chats: ActiveChat[]
  plan: PlanReport | null
}
