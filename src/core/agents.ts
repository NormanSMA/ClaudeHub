import { createHash } from 'node:crypto'
import { closeSync, fstatSync, openSync, readSync } from 'node:fs'
import { join } from 'node:path'
import { dataDir } from './paths'

export type EventSource = 'claude' | 'codex'
export type HookState = 'idle' | 'starting' | 'thinking' | 'tool' | 'waiting' | 'done' | 'error'
export type MascotState = 'waiting' | 'error' | 'alert' | 'tool' | 'thinking' | 'happy' | 'sleeping'

/** Linea de events.jsonl escrita por scripts/hook.cjs. */
export interface HookEvent {
  v: 1
  ts: number
  source: EventSource
  session: string
  event: string
  state: HookState
  tool: string
  cwd: string
}

export interface AgentState {
  source: EventSource
  session: string
  /** Solo el nombre de la carpeta de trabajo. */
  project: string
  state: HookState
  /** ts del primer evento de la racha actual con el mismo estado. */
  since: number
  /** ts del primer evento de la racha actual de estados activos (starting, thinking, tool). */
  activeSince: number
  tool: string
  lastTs: number
  stuck: boolean
  /** Huella de la carpeta normalizada. Sirve para agrupar sin exponer la ruta. */
  cwdKey: string
}

export interface Collision {
  project: string
  sessions: { source: EventSource; session: string }[]
  since: number
}

const SOURCES: readonly string[] = ['claude', 'codex']
const STATES: readonly string[] = ['idle', 'starting', 'thinking', 'tool', 'waiting', 'done', 'error']
const ACTIVE: readonly HookState[] = ['starting', 'thinking', 'tool']

const MAX_AGE_MS = 30 * 60_000
const STUCK_THINKING_MS = 5 * 60_000
const STUCK_TOOL_MS = 15 * 60_000
const COLLISION_MS = 10_000
const HAPPY_MS = 10_000

/** Valida un objeto leido del archivo. Devuelve null si no cumple el formato. */
function parseEvent(raw: unknown): HookEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.v !== 1) return null
  if (typeof o.source !== 'string' || !SOURCES.includes(o.source)) return null
  if (typeof o.state !== 'string' || !STATES.includes(o.state)) return null
  if (typeof o.ts !== 'number' || !Number.isFinite(o.ts)) return null
  if (typeof o.session !== 'string' || o.session === '') return null
  return {
    v: 1,
    ts: o.ts,
    source: o.source as EventSource,
    session: o.session,
    event: typeof o.event === 'string' ? o.event : '',
    state: o.state as HookState,
    tool: typeof o.tool === 'string' ? o.tool : '',
    cwd: typeof o.cwd === 'string' ? o.cwd : '',
  }
}

/** Lee hasta maxBytes del final del archivo. Devuelve el texto y si se cortaron bytes del inicio. */
function readTail(file: string, maxBytes: number): { text: string; truncated: boolean } | null {
  let fd: number
  try {
    fd = openSync(file, 'r')
  } catch {
    return null
  }
  try {
    const size = fstatSync(fd).size
    const len = Math.min(size, maxBytes)
    const buf = Buffer.alloc(len)
    let read = 0
    while (read < len) {
      const n = readSync(fd, buf, read, len - read, size - len + read)
      if (n <= 0) break
      read += n
    }
    return { text: buf.toString('utf8', 0, read), truncated: size > len }
  } catch {
    return null
  } finally {
    closeSync(fd)
  }
}

/** Convierte texto en eventos validos. Si el texto empieza a mitad de linea, descarta la primera. */
function parseLines(text: string, truncated: boolean): HookEvent[] {
  const lines = text.split('\n')
  if (truncated) lines.shift()
  const out: HookEvent[] = []
  for (const line of lines) {
    if (!line.trim()) continue
    try {
      const ev = parseEvent(JSON.parse(line))
      if (ev) out.push(ev)
    } catch {
      // linea rota: se descarta
    }
  }
  return out
}

/**
 * Lee el final de events.jsonl y, si sobra espacio, el de events.1.jsonl.
 * Devuelve los eventos validos en orden cronologico del archivo.
 */
