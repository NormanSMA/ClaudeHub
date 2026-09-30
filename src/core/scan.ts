import { readdirSync, statSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname, basename, sep } from 'node:path'
import { homedir } from 'node:os'
import { dataDir } from './paths'
import { parseFile } from './parse'
import type { LimitHit, Rec, SessionMeta } from './types'

export const PROJECTS_DIR = process.env.CLAUDE_PROJECTS_DIR ?? join(homedir(), '.claude', 'projects')
const CACHE_FILE = process.env.CLAUDEHUB_CACHE ?? join(dataDir(), 'cache.json')
const CACHE_VERSION = 5
const SAVE_EVERY_MS = 60_000

interface CacheEntry {
  mtime: number
  size: number
  offset: number
  recs: Rec[]
  meta: SessionMeta
}
interface Cache {
  version: number
  files: Record<string, CacheEntry>
}

export interface ScanResult {
  recs: Rec[]
  sessions: Map<string, SessionMeta>
  /** el limite del plan alcanzado mas reciente en cualquier chat, si lo hay */
  limitHit: LimitHit | null
}

function listJsonl(dir: string, out: string[] = []): string[] {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) listJsonl(p, out)
    else if (e.name.endsWith('.jsonl')) out.push(p)
  }
  return out
}

function loadCache(): Cache {
  try {
    const c = JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as Cache
    if (c.version === CACHE_VERSION) return c
  } catch {
    /* sin cache previo */
  }
  return { version: CACHE_VERSION, files: {} }
}

let memo: { key: string; result: ScanResult } | null = null
let mem: Cache | null = null
let lastSave = 0

/** Escanea todos los logs. Solo lee bytes nuevos de los archivos que crecieron. */
export function scan(root = PROJECTS_DIR, useCache = true): ScanResult {
  const stats = new Map<string, { mtimeMs: number; size: number }>()
  let key = ''
  for (const f of listJsonl(root)) {
    let st
    try {
      st = statSync(f)
    } catch {
      continue // el archivo desaparecio entre listar y leer
    }
    stats.set(f, st)
    key += `${f}|${st.mtimeMs}|${st.size};`
  }
  const files = [...stats.keys()]
  if (useCache && memo && memo.key === key) return memo.result

  if (useCache && !mem) mem = loadCache()
  const cache: Cache = useCache && mem ? mem : { version: CACHE_VERSION, files: {} }
  const next: Cache['files'] = {}
  let dirty = false
  for (const f of files) {
    const st = stats.get(f)!
    const hit = cache.files[f]
    if (hit && hit.mtime === st.mtimeMs && hit.size === st.size) {
      next[f] = hit
      continue
    }
    const grew = hit && st.size > hit.size && hit.offset <= st.size
    const parsed = parseFile(f, grew ? hit : undefined)
    next[f] = { mtime: st.mtimeMs, size: st.size, offset: parsed.offset, recs: parsed.recs, meta: parsed.meta }
    dirty = true
  }
  if (useCache) {
    mem = { version: CACHE_VERSION, files: next }
    const removed = Object.keys(cache.files).length !== files.length
    if ((dirty || removed) && Date.now() - lastSave > SAVE_EVERY_MS) {
      lastSave = Date.now()
      // se serializa ahora (estado consistente) y se escribe sin bloquear el servidor
      const json = JSON.stringify(mem)
      mkdir(dirname(CACHE_FILE), { recursive: true })
        .then(() => writeFile(CACHE_FILE, json))
        .catch(() => {
          /* cache opcional */
        })
    }
  }
  // dedupe global: sesiones bifurcadas pueden repetir mensajes entre archivos
  const seen = new Map<string, Rec>()
  const sessions = new Map<string, SessionMeta>()
  for (const f of files) {
    for (const r of next[f].recs) if (!seen.has(r.id)) seen.set(r.id, r)
    if (!f.split(sep).includes('subagents')) sessions.set(basename(f, '.jsonl'), next[f].meta)
  }
  let limitHit: LimitHit | null = null
  for (const f of files) {
    const h = next[f].meta.limitHit
    if (h && (!limitHit || h.resetsAt >= limitHit.resetsAt)) limitHit = h
  }
  const result: ScanResult = { recs: [...seen.values()], sessions, limitHit }
  if (useCache) memo = { key, result }
  return result
}
