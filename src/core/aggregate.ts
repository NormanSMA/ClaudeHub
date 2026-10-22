import { config } from './config'
import { modelName } from './models'
import { recordedWindows } from './windows'
import { sourceOf, total, type Range, type Rec, type SessionMeta, type Source } from './types'

export type Metas = Map<string, SessionMeta>

const SOURCES: readonly Source[] = ['claude', 'codex', 'gemini', 'omniroute']

/** Valida ?source= contra una lista blanca. Cualquier otro valor equivale a 'all'. */
export function parseSource(v: string | undefined): Source | 'all' {
  return SOURCES.find((s) => s === v) ?? 'all'
}

export function filterSource(recs: Rec[], source: Source | 'all'): Rec[] {
  return source === 'all' ? recs : recs.filter((r) => sourceOf(r) === source)
}

export function sessionTitle(meta: SessionMeta | undefined): string {
  if (meta?.title) return meta.title
  const p = meta?.lastPrompt?.replace(/\s+/g, ' ').trim()
  if (p) return p.length > 70 ? p.slice(0, 67) + '...' : p
  return 'Sin titulo'
}

/** Ventana de contexto. Los logs no la declaran: config.json manda; si no, sobre 200k se asume 1M. */
export function contextLimit(peak: number, model = '', recorded?: number): { limit: number; estimated: boolean; source: string } {
  // 1) tamano real registrado por la linea de estado de Claude Code
  if (recorded) return { limit: recorded, estimated: false, source: 'statusline' }
  // 2) limite fijado a mano en config.json
  const fixed = config().contextLimits[model]
  if (fixed) return { limit: fixed, estimated: false, source: 'config' }
  // 3) estimacion por el mayor contexto visto en el chat
  return { limit: peak > 200_000 ? 1_000_000 : 200_000, estimated: true, source: 'estimate' }
}

export function dayKey(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function filterRange<T extends { ts: number }>(recs: T[], range: Range, now = Date.now()): T[] {
  if (range === 'all') return recs
  if (typeof range === 'object') return recs.filter((r) => r.ts >= range.from && r.ts <= range.to)
  const days = range === '7d' ? 7 : 30
  // por calendario local: restar 24 h fijas falla en los dias con cambio de horario
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (days - 1))
  const from = start.getTime()
  return recs.filter((r) => r.ts >= from)
}

const sum = (recs: Rec[]) => recs.reduce((a, r) => a + total(r), 0)

export function breakdown(recs: Rec[]) {
  const b = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0, reasoning: 0, total: 0 }
  for (const r of recs) {
    b.input += r.input
    b.cacheWrite += r.cacheWrite
    b.cacheRead += r.cacheRead
    b.output += r.output
    b.reasoning += r.reasoning ?? 0
  }
  b.total = b.input + b.cacheWrite + b.cacheRead + b.output
  return b
}

function topKey(counts: Map<string, number>): string | null {
  let best: string | null = null
  let max = -1
  for (const [k, v] of counts) if (v > max) ((best = k), (max = v))
  return best
}

export function summary(all: Rec[], range: Range, now = Date.now()) {
  const recs = filterRange(all, range, now)
  const sessions = new Set(recs.map((r) => r.session))
  const days = new Map<string, number>()
  const hours = new Map<string, number>()
  const models = new Map<string, number>()
  for (const r of recs) {
    const t = total(r)
    days.set(dayKey(r.ts), (days.get(dayKey(r.ts)) ?? 0) + t)
    const h = String(new Date(r.ts).getHours())
    hours.set(h, (hours.get(h) ?? 0) + 1)
    const m = modelName(r.model)
    models.set(m, (models.get(m) ?? 0) + t)
  }
  // heatmap: ultimas 28 semanas completas hasta hoy, columnas por semana (lunes a domingo)
  const heat: { day: string; tokens: number }[] = []
  const end = new Date(now)
  end.setHours(0, 0, 0, 0)
  const weekday = (end.getDay() + 6) % 7
  const cursor = new Date(end)
  cursor.setDate(cursor.getDate() - (27 * 7 + weekday))
  for (let i = 0; i < 28 * 7; i++, cursor.setDate(cursor.getDate() + 1)) {
    const k = dayKey(cursor.getTime())
    heat.push({ day: k, tokens: days.get(k) ?? 0 })
  }
  const peak = topKey(hours)
  return {
    range,
    sessions: sessions.size,
    messages: recs.length,
    tokens: breakdown(recs),
    activeDays: days.size,
    peakHour: peak === null ? null : Number(peak),
    favoriteModel: topKey(models),
    heatmap: heat,
  }
}

