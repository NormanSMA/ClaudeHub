import { readFileSync, existsSync, openSync, readSync, closeSync, fstatSync } from 'node:fs'
import { basename, sep } from 'node:path'
import { preferLimitHit, type Rec, type SessionMeta } from './types'

/** Compara versiones "2.1.321" por numeros. true si `a` es mayor que `b` o `b` falta. */
export function newerVersion(a: string, b: string | undefined): boolean {
  if (!/^\d+(\.\d+)*$/.test(a)) return false
  if (!b) return true
  const x = a.split('.').map(Number)
  const y = b.split('.').map(Number)
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d !== 0) return d > 0
  }
  return false
}

export function projectFromDir(dir: string): string {
  // Claude Code nombra la carpeta con la ruta del proyecto: "C--Proyectos-mi-app" = C:\Proyectos\mi-app
  const name = dir
    .replace(/--claude-worktrees-.*$/, '')
    .replace(/^.*AppData-Roaming-Claude-scratch.*$/, 'scratch')
    .replace(/^[A-Za-z]--(Users-[^-]+-)?/, '')
    .replace(/^-(?:home|Users)-[^-]+-/, '') // macOS y Linux: "-home-ada-mi-app"
    .replace(/^(Proyectos|Projects|Documentos|Documents|dev|repos|src|code)-/i, '')
  return name || dir
}

interface FileInfo {
  project: string
  session: string
  role: Rec['role']
  agent?: string
  agentFile?: string
}

export function describeFile(path: string): FileInfo {
  const parts = path.split(sep)
  const i = parts.lastIndexOf('projects')
  const project = projectFromDir(parts[i + 1] ?? 'unknown')
  const subIdx = parts.lastIndexOf('subagents')
  if (subIdx > 0) {
    let agent = 'subagent'
    const meta = path.replace(/\.jsonl$/, '.meta.json')
    if (existsSync(meta)) {
      try {
        agent = JSON.parse(readFileSync(meta, 'utf8')).agentType ?? agent
      } catch {
        /* meta invalido: se usa la etiqueta por defecto */
      }
    }
    return { project, session: parts[subIdx - 1], role: 'subagent', agent, agentFile: basename(path, '.jsonl') }
  }
  return { project, session: basename(path, '.jsonl'), role: 'orchestrator' }
}

export interface ParsedFile {
  recs: Rec[]
  meta: SessionMeta
  /** bytes ya consumidos (hasta la ultima linea completa) */
  offset: number
}

const CHUNK = 8 * 1024 * 1024

/**
 * Lee un .jsonl desde `prior.offset`. Devuelve un registro por message.id (el de mayor output)
 * y los metadatos del chat. Lee en bloques para no cargar archivos de cientos de MB.
 */
export function parseFile(path: string, prior?: ParsedFile): ParsedFile {
  const info = describeFile(path)
  const byId = new Map<string, Rec>((prior?.recs ?? []).map((r) => [r.id, r]))
  const meta: SessionMeta = { ...(prior?.meta ?? {}) }
  let offset = prior?.offset ?? 0
  let fd: number
  try {
    fd = openSync(path, 'r')
  } catch {
    return { recs: [...byId.values()], meta, offset }
  }
  try {
    const end = fstatSync(fd).size
    const buf = Buffer.allocUnsafe(Math.min(CHUNK, Math.max(1, end - offset)))
    let pos = offset
    let carry: Buffer = Buffer.alloc(0)
    while (pos < end) {
      const n = readSync(fd, buf, 0, Math.min(buf.length, end - pos), pos)
      if (n <= 0) break
      pos += n
      const chunk = carry.length ? Buffer.concat([carry, buf.subarray(0, n)]) : Buffer.from(buf.subarray(0, n))
      const nl = chunk.lastIndexOf(10)
      if (nl < 0) {
        carry = chunk
        continue
      }
      consume(chunk.subarray(0, nl).toString('utf8'), info, byId, meta)
      carry = chunk.subarray(nl + 1)
    }
    // ultima linea sin salto de linea: se consume solo si ya es JSON completo
    if (carry.length) {
      const tail = carry.toString('utf8')
      try {
        JSON.parse(tail)
        consume(tail, info, byId, meta)
        carry = Buffer.alloc(0)
      } catch {
        /* linea a medio escribir: se relee en el siguiente scan */
      }
    }
    offset = pos - carry.length
  } finally {
    closeSync(fd)
  }
  return { recs: [...byId.values()], meta, offset }
}

function consume(text: string, info: FileInfo, byId: Map<string, Rec>, meta: SessionMeta): void {
  for (const line of text.split('\n')) {
    const isUsage = line.includes('"usage"')
    const isTitle = line.includes('"custom-title"')
    const isPrompt = line.includes('"last-prompt"')
    const isQuota = line.includes('"quotaLimits"')
    if (!isUsage && !isTitle && !isPrompt && !isQuota) continue
    let o: any
    try {
      o = JSON.parse(line)
    } catch {
      // una linea de uso del asistente que no es JSON valido es un registro perdido
      if (isUsage && line.includes('"type":"assistant"')) meta.skipped = (meta.skipped ?? 0) + 1
      continue
    }
    if (typeof o.version === 'string' && newerVersion(o.version, meta.cliVersion)) meta.cliVersion = o.version
    // limite del plan alcanzado (error 429): gana el rechazado y, entre iguales, el que reinicia mas tarde
    const q = o.quotaLimits
    if (q && typeof q.resetsAt === 'number' && typeof q.rateLimitType === 'string') {
      const ts = Date.parse(o.timestamp)
      const hit = { ts: Number.isNaN(ts) ? 0 : ts, resetsAt: q.resetsAt * 1000, type: q.rateLimitType, status: String(q.status ?? '') }
      meta.limitHit = preferLimitHit(meta.limitHit, hit)
      continue
    }
    if (o.type === 'custom-title' && typeof o.customTitle === 'string') {
      meta.title = o.customTitle
      continue
    }
    if (o.type === 'last-prompt' && typeof o.lastPrompt === 'string') {
      meta.lastPrompt = o.lastPrompt
      continue
    }
    if (typeof o.cwd === 'string') meta.cwd = o.cwd
    const msg = o?.message
    const u = msg?.usage
    if (o.type !== 'assistant' || !u || msg.model === '<synthetic>') continue
    const ts = Date.parse(o.timestamp)
    // con uso pero sin id, modelo o fecha no se puede contar ni deduplicar: se anota como descartada
    if (!msg.id || !msg.model || Number.isNaN(ts)) {
      meta.skipped = (meta.skipped ?? 0) + 1
      continue
    }
    const rec: Rec = {
      id: msg.id,
      ts,
      model: msg.model,
      input: u.input_tokens ?? 0,
      cacheWrite: u.cache_creation_input_tokens ?? 0,
      cacheRead: u.cache_read_input_tokens ?? 0,
      output: u.output_tokens ?? 0,
      session: info.session,
      project: info.project,
      role: o.isSidechain ? 'subagent' : info.role,
      agent: info.agent,
      agentFile: info.agentFile,
    }
    const cacheWrite1h = u.cache_creation?.ephemeral_1h_input_tokens
    if (typeof cacheWrite1h === 'number' && cacheWrite1h > 0) rec.cacheWrite1h = cacheWrite1h
    if (u.speed === 'fast') rec.speed = 'fast'
    const prev = byId.get(rec.id)
    if (!prev || rec.output >= prev.output) byId.set(rec.id, rec)
  }
}
