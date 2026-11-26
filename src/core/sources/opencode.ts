import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import type { Rec } from '../types'

export interface OpencodeStatus {
  ok: boolean
  reason?: string
}

export interface OpencodeResult {
  recs: Rec[]
  status: OpencodeStatus
}

interface SqliteStatement {
  get(): Record<string, unknown> | undefined
  all(): Record<string, unknown>[]
}

interface SqliteDb {
  prepare(sql: string): SqliteStatement
  close(): void
}

export interface SqliteModule {
  DatabaseSync: new (path: string, options: { readOnly: boolean }) => SqliteDb
}

export interface OpencodeOpts {
  dbPath: string
  ttlMs?: number
  now?: () => number
  loadSqlite?: () => Promise<SqliteModule>
}

interface CachedOpencode {
  recs: Rec[]
  readAt: number
}

interface TokensShape {
  input?: unknown
  output?: unknown
  reasoning?: unknown
  cache?: { read?: unknown; write?: unknown } | null
}

const DEFAULT_TTL = 30_000
const MAX_ROWS = 50_000
const cache = new Map<string, CachedOpencode>()
const inflight = new Map<string, Promise<OpencodeResult>>()

const defaultLoad = () => import('node:sqlite') as Promise<SqliteModule>

const nonNeg = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)

function projectNameFromDir(dir: unknown): string {
  if (typeof dir !== 'string') return 'opencode'
  const clean = dir.replace(/[\\/]+$/, '')
  if (!clean) return 'opencode'
  const normalized = clean.replace(/\\/g, '/')
  return basename(normalized) || 'opencode'
}

function parseTokens(raw: unknown): { input: number; output: number; cacheRead: number; cacheWrite: number; reasoning: number } | null {
  if (typeof raw !== 'string' || !raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const t = parsed as TokensShape
  const input = nonNeg(t.input)
  const rawOutput = nonNeg(t.output)
  const reasoning = nonNeg(t.reasoning)
  const output = rawOutput + reasoning
  const cacheRead = t.cache && typeof t.cache === 'object' ? nonNeg(t.cache.read) : 0
  const cacheWrite = t.cache && typeof t.cache === 'object' ? nonNeg(t.cache.write) : 0
  if (input + output + cacheRead + cacheWrite <= 0) return null
  return { input, output, cacheRead, cacheWrite, reasoning }
}

const QUERY = `
SELECT
  m.id,
  m.session_id,
  m.time_created,
  json_extract(m.data, '$.role') AS role,
  json_extract(m.data, '$.modelID') AS model_id,
  json_extract(m.data, '$.providerID') AS provider_id,
  json_extract(m.data, '$.agent') AS agent,
  json_extract(m.data, '$.mode') AS mode,
  json_extract(m.data, '$.tokens') AS tokens_json,
  s.parent_id,
  s.directory
FROM message m
LEFT JOIN session s ON s.id = m.session_id
WHERE json_extract(m.data, '$.role') = 'assistant'
  AND json_extract(m.data, '$.tokens') IS NOT NULL
ORDER BY m.time_created DESC
LIMIT ${MAX_ROWS}
`.trim()

function mapRow(row: Record<string, unknown>): Rec | null {
  if (typeof row.id !== 'string' || !row.id) return null
  if (typeof row.session_id !== 'string' || !row.session_id) return null
  const ts = nonNeg(row.time_created)
  if (ts <= 0) return null
  const tokens = parseTokens(row.tokens_json)
  if (!tokens) return null
  const parentId = typeof row.parent_id === 'string' && row.parent_id ? row.parent_id : null
  const agentName = typeof row.agent === 'string' && row.agent
    ? row.agent
    : typeof row.mode === 'string' && row.mode
      ? row.mode
      : 'opencode'
  return {
    id: `opencode:${row.id}`,
    ts,
    model: typeof row.model_id === 'string' && row.model_id ? row.model_id : 'unknown',
    input: tokens.input,
    cacheRead: tokens.cacheRead,
    cacheWrite: tokens.cacheWrite,
    output: tokens.output,
    ...(tokens.reasoning > 0 ? { reasoning: tokens.reasoning } : {}),
    session: parentId ?? row.session_id,
    project: projectNameFromDir(row.directory),
    role: parentId ? 'subagent' : 'orchestrator',
    ...(parentId ? { agent: agentName, agentFile: row.session_id } : {}),
    source: 'opencode',
  }
}

function readDb(sqlite: SqliteModule, dbPath: string): Rec[] {
  const db = new sqlite.DatabaseSync(dbPath, { readOnly: true })
  try {
    const check = db.prepare('PRAGMA quick_check').get()
    if (!check || Object.values(check)[0] !== 'ok') throw new Error('quick_check fallido')
    const recs: Rec[] = []
    for (const row of db.prepare(QUERY).all()) {
      const rec = mapRow(row)
      if (rec) recs.push(rec)
    }
    return recs.reverse()
  } finally {
    db.close()
  }
}

/** Limpia la cache en memoria de OpenCode. Util en pruebas aisladas. */
export function clearOpencodeCache(): void {
  cache.clear()
}

/**
 * Lee metricas de tokens de OpenCode desde opencode.db en modo solo lectura.
 * Nunca consulta tablas de credenciales ni contenido de mensajes. Nunca lanza.
 */
export function readOpencode(opts: OpencodeOpts): Promise<OpencodeResult> {
  const running = inflight.get(opts.dbPath)
  if (running) return running
  const run = readOnce(opts).finally(() => inflight.delete(opts.dbPath))
  inflight.set(opts.dbPath, run)
  return run
}

async function readOnce(opts: OpencodeOpts): Promise<OpencodeResult> {
  if (!existsSync(opts.dbPath)) {
    return { recs: [], status: { ok: false, reason: 'base no encontrada' } }
  }
  const now = opts.now ?? Date.now
  const ttl = opts.ttlMs ?? DEFAULT_TTL
  const prev = cache.get(opts.dbPath)
  if (prev && now() - prev.readAt < ttl) {
    return { recs: prev.recs, status: { ok: true } }
  }

  let sqlite: SqliteModule
  try {
    sqlite = await (opts.loadSqlite ?? defaultLoad)()
    if (!sqlite?.DatabaseSync) throw new Error('sin DatabaseSync')
  } catch {
    return { recs: prev?.recs ?? [], status: { ok: false, reason: 'node:sqlite no disponible' } }
  }

  try {
    const recs = readDb(sqlite, opts.dbPath)
    cache.set(opts.dbPath, { recs, readAt: now() })
    return { recs, status: { ok: true } }
  } catch {
    return {
      recs: prev?.recs ?? [],
      status: { ok: false, reason: 'no se pudo leer opencode.db' },
    }
  }
}