export function modelsReport(all: Rec[], range: Range, now = Date.now()) {
  const recs = filterRange(all, range, now)
  const daily = new Map<string, Record<string, number>>()
  const table = new Map<string, Rec[]>()
  for (const r of recs) {
    const m = modelName(r.model)
    const k = dayKey(r.ts)
    const row = daily.get(k) ?? {}
    row[m] = (row[m] ?? 0) + total(r)
    daily.set(k, row)
    const list = table.get(m) ?? []
    list.push(r)
    table.set(m, list)
  }
  const grand = sum(recs) || 1
  return {
    range,
    daily: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, byModel]) => ({ day, byModel })),
    models: [...table.entries()]
      .map(([model, rs]) => ({ model, ...breakdown(rs), share: sum(rs) / grand }))
      .sort((a, b) => b.total - a.total),
  }
}

export function rolesReport(all: Rec[], range: Range, now = Date.now()) {
  const recs = filterRange(all, range, now)
  const orch = recs.filter((r) => r.role === 'orchestrator')
  const sub = recs.filter((r) => r.role === 'subagent')
  const daily = new Map<string, { orchestrator: number; subagent: number }>()
  const agents = new Map<string, Rec[]>()
  for (const r of recs) {
    const k = dayKey(r.ts)
    const row = daily.get(k) ?? { orchestrator: 0, subagent: 0 }
    row[r.role] += total(r)
    daily.set(k, row)
    if (r.role === 'subagent') {
      const a = r.agent ?? 'subagent'
      const list = agents.get(a) ?? []
      list.push(r)
      agents.set(a, list)
    }
  }
  const grand = sum(recs) || 1
  return {
    range,
    orchestrator: { ...breakdown(orch), messages: orch.length, share: sum(orch) / grand },
    subagent: { ...breakdown(sub), messages: sub.length, share: sum(sub) / grand },
    daily: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, ...v })),
    agents: [...agents.entries()]
      .map(([agent, rs]) => ({ agent, messages: rs.length, ...breakdown(rs) }))
      .sort((a, b) => b.total - a.total),
  }
}

