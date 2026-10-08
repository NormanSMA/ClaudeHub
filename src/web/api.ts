import { useEffect, useState } from 'react'
import { onStatus, subscribeChanges, throttle, type LiveStatus } from './live'

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

export type SourceId = 'claude' | 'codex' | 'gemini' | 'omniroute'

export interface SourceInfo {
  enabled: boolean
  files: number
  records: number
  ok: boolean
  reason?: string
}

export type SourcesReport = Record<SourceId, SourceInfo>

export interface Live {
  lastTs: number | null
  working: boolean
  todayTokens: number
  todayMessages: number
}

const THROTTLE_MS = 1_500
const LIVE_POLL_MS = 60_000

/** Estado de la conexion en vivo: 'live' (aviso del servidor) o 'poll' (sondeo). */
export function useLiveStatus(): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>('poll')
  useEffect(() => onStatus(setStatus), [])
  return status
}

/** Carga un endpoint, lo recarga al llegar un aviso del servidor y lo sondea como respaldo. */
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
    const reload = throttle(load, THROTTLE_MS)
    let timer: ReturnType<typeof setInterval> | null = null
    let status: LiveStatus = 'poll'
    let hadLive = false
    const schedule = () => {
      if (timer) clearInterval(timer)
      timer = setInterval(load, status === 'live' ? Math.max(every, LIVE_POLL_MS) : every)
    }
    load()
    schedule()
    const offChanges = subscribeChanges(reload)
    const offStatus = onStatus((next) => {
      if (next === status) return
      const recovered = next === 'live' && hadLive
      status = next
      hadLive ||= next === 'live'
      schedule()
      // tras una caida del canal pudieron perderse avisos: se recarga una vez
      if (recovered) reload()
    })
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      if (timer) clearInterval(timer)
      reload.cancel()
      offChanges()
      offStatus()
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
