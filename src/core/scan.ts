import { existsSync, readdirSync, statSync, readFileSync, openSync, readSync, closeSync } from 'node:fs'
import { mkdir, writeFile, rename } from 'node:fs/promises'
import { join, dirname, basename, sep, relative, isAbsolute, resolve } from 'node:path'
import { homedir } from 'node:os'
import { dataDir, codexSessionsDir, geminiTmpDir, antigravityBrainDir, antigravityDir, loomRunsFile } from './paths'
import { config } from './config'
import { newerVersion, parseFile } from './parse'
import { initCodexState, parseCodexChunk, type CodexState } from './sources/codex'
import { parseGeminiChunk, seenGeminiIds, type GeminiState } from './sources/gemini'
import {
  initAntigravityState,
  parseAntigravityChunk,
  readAntigravitySummaries,
  seenAntigravityIds,
  type AntigravityState,
} from './sources/antigravity'
import { parseLoomChunk, seenLoomIds } from './sources/loom'
import { preferLimitHit, type LimitHit, type Rec, type SessionMeta, type Source, type SourceStat } from './types'

export const PROJECTS_DIR = process.env.CLAUDE_PROJECTS_DIR ?? join(homedir(), '.claude', 'projects')
const CACHE_FILE = process.env.CLAUDEHUB_CACHE ?? join(dataDir(), 'cache.json')
const CACHE_VERSION = 11
const SAVE_EVERY_MS = 60_000
const CHUNK = 8 * 1024 * 1024

interface CacheEntry {
  mtime: number
  size: number
  /** bytes ya consumidos (hasta la ultima linea completa) */
  offset: number
  recs: Rec[]
  meta: SessionMeta
  /** estado del parser de Codex para seguir leyendo desde `offset` */
  codex?: CodexState
  /** estado del parser de Gemini para seguir leyendo desde `offset` */
  gemini?: GeminiState
  /** estado del parser de Antigravity para seguir leyendo desde `offset` */
  antigravity?: AntigravityState
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

export interface ScanOptions {
  /** Rutas que cambiaron desde el ultimo scan. Solo se revisan esas. Sin este dato se recorre todo. */
  changed?: string[]
  /** Lee Codex y Gemini. Por defecto, solo con la carpeta de Claude por defecto. */
  extra?: boolean
  /** Recibe los bytes que se leen de cada archivo. Sirve para medir. */
  onRead?: (file: string, bytes: number) => void
}

type FileSource = 'claude' | 'codex' | 'gemini' | 'antigravity' | 'loom'
type Stat = { mtimeMs: number; size: number }

interface Entry {
  file: string
  source: FileSource
  /** proyecto de Gemini: nombre de la carpeta */
  project: string
}

interface Ctx {
  root: string
  codex: string
  gemini: string
  antigravity: string
  loomFile: string
  wantCodex: boolean
  wantGemini: boolean
  wantAntigravity: boolean
  wantLoom: boolean
  key: string
}

/** Resultado global ya deduplicado, listo para ampliarse con los registros nuevos de un archivo. */
interface Merged {
  recs: Rec[]
  /** archivo dueno de cada registro, en paralelo a `recs` */
  owner: string[]
  index: Map<string, number>
  sessions: Map<string, SessionMeta>
  limitHit: LimitHit | null
  counts: Record<FileSource, { files: number; records: number }>
  /** lineas de uso de Claude descartadas, sumadas de todos los archivos */
  skipped: number
  /** version mas alta de Claude Code vista en los archivos */
  cliVersion?: string
}

interface Engine {
  cache: Cache
  infos: Map<string, Entry>
  failed: Map<string, FileSource>
  merged: Merged | null
  result: ScanResult | null
  key: string
  /** algo cambio desde el resultado anterior */
  touched: boolean
  /** el resultado fusionado ya no sirve y hay que reconstruirlo */
  stale: boolean
  report: (file: string, bytes: number) => void
}

const isJsonl = (name: string) => name.endsWith('.jsonl')
const isRollout = (name: string) => name.startsWith('rollout-') && name.endsWith('.jsonl')
const isGeminiChat = (name: string) => name.startsWith('session-') && name.endsWith('.jsonl')

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
      if (n.isFile() && isGeminiChat(n.name)) out.push({ file: join(chats, n.name), source: 'gemini', project: e.name })
    }
  }
  return out
}

const TRANSCRIPT_PARTS = ['.system_generated', 'logs', 'transcript.jsonl']