export function sessionsReport(all: Rec[], metas: Metas, range: Range, limit = 100, now = Date.now()) {
  const recs = filterRange(all, range, now)
  const map = new Map<string, { project: string; first: number; last: number; orch: number; sub: number; messages: number }>()
  for (const r of recs) {
    const s = map.get(r.session) ?? { project: r.project, first: r.ts, last: r.ts, orch: 0, sub: 0, messages: 0 }
    s.first = Math.min(s.first, r.ts)
    s.last = Math.max(s.last, r.ts)
    s.messages++
    if (r.role === 'orchestrator') {
      s.orch += total(r)
      s.project = r.project
    } else s.sub += total(r)
    map.set(r.session, s)
  }
  return [...map.entries()]
    .map(([session, s]) => ({
      session,
      title: sessionTitle(metas.get(session)),
      cwd: metas.get(session)?.cwd ?? null,
      ...s,
      total: s.orch + s.sub,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

export function projectsReport(all: Rec[], range: Range, now = Date.now()) {
  const recs = filterRange(all, range, now)
  const map = new Map<string, { orch: number; sub: number; sessions: Set<string> }>()
  for (const r of recs) {
    const p = map.get(r.project) ?? { orch: 0, sub: 0, sessions: new Set<string>() }
    if (r.role === 'orchestrator') p.orch += total(r)
    else p.sub += total(r)
    p.sessions.add(r.session)
    map.set(r.project, p)
  }
  return [...map.entries()]
    .map(([project, p]) => ({ project, orch: p.orch, sub: p.sub, total: p.orch + p.sub, sessions: p.sessions.size }))
    .sort((a, b) => b.total - a.total)
}

export function live(all: Rec[], now = Date.now()) {
  let last = 0
  for (const r of all) if (r.ts > last) last = r.ts
  const today = filterRange(all, '7d', now).filter((r) => dayKey(r.ts) === dayKey(now))
  return {
    lastTs: last || null,
    working: last > 0 && now - last < 60_000,
    todayTokens: sum(today),
    todayMessages: today.length,
  }
}

const WORKING_MS = 60_000
const SUBAGENT_LIVE_MS = 2 * 60_000
const FIVE_HOURS_MS = 5 * 3_600_000
const MAX_SUBAGENTS = 10

/** Tokens por minuto de Claude dentro de la ventana que termina en `now`. */
export function burnRate(recs: Rec[], now: number, windowMs = 15 * 60_000): number {
  let tokens = 0
  for (const r of recs) if (sourceOf(r) === 'claude' && r.ts > now - windowMs && r.ts <= now) tokens += total(r)
  return tokens / (windowMs / 60_000)
}

/** Porcentaje (0 a 100) de la entrada que se leyo de la cache. 0 si no hay entrada. */
export function cacheEfficiency(tokens: { input: number; cacheWrite: number; cacheRead: number }): number {
  const denom = tokens.input + tokens.cacheWrite + tokens.cacheRead
  return denom > 0 ? (tokens.cacheRead / denom) * 100 : 0
}

/** Parte (0 a 1) de los tokens de Claude, en las ultimas 5 h, que gastaron los subagentes. */
export function delegationShare(recs: Rec[], now = Date.now()): number {
  let sub = 0
  let all = 0
  for (const r of recs) {
    if (sourceOf(r) !== 'claude' || r.ts <= now - FIVE_HOURS_MS || r.ts > now) continue
    const t = total(r)
    all += t
    if (r.role === 'subagent') sub += t
  }
  return all > 0 ? sub / all : 0
}

export interface ChatSubagent {
  agent: string | null
  file: string
  tokens: number
  lastTs: number
  working: boolean
}

/** Chats con actividad reciente, con su uso de ventana de contexto. */
export function activeReport(
  all: Rec[],
  metas: Metas,
  now = Date.now(),
  windowMs = config().activeMinutes * 60_000,
  windows: Record<string, { size: number }> = recordedWindows(),
) {
  const by = new Map<
    string,
    { last: Rec | null; peak: number; project: string; orch: number; sub: number; lastTs: number; subs: Map<string, Omit<ChatSubagent, 'working'>> }
  >()
  for (const r of all) {
    // los chats activos y su ventana de contexto son de Claude; otras fuentes se ven en Agentes
    if (sourceOf(r) !== 'claude') continue
    const s = by.get(r.session) ?? { last: null, peak: 0, project: r.project, orch: 0, sub: 0, lastTs: 0, subs: new Map() }
    s.lastTs = Math.max(s.lastTs, r.ts)
    if (r.role === 'orchestrator') {
      s.orch += total(r)
      s.project = r.project
      const ctx = r.input + r.cacheWrite + r.cacheRead
      s.peak = Math.max(s.peak, ctx)
      if (!s.last || r.ts > s.last.ts) s.last = r
    } else {
      s.sub += total(r)
      if (r.agentFile) {
        const sub = s.subs.get(r.agentFile) ?? { agent: r.agent ?? null, file: r.agentFile, tokens: 0, lastTs: 0 }
        sub.tokens += total(r)
        sub.lastTs = Math.max(sub.lastTs, r.ts)
        s.subs.set(r.agentFile, sub)
      }
    }
    by.set(r.session, s)
  }
  const out = []
  for (const [session, s] of by) {
    if (now - s.lastTs > windowMs || !s.last) continue
    const used = s.last.input + s.last.cacheWrite + s.last.cacheRead
    const modelLabel = modelName(s.last.model)
    const { limit, estimated, source } = contextLimit(s.peak, modelLabel, windows[session]?.size)
    const meta = metas.get(session)
    const all = [...s.subs.values()].map((x) => ({ ...x, working: now - x.lastTs < SUBAGENT_LIVE_MS }))
    // la API publica solo los mas recientes: una sesion larga acumula decenas de subagentes
    const subagents: ChatSubagent[] = [...all].sort((a, b) => b.lastTs - a.lastTs).slice(0, MAX_SUBAGENTS)
    out.push({
      session,
      title: sessionTitle(meta),
      project: s.project,
      cwd: meta?.cwd ?? null,
      model: modelLabel,
      lastTs: s.lastTs,
      working: now - s.lastTs < WORKING_MS,
      context: { used, limit, estimated, source, pct: Math.min(1, used / limit) },
      tokens: { orchestrator: s.orch, subagents: s.sub, total: s.orch + s.sub },
      activeSubagents: all.filter((x) => x.working).length,
      subagents,
    })
  }
  return out.sort((a, b) => b.lastTs - a.lastTs)
}
