import { config } from './config'
import { modelName } from './models'
import { recordedWindows } from './windows'
import { total, type Range, type Rec, type SessionMeta } from './types'

export type Metas = Map<string, SessionMeta>

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

const DAY_MS = 86_400_000

export function dayKey(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function filterRange(recs: Rec[], range: Range, now = Date.now()): Rec[] {
  if (range === 'all') return recs
  if (typeof range === 'object') return recs.filter((r) => r.ts >= range.from && r.ts <= range.to)
  const days = range === '7d' ? 7 : 30
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const from = start.getTime() - (days - 1) * DAY_MS
  return recs.filter((r) => r.ts >= from)
}

const sum = (recs: Rec[]) => recs.reduce((a, r) => a + total(r), 0)

function breakdown(recs: Rec[]) {
  const b = { input: 0, cacheWrite: 0, cacheRead: 0, output: 0, total: 0 }
  for (const r of recs) {
    b.input += r.input
    b.cacheWrite += r.cacheWrite
    b.cacheRead += r.cacheRead
    b.output += r.output
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
  const start = end.getTime() - (27 * 7 + weekday) * DAY_MS
  for (let t = start; t <= end.getTime() + (6 - weekday) * DAY_MS; t += DAY_MS) {
    const k = dayKey(t)
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
    { last: Rec | null; peak: number; project: string; orch: number; sub: number; lastTs: number; subs: Map<string, number> }
  >()
  for (const r of all) {
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
      if (r.agentFile) s.subs.set(r.agentFile, Math.max(s.subs.get(r.agentFile) ?? 0, r.ts))
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
      activeSubagents: [...s.subs.values()].filter((t) => now - t < SUBAGENT_LIVE_MS).length,
    })
  }
  return out.sort((a, b) => b.lastTs - a.lastTs)
}