/** Transcripts de Antigravity: <brain>/<id>/.system_generated/logs/transcript.jsonl */
function listAntigravity(dir: string): Entry[] {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const out: Entry[] = []
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const file = join(dir, e.name, ...TRANSCRIPT_PARTS)
    if (existsSync(file)) out.push({ file, source: 'antigravity', project: '' })
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

function context(root: string, opts: ScanOptions): Ctx {
  const extra = opts.extra ?? root === PROJECTS_DIR
  const cfg = config()
  const wantCodex = extra && cfg.sources.codex
  const wantGemini = extra && cfg.sources.gemini
  const codex = codexSessionsDir()
  const gemini = geminiTmpDir()
  const wantAntigravity = extra && cfg.sources.antigravity
  const antigravity = antigravityBrainDir()
  const wantLoom = extra && cfg.sources.loom
  const loomFile = loomRunsFile()
  return {
    root,
    codex,
    gemini,
    antigravity,
    loomFile,
    wantCodex,
    wantGemini,
    wantAntigravity,
    wantLoom,
    key: [root, codex, gemini, antigravity, loomFile, wantCodex, wantGemini, wantAntigravity, wantLoom].join('|'),
  }
}

function listEntries(ctx: Ctx): Entry[] {
  const entries: Entry[] = listJsonl(ctx.root).map((file) => ({ file, source: 'claude', project: '' }))
  if (ctx.wantCodex) {
    for (const file of listJsonl(ctx.codex, [], isRollout)) entries.push({ file, source: 'codex', project: '' })
  }
  if (ctx.wantGemini) entries.push(...listGemini(ctx.gemini))
  if (ctx.wantAntigravity) entries.push(...listAntigravity(ctx.antigravity))
  if (ctx.wantLoom && existsSync(ctx.loomFile)) entries.push({ file: ctx.loomFile, source: 'loom', project: '' })
  return entries
}

const within = (dir: string, p: string): boolean => {
  const r = relative(dir, p)
  return r !== '' && r.split(sep)[0] !== '..' && !isAbsolute(r)
}

/** Dice a que fuente pertenece una ruta que aviso el vigilante, o null si no es un log. */
function classify(p: string, ctx: Ctx): Entry | null {
  if (!isJsonl(p)) return null
  if (within(ctx.root, p)) return { file: p, source: 'claude', project: '' }
  if (ctx.wantCodex && within(ctx.codex, p) && isRollout(basename(p))) return { file: p, source: 'codex', project: '' }
  if (ctx.wantGemini && within(ctx.gemini, p)) {
    const parts = relative(ctx.gemini, p).split(sep)
    if (parts.length === 3 && parts[1] === 'chats' && isGeminiChat(parts[2])) return { file: p, source: 'gemini', project: parts[0] }
  }
  if (ctx.wantAntigravity && within(ctx.antigravity, p)) {
    const parts = relative(ctx.antigravity, p).split(sep)
    if (parts.length === 4 && parts.slice(1).join('/') === TRANSCRIPT_PARTS.join('/')) {
      return { file: p, source: 'antigravity', project: '' }
    }
  }
  if (ctx.wantLoom && resolve(p) === resolve(ctx.loomFile)) return { file: p, source: 'loom', project: '' }
  return null
}

/**
 * Lee desde `from` hasta `size` y entrega solo lineas completas. Una ultima linea sin salto
 * de linea se entrega si ya es JSON completo. Devuelve los bytes consumidos.
 */
function feedLines(path: string, from: number, size: number, feed: (text: string) => void): number {
  const fd = openSync(path, 'r')
  try {
    const buf = Buffer.allocUnsafe(Math.min(CHUNK, Math.max(1, size - from)))
    let pos = from
    let carry: Buffer = Buffer.alloc(0)
    while (pos < size) {
      const n = readSync(fd, buf, 0, Math.min(buf.length, size - pos), pos)
      if (n <= 0) break
      pos += n
      const chunk = carry.length ? Buffer.concat([carry, buf.subarray(0, n)]) : Buffer.from(buf.subarray(0, n))
      const nl = chunk.lastIndexOf(10)
      if (nl < 0) {
        carry = chunk
        continue
      }
      feed(chunk.subarray(0, nl).toString('utf8'))
      carry = chunk.subarray(nl + 1)
    }
    if (carry.length) {
      const tail = carry.toString('utf8')
      try {
        JSON.parse(tail)
        feed(tail)
        carry = Buffer.alloc(0)
      } catch {
        /* linea a medio escribir: se relee en el siguiente scan */
      }
    }
    return pos - carry.length
  } finally {
    closeSync(fd)
  }
}

interface Job {
  e: Entry
  st: Stat
  /** entrada previa desde la que se sigue leyendo; sin ella se lee todo el archivo */
  prior?: CacheEntry
}
interface Read {
  entry: CacheEntry
  /** registros que no estaban en `prior` */
  added: Rec[]
}

function readClaude({ e, st, prior }: Job): Read {
  const p = parseFile(e.file, prior)
  return { entry: { mtime: st.mtimeMs, size: st.size, offset: p.offset, recs: p.recs, meta: p.meta }, added: p.recs }
}

function readCodex({ e, st, prior }: Job): Read {
  // el estado se copia: si la lectura falla a medias, el de `prior` sigue valido
  const state = prior?.codex ? structuredClone(prior.codex) : initCodexState(basename(e.file, '.jsonl'))
  const added: Rec[] = []
  const offset = feedLines(e.file, prior?.offset ?? 0, st.size, (text) => {
    for (const r of parseCodexChunk(text, state)) added.push(r)
  })
  const recs = prior ? prior.recs.concat(added) : added
  return { entry: { mtime: st.mtimeMs, size: st.size, offset, recs, meta: {}, codex: state }, added }
}

function readGemini({ e, st, prior }: Job): Read {
  const state: GeminiState = { session: prior?.gemini?.session ?? 'unknown' }
  const seen = seenGeminiIds(prior?.recs ?? [])
  const added: Rec[] = []
  const offset = feedLines(e.file, prior?.offset ?? 0, st.size, (text) => {
    for (const r of parseGeminiChunk(text, e.project, state, seen)) added.push(r)
  })
  const recs = prior ? prior.recs.concat(added) : added
  return { entry: { mtime: st.mtimeMs, size: st.size, offset, recs, meta: {}, gemini: state }, added }
}

/** Id de la conversacion: la carpeta que contiene .system_generated. */
const antigravitySession = (file: string): string => basename(dirname(dirname(dirname(file))))

function readAntigravity({ e, st, prior }: Job): Read {
  const state: AntigravityState = prior?.antigravity
    ? structuredClone(prior.antigravity)
    : initAntigravityState(antigravitySession(e.file))
  const info = readAntigravitySummaries(antigravityDir()).get(state.session)
  let changed = false
  if (info) {
    if (info.project && info.project !== state.project) {
      state.project = info.project
      changed = true
    }
    if (info.cwd && info.cwd !== state.cwd) state.cwd = info.cwd
    if (info.parentSession !== state.parentSession) {
      state.parentSession = info.parentSession
      changed = true
    }
    if (info.agent !== state.agent) {
      state.agent = info.agent
      changed = true
    }
    if (info.title) state.title = info.title
  }
  const priorRecs = changed && prior
    ? prior.recs.map((r) => ({
        ...r,
        session: state.parentSession || state.session,
        project: state.project || 'antigravity',
        role: (state.parentSession ? 'subagent' : 'orchestrator') as Rec['role'],
        agent: state.agent || undefined,
        agentFile: state.parentSession ? state.session : undefined,
      }))
    : prior?.recs
  const seen = seenAntigravityIds(priorRecs ?? [])
  const added: Rec[] = []
  const offset = feedLines(e.file, prior?.offset ?? 0, st.size, (text) => {
    for (const r of parseAntigravityChunk(text, state, seen)) added.push(r)
  })
  const recs = priorRecs ? priorRecs.concat(added) : added
  const meta: SessionMeta = { ...(state.title ? { title: state.title } : {}), ...(state.cwd ? { cwd: state.cwd } : {}) }
  return { entry: { mtime: st.mtimeMs, size: st.size, offset, recs, meta, antigravity: state }, added: changed ? recs : added }
}

function readLoom({ e, st, prior }: Job): Read {
  const seen = seenLoomIds(prior?.recs ?? [])
  const added: Rec[] = []
  const offset = feedLines(e.file, prior?.offset ?? 0, st.size, (text) => {
    for (const r of parseLoomChunk(text, seen)) added.push(r)
  })
  const recs = prior ? prior.recs.concat(added) : added
  return { entry: { mtime: st.mtimeMs, size: st.size, offset, recs, meta: {} }, added }
}

function newMerged(): Merged {
  return {
    recs: [],
    owner: [],
    index: new Map(),
    sessions: new Map(),
    limitHit: null,
    counts: {
      claude: { files: 0, records: 0 },
      codex: { files: 0, records: 0 },
      gemini: { files: 0, records: 0 },
      antigravity: { files: 0, records: 0 },
      loom: { files: 0, records: 0 },
    },
    skipped: 0,
  }
}

/** Mismo criterio que parse.ts: ante el mismo id gana el de mayor salida. Un archivo siempre reemplaza a su propio registro. */
function mergeRecs(m: Merged, file: string, recs: Rec[]): void {
  for (const r of recs) {
    const i = m.index.get(r.id)
    if (i === undefined) {
      m.index.set(r.id, m.recs.length)
      m.recs.push(r)
      m.owner.push(file)
      continue
    }
    const prev = m.recs[i]
    if (prev === r) continue
    if (m.owner[i] === file ? r.output >= prev.output : r.output > prev.output) {
      m.recs[i] = r
      m.owner[i] = file
    }
  }
}

function mergeMeta(m: Merged, e: Entry, entry: CacheEntry): void {
  if (e.source === 'antigravity') {
    const st = entry.antigravity
    if (st && !st.parentSession) {
      const info = readAntigravitySummaries(antigravityDir()).get(st.session)
      const meta: SessionMeta = {
        ...entry.meta,
        ...(info?.title ? { title: info.title } : {}),
        ...(info?.cwd ? { cwd: info.cwd } : {}),
      }
      m.sessions.set(st.session, meta)
    }
    return
  }
  if (e.source !== 'claude') return
  if (!e.file.split(sep).includes('subagents')) m.sessions.set(basename(e.file, '.jsonl'), entry.meta)
  const h = entry.meta.limitHit
  if (h) m.limitHit = preferLimitHit(m.limitHit, h)
  const v = entry.meta.cliVersion
  if (v && newerVersion(v, m.cliVersion)) m.cliVersion = v
}

function absorb(m: Merged, e: Entry, read: Read, prior?: CacheEntry): void {
  const c = m.counts[e.source]
  if (!prior) c.files++
  c.records += read.entry.recs.length - (prior?.recs.length ?? 0)
  if (e.source === 'claude') m.skipped += (read.entry.meta.skipped ?? 0) - (prior?.meta.skipped ?? 0)
  mergeRecs(m, e.file, read.added)
  mergeMeta(m, e, read.entry)
}

function buildMerged(eng: Engine): Merged {
  const m = newMerged()
  for (const [file, entry] of Object.entries(eng.cache.files)) {
    const e = eng.infos.get(file)
    if (e) absorb(m, e, { entry, added: entry.recs })
  }
  return m
}

function removeFile(eng: Engine, file: string): void {
  if (eng.cache.files[file]) {
    delete eng.cache.files[file]
    eng.stale = true
  }
  eng.infos.delete(file)
  if (eng.failed.delete(file)) eng.touched = true
}

/** Lee lo nuevo de un archivo y lo suma al resultado. Solo si su mtime o tamano cambiaron. */
function applyFile(eng: Engine, e: Entry, st: Stat): void {
  const hit = eng.cache.files[e.file]
  if (hit && hit.mtime === st.mtimeMs && hit.size === st.size) {
    eng.infos.set(e.file, e)
    return
  }
  const grew = !!hit && st.size > hit.size && hit.offset <= st.size
  const prior = grew ? hit : undefined
  try {
    const read =
      e.source === 'claude'
        ? readClaude({ e, st, prior })
        : e.source === 'codex'
          ? readCodex({ e, st, prior })
          : e.source === 'gemini'
            ? readGemini({ e, st, prior })
            : e.source === 'loom'
              ? readLoom({ e, st, prior })
              : readAntigravity({ e, st, prior })
    eng.report(e.file, st.size - (prior?.offset ?? 0))
    eng.cache.files[e.file] = read.entry
    eng.infos.set(e.file, e)
    eng.failed.delete(e.file)
    eng.touched = true
    // un archivo reescrito puede haber perdido registros: solo si crecio se fusiona sin reconstruir
    if (hit && !grew) eng.stale = true
    else if (eng.merged && !eng.stale) absorb(eng.merged, e, read, prior)
  } catch {
    // un archivo ilegible no rompe las demas fuentes
    if (hit) removeFile(eng, e.file)
    if (eng.failed.get(e.file) !== e.source) eng.touched = true
    eng.failed.set(e.file, e.source)
  }
}

function fullPass(eng: Engine, ctx: Ctx): void {
  const listed = new Set<string>()
  for (const e of listEntries(ctx)) {
    let st
    try {
      st = statSync(e.file)
    } catch {
      continue // el archivo desaparecio entre listar y leer
    }
    listed.add(e.file)
    applyFile(eng, e, st)
  }
  for (const f of [...Object.keys(eng.cache.files), ...eng.failed.keys()]) {
    if (!listed.has(f)) removeFile(eng, f)
  }
}

function changedPass(eng: Engine, paths: string[], ctx: Ctx): void {
  for (const p of paths) {
    const e = classify(p, ctx)
    if (!e) continue
    let st
    try {
      st = statSync(p)
    } catch {
      removeFile(eng, p)
      continue
    }
    if (st.isFile()) applyFile(eng, e, st)
  }
}

function makeResult(eng: Engine, ctx: Ctx): ScanResult {
  const m = eng.merged!
  const stat = (source: FileSource, enabled: boolean, dir: string): SourceStat => {
    if (!enabled) return { enabled: false, files: 0, records: 0, ok: false, reason: 'desactivada' }
    const c = m.counts[source]
    const failed = [...eng.failed.values()].filter((s) => s === source).length
    if (failed > 0) return { enabled: true, ...c, ok: false, reason: `${failed} archivos con error` }
    if (!dirExists(dir)) return { enabled: true, ...c, ok: false, reason: 'carpeta no encontrada' }
    return { enabled: true, ...c, ok: true }
  }
  return {
    // copias: el resultado anterior sigue en manos de quien lo pidio
    recs: m.recs.slice(),
    sessions: new Map(m.sessions),
    limitHit: m.limitHit,
    sources: {
      claude: { ...stat('claude', true, ctx.root), ...(m.skipped > 0 ? { skipped: m.skipped } : {}), ...(m.cliVersion ? { cliVersion: m.cliVersion } : {}) },
      codex: stat('codex', ctx.wantCodex, ctx.codex),
      gemini: stat('gemini', ctx.wantGemini, ctx.gemini),
      antigravity: stat('antigravity', ctx.wantAntigravity, ctx.antigravity),
      omniroute: { enabled: false, files: 0, records: 0, ok: false, reason: 'sin configurar' },
      opencode: { enabled: false, files: 0, records: 0, ok: false, reason: 'sin configurar' },
      loom: !ctx.wantLoom
        ? { enabled: false, files: 0, records: 0, ok: false, reason: 'desactivada' }
        : existsSync(ctx.loomFile)
          ? { enabled: true, ...m.counts.loom, ok: true }
          : { enabled: true, files: 0, records: 0, ok: false, reason: 'sin registros' },
    },
  }
}

let lastSave = 0

function saveCache(cache: Cache): void {
  if (Date.now() - lastSave <= SAVE_EVERY_MS) return
  lastSave = Date.now()
  // se serializa ahora (estado consistente) y se escribe sin bloquear el servidor
  const json = JSON.stringify(cache)
  const tmp = CACHE_FILE + '.' + process.pid + '.tmp'
  mkdir(dirname(CACHE_FILE), { recursive: true })
    .then(() => writeFile(tmp, json))
    .then(() => rename(tmp, CACHE_FILE))
    .catch(() => {
      /* cache opcional */
    })
}

const newEngine = (cache: Cache): Engine => ({
  cache,
  infos: new Map(),
  failed: new Map(),
  merged: null,
  result: null,
  key: '',
  touched: false,
  stale: false,
  report: () => {},
})

let engine: Engine | null = null

/**
 * Escanea los logs. Solo lee los bytes nuevos de los archivos que crecieron, en las tres fuentes.
 * Con `opts.changed` solo revisa esas rutas; sin el, recorre todas las carpetas.
 * Codex y Gemini se leen solo con la carpeta por defecto (`opts.extra`) y si estan activos en la configuracion.
 */
export function scan(root = PROJECTS_DIR, useCache = true, opts: ScanOptions = {}): ScanResult {
  const ctx = context(root, opts)
  const eng = useCache ? (engine ??= newEngine(loadCache())) : newEngine({ version: CACHE_VERSION, files: {} })
  eng.report = opts.onRead ?? (() => {})
  eng.touched = false
  eng.stale = false
  const sameCtx = eng.key === ctx.key
  if (!sameCtx) {
    eng.key = ctx.key
    eng.merged = null
    eng.result = null
  }
  if (opts.changed && eng.result) changedPass(eng, opts.changed, ctx)
  else fullPass(eng, ctx)
  if (!eng.touched && !eng.stale && eng.result) return eng.result
  if (eng.stale || !eng.merged) eng.merged = buildMerged(eng)
  eng.result = makeResult(eng, ctx)
  if (useCache) saveCache(eng.cache)
  return eng.result
}
