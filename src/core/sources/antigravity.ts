import { closeSync, existsSync, fstatSync, openSync, readdirSync, readSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { modelName } from '../models'
import { antigravityBrainDir, antigravityDir } from '../paths'
import type { Rec } from '../types'

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export interface AntigravityQuotaGroup {
  id: string
  label: string
  usedPct: number
  remainingPct: number
  resetsAt: number
  models: string[]
}

export interface AntigravityQuotas {
  updatedAt: number
  groups: AntigravityQuotaGroup[]
}

/** Estado del parser entre lecturas por offset. */
export interface AntigravityState {
  session: string
  project: string
  model: string
  title?: string
  cwd?: string
  parentSession?: string
  agent?: string
}

export function initAntigravityState(sessionId: string): AntigravityState {
  return { session: sessionId, project: '', model: 'antigravity' }
}

const ID_PREFIX = 'antigravity:'
const TITLE_CHARS = 70

/** Mapa id -> mayor salida registrada. El id tiene la forma antigravity:<sesion>:<paso>. */
export const seenAntigravityIds = (recs: readonly Rec[]): Map<string, number> => {
  const seen = new Map<string, number>()
  for (const r of recs) {
    const prev = seen.get(r.id)
    if (prev === undefined || r.output > prev) seen.set(r.id, r.output)
  }
  return seen
}

/** "Gemini 4 Hydrogen (High)" -> "gemini-4-hydrogen". Los nombres desconocidos pasan a minusculas con guiones. */
export function antigravityModelId(display: string): string {
  const full = display.toLowerCase()
  if (/argon|orchestrator/.test(full)) return 'gemini-4-argon'
  if (/hydrogen/.test(full)) return 'gemini-4-hydrogen'
  const base = full.replace(/\([^)]*\)/g, '').trim()
  if (/gemini\s*3\.8\s*flash/.test(base)) return 'gemini-3.8-flash'
  const claude = base.match(/^claude\s+(opus|sonnet|haiku)\s+(\d+)(?:\.(\d+))?/)
  if (claude) return `claude-${claude[1]}-${claude[2]}${claude[3] ? `-${claude[3]}` : ''}`
  if (/gpt-oss\s*120b/.test(base)) return 'gpt-oss-120b'
  return base.replace(/\s+/g, '-')
}

const MODEL_RE = /changed setting `Model Selection` from [^\n]*? to ([^\n]+?)\.(?=\s|$)/

