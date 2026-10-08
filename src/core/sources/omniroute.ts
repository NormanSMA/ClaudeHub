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

export interface OmnirouteResult {
  recs: Rec[]
  status: OmnirouteStatus
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
  loadSqlite?: () => Promise<any>
}

const REMOTE = '/app/data/storage.sqlite'
const SUFFIXES = ['', '-wal', '-shm'] as const
const CONTAINER_RE = /^[\w.-]{1,64}$/
const DEFAULT_TTL = 60_000
const MAX_RETRIES = 2
const execFileP = promisify(execFile)

// Solo columnas de uso. Nunca cuerpos, prompts, claves ni tokens de acceso.
const QUERY =
  'SELECT id, provider, model, tokens_input, tokens_output, tokens_cache_read, ' +
  'tokens_cache_creation, tokens_reasoning, timestamp FROM usage_history'

interface Cached {
  recs: Rec[]
  copiedAt: number
}
const cache = new Map<string, Cached>()
const inflight = new Map<string, Promise<OmnirouteResult>>()

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

const dockerCopy = async (src: string, dest: string): Promise<void> => {
  await execFileP('docker', ['cp', src, dest], { timeout: 10_000, windowsHide: true })
}

const defaultLoad = () => import('node:sqlite')

function mapRow(row: any): Rec | null {
  const input = num(row.tokens_input)
  const cacheRead = num(row.tokens_cache_read)
  const cacheWrite = num(row.tokens_cache_creation)
  const output = num(row.tokens_output) + num(row.tokens_reasoning)
  if (input + cacheRead + cacheWrite + output <= 0) return null
  const ts = Date.parse(String(row.timestamp))
  if (Number.isNaN(ts)) return null
  const provider = String(row.provider ?? 'unknown')
  return {
    id: `omniroute:${row.id}`,
    ts,
    model: `${provider}/${String(row.model ?? 'unknown')}`,
    input,
    cacheRead,
    cacheWrite,
    output,
    session: `omniroute:${provider}`,
    project: provider,
    role: 'orchestrator',
    source: 'omniroute',
  }
}

/** Abre la base en solo lectura, valida con quick_check y lee las filas de uso. Lanza si algo falla. */
function readDb(sqlite: any, path: string): Rec[] {
  const db = new sqlite.DatabaseSync(path, { readOnly: true })
  try {
    const check = db.prepare('PRAGMA quick_check').get() as Record<string, unknown> | undefined
    if (!check || Object.values(check)[0] !== 'ok') throw new Error('quick_check fallido')
    const recs: Rec[] = []
    for (const row of db.prepare(QUERY).all()) {
      const rec = mapRow(row)
      if (rec) recs.push(rec)
    }
    return recs
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
 * ante un error devuelve recs vacio y status.ok false, o la copia anterior con stale true.
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

async function readOnce(opts: OmnirouteOpts): Promise<OmnirouteResult> {
  const now = opts.now ?? Date.now
  const ttl = opts.ttlMs ?? DEFAULT_TTL
  let sqlite: any
  try {
    sqlite = await (opts.loadSqlite ?? defaultLoad)()
    if (!sqlite?.DatabaseSync) throw new Error('sin DatabaseSync')
  } catch {
    return { recs: [], status: { ok: false, reason: 'node:sqlite no disponible' } }
  }

  if (opts.dbPath) {
    try {
      return { recs: readDb(sqlite, opts.dbPath), status: { ok: true } }
    } catch (e) {
      return { recs: [], status: { ok: false, reason: brief(e) } }
    }
  }

  if (!CONTAINER_RE.test(opts.container)) {
    return { recs: [], status: { ok: false, reason: 'nombre de contenedor invalido' } }
  }

  const key = `${opts.container}|${opts.workDir}`
  const prev = cache.get(key)
  if (prev && now() - prev.copiedAt < ttl) {
    return { recs: prev.recs, status: { ok: true, copiedAt: prev.copiedAt } }
  }

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
        reason = brief(e)
        break
      }
      // -wal y -shm pueden no existir si la base no tiene escrituras pendientes
      for (const s of SUFFIXES.slice(1)) {
        try {
          await copy(`${opts.container}:${REMOTE}${s}`, join(stage, `storage.sqlite${s}`))
        } catch {
          /* opcional */
        }
      }
      const recs = readDb(sqlite, join(stage, 'storage.sqlite'))
      const copiedAt = now()
      cache.set(key, { recs, copiedAt })
      return { recs, status: { ok: true, copiedAt } }
    } catch (e) {
      // Copia danada o quick_check fallido: se reintenta la copia
      reason = brief(e)
    }
  }
  if (prev) return { recs: prev.recs, status: { ok: false, reason, stale: true, copiedAt: prev.copiedAt } }
  return { recs: [], status: { ok: false, reason } }
}