export function readEvents(dir: string = dataDir(), maxBytes = 65536): HookEvent[] {
  const current = readTail(join(dir, 'events.jsonl'), maxBytes)
  const used = current ? Buffer.byteLength(current.text) : 0
  const older = used < maxBytes && (!current || !current.truncated) ? readTail(join(dir, 'events.1.jsonl'), maxBytes - used) : null
  const first = older ? parseLines(older.text, older.truncated) : []
  const last = current ? parseLines(current.text, current.truncated) : []
  return [...first, ...last]
}

/** Nombre de la carpeta final de una ruta, sin el resto. */
function projectName(cwd: string): string {
  const parts = cwd.split(/[\\/]+/).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : ''
}

/** Normaliza una ruta: separadores iguales, sin barra final y en minusculas en Windows. */
function normalizeCwd(cwd: string): string {
  let c = cwd.replace(/\\/g, '/').replace(/\/+$/, '')
  if (process.platform === 'win32') c = c.toLowerCase()
  return c
}

function cwdKey(cwd: string): string {
  const n = normalizeCwd(cwd)
  return n ? createHash('sha1').update(n).digest('hex').slice(0, 16) : ''
}

/** Estado actual de cada sesion, a partir del ultimo evento de cada una. */
export function agentStates(events: HookEvent[], now: number): AgentState[] {
  const groups = new Map<string, HookEvent[]>()
  for (const ev of events) {
    const key = `${ev.source}\u0000${ev.session}`
    const list = groups.get(key)
    if (list) list.push(ev)
    else groups.set(key, [ev])
  }
  const out: AgentState[] = []
  for (const list of groups.values()) {
    const last = list[list.length - 1]
    if (last.state === 'idle' || now - last.ts > MAX_AGE_MS) continue
    let since = last.ts
    for (let i = list.length - 2; i >= 0 && list[i].state === last.state; i--) since = list[i].ts
    let activeSince = last.ts
    if (ACTIVE.includes(last.state)) {
      for (let i = list.length - 2; i >= 0 && ACTIVE.includes(list[i].state); i--) activeSince = list[i].ts
    }
    const elapsed = now - since
    const stuck = (last.state === 'thinking' && elapsed > STUCK_THINKING_MS) || (last.state === 'tool' && elapsed > STUCK_TOOL_MS)
    out.push({
      source: last.source,
      session: last.session,
      project: projectName(last.cwd),
      state: last.state,
      since,
      activeSince,
      tool: last.tool,
      lastTs: last.ts,
      stuck,
      cwdKey: cwdKey(last.cwd),
    })
  }
  return out
}

/** Carpetas con dos o mas sesiones distintas activas a la vez durante 10 s o mas. */
export function collisions(states: AgentState[], now: number): Collision[] {
  const byDir = new Map<string, AgentState[]>()
  for (const s of states) {
    if (!s.cwdKey || !ACTIVE.includes(s.state) || now - s.activeSince < COLLISION_MS) continue
    const list = byDir.get(s.cwdKey)
    if (list) list.push(s)
    else byDir.set(s.cwdKey, [s])
  }
  const out: Collision[] = []
  for (const list of byDir.values()) {
    if (list.length < 2) continue
    out.push({
      project: list[0].project,
      sessions: list.map((s) => ({ source: s.source, session: s.session })),
      since: Math.max(...list.map((s) => s.activeSince)),
    })
  }
  return out
}

/** Estado unico para la mascota. Prioridad: waiting, error, alert, tool, thinking, happy, sleeping. */
export function mascotState(states: AgentState[], clashes: Collision[], now: number): MascotState {
  if (states.some((s) => s.state === 'waiting')) return 'waiting'
  if (states.some((s) => s.state === 'error')) return 'error'
  if (clashes.length > 0 || states.some((s) => s.stuck)) return 'alert'
  if (states.some((s) => s.state === 'tool')) return 'tool'
  if (states.some((s) => s.state === 'thinking' || s.state === 'starting')) return 'thinking'
  if (states.some((s) => s.state === 'done' && now - s.lastTs < HAPPY_MS)) return 'happy'
  return 'sleeping'
}