function detectModel(content: string): string | null {
  const m = MODEL_RE.exec(content)
  if (!m) return null
  const id = antigravityModelId(m[1].replace(/[`*"]/g, '').trim())
  return id || null
}

function* jsonLines(text: string): Generator<Record<string, unknown>> {
  for (const line of text.split('\n')) {
    if (!line.includes('"step_index"')) continue
    try {
      const o: unknown = JSON.parse(line)
      if (o && typeof o === 'object' && !Array.isArray(o)) yield o as Record<string, unknown>
    } catch {
      /* linea corrupta o a medio escribir */
    }
  }
}

/** Convierte un transcript en registros. Solo lee metricas y cambios de modelo del usuario. */
export function parseAntigravity(text: string, sessionId = 'unknown'): Rec[] {
  return parseAntigravityChunk(text, initAntigravityState(sessionId), new Map())
}

/** Igual que `parseAntigravity`, pero continua desde `state` y `seen`, y los actualiza al terminar. */
export function parseAntigravityChunk(text: string, state: AntigravityState, seen: Map<string, number>): Rec[] {
  const recs: Rec[] = []
  for (const o of jsonLines(text)) {
    if (o.type === 'USER_INPUT' && typeof o.content === 'string' && o.content.includes('Model Selection')) {
      const model = detectModel(o.content)
      if (model) state.model = model
    }
    if (o.type !== 'PLANNER_RESPONSE') continue
    const input = Math.max(0, num(o.input_tokens))
    const cacheRead = Math.max(0, num(o.cache_read_tokens))
    const output = Math.max(0, num(o.output_tokens))
    if (input <= 0 && cacheRead <= 0 && output <= 0) continue
    const step = o.step_index
    if (typeof step !== 'number' || !Number.isFinite(step)) continue
    const ts = typeof o.created_at === 'string' ? Date.parse(o.created_at) : NaN
    if (Number.isNaN(ts)) continue
    const id = `${ID_PREFIX}${state.session}:${step}`
    const prevOut = seen.get(id)
    if (prevOut !== undefined && output <= prevOut) continue
    seen.set(id, output)
    recs.push({
      id,
      ts,
      model: state.model,
      input,
      cacheRead,
      cacheWrite: 0,
      output,
      session: state.parentSession || state.session,
      project: state.project || 'antigravity',
      role: state.parentSession ? 'subagent' : 'orchestrator',
      agent: state.agent || undefined,
      agentFile: state.parentSession ? state.session : undefined,
      source: 'antigravity',
    })
  }
  return recs
}

export interface AntigravitySummary {
  title: string
  project: string
  cwd: string | null
  parentSession?: string
  agent?: string
}

const SUMMARY_MEMO_MS = 30_000
let summaryMemo: { dir: string; at: number; value: Map<string, AntigravitySummary> } | null = null

/** "file:///c%3A/Proyectos/ClaudeHub" -> "c:/Proyectos/ClaudeHub" */
function uriToPath(uri: string): string {
  const raw = uri.replace(/^file:\/\//i, '')
  let path = raw
  try {
    path = decodeURIComponent(raw)
  } catch {
    /* se deja sin decodificar */
  }
  return path.replace(/^\/(?=[A-Za-z]:)/, '')
}

function firstWorkspace(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  let first: unknown = value
  try {
    const parsed: unknown = JSON.parse(value)
    first = Array.isArray(parsed) ? parsed[0] : parsed
  } catch {
    /* no es JSON: se toma como una ruta */
  }
  return typeof first === 'string' && first ? uriToPath(first) : null
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Lee titulo, proyecto, agente y padre de cada conversacion. Devuelve un mapa vacio si falla. */
export function readAntigravitySummaries(agyDir: string = antigravityDir()): Map<string, AntigravitySummary> {
  const now = Date.now()
  if (summaryMemo && summaryMemo.dir === agyDir && now - summaryMemo.at < SUMMARY_MEMO_MS) return summaryMemo.value
  const out = new Map<string, AntigravitySummary>()
  const file = join(agyDir, 'conversation_summaries.db')
  if (existsSync(file)) {
    let db: DatabaseSync | null = null
    try {
      db = new DatabaseSync(file, { readOnly: true })
      const rows = db
        .prepare('SELECT conversation_id, title, workspace_uris, agent_name, parent_conversation_id FROM conversation_summaries')
        .all()
      for (const row of rows) {
        const id = str(row.conversation_id)
        if (!id) continue
        const cwd = firstWorkspace(row.workspace_uris)
        const project = cwd ? (cwd.split(/[\\/]/).filter(Boolean).pop() ?? '') : ''
        const parent = str(row.parent_conversation_id)
        const agent = str(row.agent_name)
        out.set(id, {
          title: str(row.title).replace(/\s+/g, ' ').trim().slice(0, TITLE_CHARS),
          project,
          cwd,
          ...(parent ? { parentSession: parent } : {}),
          ...(agent ? { agent } : {}),
        })
      }
    } catch {
      /* base ausente, bloqueada o con otro esquema: se sigue sin resumenes */
    } finally {
      try {
        db?.close()
      } catch {
        /* ya cerrada */
      }
    }
  }
  summaryMemo = { dir: agyDir, at: now, value: out }
  return out
}

/** Vacia el memo de resumenes. Lo usan las pruebas. */
export function clearAntigravitySummariesCache(): void {
  summaryMemo = null
}

const MAX_FILES = 20
const TAIL_BYTES = 256 * 1024
const QUOTA_MEMO_MS = 30_000
let quotaMemo: { dir: string; at: number; value: AntigravityQuotas | null } | null = null

/** Vacia el memo de cuotas. Lo usan las pruebas. */
export function clearAntigravityQuotasCache(): void {
  quotaMemo = null
}

function transcriptFiles(brain: string): { file: string; mtime: number }[] {
  const out: { file: string; mtime: number }[] = []
  let dirs
  try {
    dirs = readdirSync(brain, { withFileTypes: true })
  } catch {
    return out
  }
  for (const d of dirs) {
    if (!d.isDirectory()) continue
    const file = join(brain, d.name, '.system_generated', 'logs', 'transcript.jsonl')
    try {
      out.push({ file, mtime: statSync(file).mtimeMs })
    } catch {
      /* sin transcript */
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime).slice(0, MAX_FILES)
}

function readTail(file: string): string {
  const fd = openSync(file, 'r')
  try {
    const size = fstatSync(fd).size
    const start = Math.max(0, size - TAIL_BYTES)
    const buf = Buffer.alloc(size - start)
    let got = 0
    while (got < buf.length) {
      const n = readSync(fd, buf, got, buf.length - got, start + got)
      if (n <= 0) break
      got += n
    }
    return buf.subarray(0, got).toString('utf8')
  } finally {
    closeSync(fd)
  }
}

/** Extrae el objeto JSON que sigue a `"quotas":` con conteo de llaves. */
function quotasObject(text: string): Record<string, unknown> | null {
  const at = text.lastIndexOf('"quotas"')
  if (at < 0) return null
  const open = text.indexOf('{', at)
  if (open < 0) return null
  let depth = 0
  let inStr = false
  for (let i = open; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (c === '\\') i++
      else if (c === '"') inStr = false
    } else if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) {
      try {
        const v: unknown = JSON.parse(text.slice(open, i + 1))
        return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
      } catch {
        return null
      }
    }
  }
  return null
}

interface Snapshot {
  at: number
  quotas: Record<string, unknown>
}

function lastSnapshot(text: string, fallbackAt: number): Snapshot | null {
  let found: Snapshot | null = null
  for (const line of text.split('\n')) {
    if (!line.includes('quota_remaining')) continue
    let obj: unknown = null
    try {
      obj = JSON.parse(line)
    } catch {
      continue // primera linea cortada por el limite de lectura
    }
    if (!obj || typeof obj !== 'object') continue
    const rec = obj as Record<string, unknown>
    const rawContent = typeof rec.content === 'string' ? rec.content : ''
    if (!rawContent.includes('quota_remaining')) continue
    const normalized = rawContent.includes('"quotas"') ? rawContent : rawContent.replace(/\\"/g, '"')
    if (!normalized.includes('"quotas"')) continue
    const quotas = quotasObject(normalized)
    if (!quotas) continue
    const parsedAt = typeof rec.created_at === 'string' ? Date.parse(rec.created_at) : NaN
    const at = Number.isNaN(parsedAt) ? fallbackAt : parsedAt
    if (!found || at >= found.at) found = { at, quotas }
  }
  return found
}

function quotaLabel(id: string): string {
  if (/^claude-(?:opus|sonnet)-5-5/.test(id)) return 'Claude 5.5'
  if (id.startsWith('claude-')) return 'Claude'
  if (/argon|orchestrator/.test(id)) return 'Gemini 4 Argon'
  if (/hydrogen|^gemini-3\.8-flash/.test(id)) return 'Gemini 4 Hydrogen / 3.8'
  if (id.startsWith('gpt-oss-120b')) return 'GPT-OSS 120B'
  return modelName(id)
}

function buildGroups(quotas: Record<string, unknown>, now: number): AntigravityQuotaGroup[] {
  const groups = new Map<string, AntigravityQuotaGroup>()
  for (const [model, value] of Object.entries(quotas)) {
    if (!value || typeof value !== 'object') continue
    const q = value as Record<string, unknown>
    const remaining = typeof q.quota_remaining === 'string' ? Number.parseFloat(q.quota_remaining) : NaN
    const resets = typeof q.quota_resets === 'string' ? Date.parse(q.quota_resets) : NaN
    if (Number.isNaN(remaining) || Number.isNaN(resets) || resets <= now) continue
    const remainingPct = Math.min(100, Math.max(0, remaining))
    const label = quotaLabel(model)
    const name = modelName(model)
    const g = groups.get(label)
    if (!g) {
      groups.set(label, {
        id: label.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, ''),
        label,
        usedPct: 100 - remainingPct,
        remainingPct,
        resetsAt: resets,
        models: [name],
      })
      continue
    }
    if (remainingPct < g.remainingPct) {
      g.remainingPct = remainingPct
      g.usedPct = 100 - remainingPct
      g.resetsAt = resets
    }
    if (!g.models.includes(name)) g.models.push(name)
  }
  return [...groups.values()]
}

/** Cuotas del ultimo snapshot vigente de `swarm models` en los transcripts recientes, o null si no hay. */
export function latestAntigravityQuotas(agyDir: string = antigravityDir(), now = Date.now()): AntigravityQuotas | null {
  if (quotaMemo && quotaMemo.dir === agyDir && now - quotaMemo.at < QUOTA_MEMO_MS) return quotaMemo.value
  const brain = agyDir === antigravityDir() ? antigravityBrainDir() : join(agyDir, 'brain')
  let best: { at: number; groups: AntigravityQuotaGroup[] } | null = null
  for (const { file, mtime } of transcriptFiles(brain)) {
    try {
      const snap = lastSnapshot(readTail(file), mtime)
      if (!snap) continue
      const groups = buildGroups(snap.quotas, now)
      if (!groups.length) continue
      if (!best || snap.at > best.at) best = { at: snap.at, groups }
    } catch {
      /* archivo ilegible: se sigue con el siguiente */
    }
  }
  const value = best ? { updatedAt: best.at, groups: best.groups } : null
  quotaMemo = { dir: agyDir, at: now, value }
  return value
}
