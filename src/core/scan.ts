import { readdirSync, statSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname, basename, sep } from 'node:path'
import { homedir } from 'node:os'
import { dataDir, codexSessionsDir, geminiTmpDir } from './paths'
import { config } from './config'
import { parseFile } from './parse'
import { parseCodex } from './sources/codex'
import { parseGemini } from './sources/gemini'
import type { LimitHit, Rec, SessionMeta, Source, SourceStat } from './types'

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
  /** estado de lectura de cada fuente */
  sources: Record<Source, SourceStat>
}

type FileSource = 'claude' | 'codex' | 'gemini'

interface Entry {
  file: string
  source: FileSource
  /** proyecto de Gemini: nombre de la carpeta */
  project: string
}

const isJsonl = (name: string) => name.endsWith('.jsonl')

function listJsonl(dir: string, out: string[] = [], match: (name: string) => boolean = isJsonl): string[] {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) listJsonl(p, out, match)
    else if (match(e.name)) out.push(p)
  }
  return out
}

/** Chats de Gemini CLI: <tmp>/<proyecto>/chats/session-*.jsonl */
function listGemini(dir: string): Entry[] {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const out: Entry[] = []
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const chats = join(dir, e.name, 'chats')
    let names
    try {
      names = readdirSync(chats, { withFileTypes: true })
    } catch {
      continue
    }
    for (const n of names) {
      if (n.isFile() && n.name.startsWith('session-') && n.name.endsWith('.jsonl')) {
        out.push({ file: join(chats, n.name), source: 'gemini', project: e.name })
      }
    }
  }
  return out
}

function dirExists(dir: string): boolean {
  try {
    return statSync(dir).isDirectory()
  } catch {
    return false
  }
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

/**
 * Escanea todos los logs. Solo lee bytes nuevos de los archivos de Claude que crecieron.
 * Codex y Gemini se leen solo con la carpeta por defecto (`extra`) y si estan activos en la configuracion.
 */
export function scan(root = PROJECTS_DIR, useCache = true, extra = root === PROJECTS_DIR): ScanResult {
  const cfg = config()
  const wantCodex = extra && cfg.sources.codex
  const wantGemini = extra && cfg.sources.gemini
  const codexDir = codexSessionsDir()
  const geminiDir = geminiTmpDir()
  const entries: Entry[] = listJsonl(root).map((file) => ({ file, source: 'claude', project: '' }))
  if (wantCodex) {
    const rollout = (n: string) => n.startsWith('rollout-') && n.endsWith('.jsonl')
    for (const file of listJsonl(codexDir, [], rollout)) entries.push({ file, source: 'codex', project: '' })
  }
  if (wantGemini) entries.push(...listGemini(geminiDir))

  const stats = new Map<string, { mtimeMs: number; size: number }>()
  const info = new Map<string, Entry>()
  let key = `${wantCodex}|${wantGemini};`
  for (const e of entries) {
    let st
    try {
      st = statSync(e.file)
    } catch {
      continue // el archivo desaparecio entre listar y leer
    }
    stats.set(e.file, st)
    info.set(e.file, e)
    key += `${e.file}|${st.mtimeMs}|${st.size};`
  }
  const files = [...stats.keys()]
  if (useCache && memo && memo.key === key) return memo.result

  if (useCache && !mem) mem = loadCache()
  const cache: Cache = useCache && mem ? mem : { version: CACHE_VERSION, files: {} }
  const next: Cache['files'] = {}
  const failed: Record<FileSource, number> = { claude: 0, codex: 0, gemini: 0 }
  let dirty = false
  for (const f of files) {
    const st = stats.get(f)!
    const e = info.get(f)!
    const hit = cache.files[f]
    if (hit && hit.mtime === st.mtimeMs && hit.size === st.size) {
      next[f] = hit
      continue
    }
    try {
      if (e.source === 'claude') {
        const grew = hit && st.size > hit.size && hit.offset <= st.size
        const parsed = parseFile(f, grew ? hit : undefined)
        next[f] = { mtime: st.mtimeMs, size: st.size, offset: parsed.offset, recs: parsed.recs, meta: parsed.meta }
      } else {
        // Codex y Gemini: se parsea el archivo completo cada vez que cambia
        const text = readFileSync(f, 'utf8')
        const recs = e.source === 'codex' ? parseCodex(text) : parseGemini(text, e.project)
        next[f] = { mtime: st.mtimeMs, size: st.size, offset: st.size, recs, meta: {} }
      }
      dirty = true
    } catch {
      // un archivo ilegible no rompe las demas fuentes
      failed[e.source]++
    }
  }
  if (useCache) {
    mem = { version: CACHE_VERSION, files: next }
    const removed = Object.keys(cache.files).length !== Object.keys(next).length
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
  const counts: Record<FileSource, { files: number; records: number }> = {
    claude: { files: 0, records: 0 },
    codex: { files: 0, records: 0 },
    gemini: { files: 0, records: 0 },
  }
  let limitHit: LimitHit | null = null
  for (const f of files) {
    const entry = next[f]
    if (!entry) continue // fallo al leer: ya contado en `failed`
    const source = info.get(f)!.source
    counts[source].files++
    counts[source].records += entry.recs.length
    for (const r of entry.recs) if (!seen.has(r.id)) seen.set(r.id, r)
    if (source !== 'claude') continue
    if (!f.split(sep).includes('subagents')) sessions.set(basename(f, '.jsonl'), entry.meta)
    const h = entry.meta.limitHit
    if (h && (!limitHit || h.resetsAt >= limitHit.resetsAt)) limitHit = h
  }
  const stat = (source: FileSource, enabled: boolean, dir: string): SourceStat => {
    if (!enabled) return { enabled: false, files: 0, records: 0, ok: false, reason: 'desactivada' }
    const c = counts[source]
    if (failed[source] > 0) return { enabled: true, ...c, ok: false, reason: `${failed[source]} archivos con error` }
    if (!dirExists(dir)) return { enabled: true, ...c, ok: false, reason: 'carpeta no encontrada' }
    return { enabled: true, ...c, ok: true }
  }
  const result: ScanResult = {
    recs: [...seen.values()],
    sessions,
    limitHit,
    sources: {
      claude: stat('claude', true, root),
      codex: stat('codex', wantCodex, codexDir),
      gemini: stat('gemini', wantGemini, geminiDir),
      omniroute: { enabled: false, files: 0, records: 0, ok: false, reason: 'sin configurar' },
    },
  }
  if (useCache) memo = { key, result }
  return result
}
