import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { Rec } from '../types'

export interface OmnirouteStatus {
  ok: boolean
  reason?: string
  /** true si se devuelven datos de una copia anterior porque la nueva fallo */
  stale?: boolean
  /** cuando se hizo la copia (ms epoch). Solo con docker cp */
  copiedAt?: number
}

/** Una llamada de usage_history, incluidas las fallidas (sin tokens). Solo campos de uso. */
export interface OmniCall {
  ts: number
  provider: string
  model: string
  /** codigo HTTP; 0 si no se registro */
  status: number
  ok: boolean
  latencyMs: number | null
  tokens: number
}

interface OmnirouteData {
  recs: Rec[]
  calls: OmniCall[]
}

export interface OmnirouteResult extends OmnirouteData {
  status: OmnirouteStatus
}

/** Lo minimo que se usa de node:sqlite, para no depender de `any`. */
interface SqliteStatement {
  get(): Record<string, unknown> | undefined
  all(): Record<string, unknown>[]
}
interface SqliteDb {
  prepare(sql: string): SqliteStatement
  close(): void
}
interface SqliteModule {
  DatabaseSync: new (path: string, options: { readOnly: boolean }) => SqliteDb
}

export interface OmnirouteOpts {
  container: string
  /** Ruta directa a storage.sqlite. Vacio: copia desde el contenedor con docker cp */
  dbPath: string
  /** Carpeta donde se guarda la copia temporal */
  workDir: string
  ttlMs?: number
  now?: () => number
  /** Copia `origen` (contenedor:ruta) a `destino`. Por defecto usa docker cp. Util para pruebas. */
  copy?: (src: string, dest: string) => Promise<void>
  /** Carga el modulo sqlite. Por defecto import('node:sqlite'). Util para pruebas. */
  loadSqlite?: () => Promise<SqliteModule>
}

const REMOTE = '/app/data/storage.sqlite'
const SUFFIXES = ['', '-wal', '-shm'] as const
const CONTAINER_RE = /^[\w.-]{1,64}$/
const DEFAULT_TTL = 60_000
const MAX_RETRIES = 2
// Tope de filas para acotar memoria. Se leen primero las mas recientes.
const MAX_ROWS = 50_000
const execFileP = promisify(execFile)

// Solo columnas de uso. Nunca cuerpos, prompts, claves, cuentas ni tokens de acceso.
// Las ultimas tres faltan en versiones viejas de OmniRoute y se leen como NULL.
const COLS = [
  'id', 'provider', 'model', 'tokens_input', 'tokens_output', 'tokens_cache_read', 'tokens_cache_creation',
  'tokens_reasoning', 'timestamp', 'status', 'success', 'latency_ms',
]

interface Cached extends OmnirouteData {
  copiedAt: number
}
const cache = new Map<string, Cached>()
const inflight = new Map<string, Promise<OmnirouteResult>>()
const EMPTY: OmnirouteData = { recs: [], calls: [] }

type Row = Record<string, unknown>

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const nullable = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

const dockerCopy = async (src: string, dest: string): Promise<void> => {
  await execFileP('docker', ['cp', src, dest], { timeout: 10_000, windowsHide: true })
}

const defaultLoad = () => import('node:sqlite') as Promise<SqliteModule>

function mapRow(row: Row): Rec | null {
  const input = num(row.tokens_input)
  const cacheRead = num(row.tokens_cache_read)
  const cacheWrite = num(row.tokens_cache_creation)
  // Misma regla que el calculo de costo de OmniRoute: si el razonamiento supera la salida,
  // el proveedor lo informo aparte; si no, ya viene dentro de tokens_output (estilo OpenAI).
  const reasoning = num(row.tokens_reasoning)
  const rawOutput = num(row.tokens_output)
  const output = reasoning > rawOutput ? rawOutput + reasoning : rawOutput
  if (input + cacheRead + cacheWrite + output <= 0) return null
  const ts = Date.parse(String(row.timestamp))
  if (Number.isNaN(ts)) return null
  const provider = String(row.provider ?? 'unknown')
  return {
    id: `omniroute:${row.id}`,
    ts,
    // sin el proveedor: el mismo modelo usado directo y via OmniRoute cae en una sola fila de Modelos
    model: String(row.model ?? 'unknown'),
    input,
    cacheRead,
    cacheWrite,
    output,
    reasoning,
    session: `omniroute:${provider}`,
    project: provider,
    role: 'orchestrator',
    source: 'omniroute',
  }
}

function mapCall(row: Row): OmniCall | null {
  const ts = Date.parse(String(row.timestamp))
  if (Number.isNaN(ts)) return null
  const status = Number.parseInt(String(row.status ?? ''), 10) || 0
  const success = nullable(row.success)
  return {
    ts,
    provider: String(row.provider ?? 'unknown'),
    model: String(row.model ?? 'unknown'),
    status,
    ok: success !== null ? success === 1 : status >= 200 && status < 300,
    latencyMs: nullable(row.latency_ms),
    tokens:
      num(row.tokens_input) + num(row.tokens_output) + num(row.tokens_cache_read) + num(row.tokens_cache_creation) + num(row.tokens_reasoning),
  }
}

/** Lista de columnas para el SELECT: las que no existen en esta version de OmniRoute salen como NULL. */
function selectColumns(db: SqliteDb): string {
  const have = new Set(db.prepare('PRAGMA table_info(usage_history)').all().map((c) => String(c.name)))
  return COLS.map((c) => (have.has(c) ? c : `NULL AS ${c}`)).join(', ')
}

/** Abre la base en solo lectura, valida con quick_check y lee las filas de uso. Lanza si algo falla. */
function readDb(sqlite: SqliteModule, path: string): OmnirouteData {
  const db = new sqlite.DatabaseSync(path, { readOnly: true })
  try {
    const check = db.prepare('PRAGMA quick_check').get()
    if (!check || Object.values(check)[0] !== 'ok') throw new Error('quick_check fallido')
    const sql = `SELECT ${selectColumns(db)} FROM usage_history ORDER BY id DESC LIMIT ${MAX_ROWS}`
    const recs: Rec[] = []
    const calls: OmniCall[] = []
    for (const row of db.prepare(sql).all()) {
      const rec = mapRow(row)
      if (rec) recs.push(rec)
      const call = mapCall(row)
      if (call) calls.push(call)
    }
    return { recs: recs.reverse(), calls }
  } finally {
    db.close()
  }
}

function brief(e: unknown): string {
  const err = e as { code?: string; killed?: boolean }
  if (err?.code === 'ENOENT') return 'Docker no disponible'
  if (err?.killed) return 'docker cp excedio el tiempo'
  return 'no se pudo leer la base de OmniRoute'
}

/**
 * Lee el uso de OmniRoute (tabla usage_history) de su base SQLite. Nunca lanza:
 * ante un error devuelve datos vacios y status.ok false, o la copia anterior con stale true.
 */
export function readOmniroute(opts: OmnirouteOpts): Promise<OmnirouteResult> {
  // Llamadas simultaneas comparten una sola lectura: evita copias y borrados cruzados
  const key = `${opts.container}|${opts.workDir}|${opts.dbPath}`
  const running = inflight.get(key)
  if (running) return running
  const run = readOnce(opts).finally(() => inflight.delete(key))
  inflight.set(key, run)
  return run
}

type CopyOutcome = { data: OmnirouteData } | { reason: string }

/** Copia la base del contenedor y la lee. Reintenta si la copia sale danada. */
async function copyAndRead(opts: OmnirouteOpts, sqlite: SqliteModule): Promise<CopyOutcome> {
  const copy = opts.copy ?? dockerCopy
  const stage = join(opts.workDir, 'omniroute')
  let reason = 'no se pudo leer la base de OmniRoute'
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await mkdir(stage, { recursive: true })
      for (const s of SUFFIXES) await rm(join(stage, `storage.sqlite${s}`), { force: true })
      try {
        await copy(`${opts.container}:${REMOTE}`, join(stage, 'storage.sqlite'))
      } catch (e) {
        // Sin Docker o contenedor inexistente: reintentar no ayuda
        return { reason: brief(e) }
      }
      // -wal y -shm pueden no existir si la base no tiene escrituras pendientes
      for (const s of SUFFIXES.slice(1)) {
        try {
          await copy(`${opts.container}:${REMOTE}${s}`, join(stage, `storage.sqlite${s}`))
        } catch {
          /* opcional */
        }
      }
      return { data: readDb(sqlite, join(stage, 'storage.sqlite')) }
    } catch (e) {
      // Copia danada o quick_check fallido: se reintenta la copia
      reason = brief(e)
    }
  }
  return { reason }
}

async function readOnce(opts: OmnirouteOpts): Promise<OmnirouteResult> {
  const now = opts.now ?? Date.now
  const ttl = opts.ttlMs ?? DEFAULT_TTL
  let sqlite: SqliteModule
  try {
    sqlite = await (opts.loadSqlite ?? defaultLoad)()
    if (!sqlite?.DatabaseSync) throw new Error('sin DatabaseSync')
  } catch {
    return { ...EMPTY, status: { ok: false, reason: 'node:sqlite no disponible' } }
  }

  if (opts.dbPath) {
    try {
      return { ...readDb(sqlite, opts.dbPath), status: { ok: true } }
    } catch (e) {
      return { ...EMPTY, status: { ok: false, reason: brief(e) } }
    }
  }

  if (!CONTAINER_RE.test(opts.container)) {
    return { ...EMPTY, status: { ok: false, reason: 'nombre de contenedor invalido' } }
  }

  const key = `${opts.container}|${opts.workDir}`
  const prev = cache.get(key)
  if (prev && now() - prev.copiedAt < ttl) {
    const { copiedAt, ...held } = prev
    return { ...held, status: { ok: true, copiedAt } }
  }

  const out = await copyAndRead(opts, sqlite)
  if ('data' in out) {
    const copiedAt = now()
    cache.set(key, { ...out.data, copiedAt })
    return { ...out.data, status: { ok: true, copiedAt } }
  }
  if (prev) {
    const { copiedAt, ...held } = prev
    return { ...held, status: { ok: false, reason: out.reason, stale: true, copiedAt } }
  }
  return { ...EMPTY, status: { ok: false, reason: out.reason } }
}
