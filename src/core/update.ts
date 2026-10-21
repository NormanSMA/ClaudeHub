import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import pkg from '../../package.json'
import { config } from './config'
import { dataDir } from './paths'

/** Misma forma que UpdateInfo de src/web/api.ts. */
export interface UpdateInfo {
  enabled: boolean
  current: string
  latest: string | null
  available: boolean
  url: string | null
  name: string | null
  /** hasta 3 cambios en texto plano */
  notes: string[]
  checkedAt: number | null
}

export const VERSION: string = pkg.version
export const RELEASES_PREFIX = 'https://github.com/NormanSMA/ClaudeHub/releases/'
const API_URL = 'https://api.github.com/repos/NormanSMA/ClaudeHub/releases/latest'
const EVERY_MS = 6 * 3_600_000
const TIMEOUT_MS = 5_000

const parts = (v: string): number[] => {
  const m = String(v).trim().match(/^v?(\d+)\.(\d+)\.(\d+)/i)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0]
}

/** Compara x.y.z con o sin "v". Devuelve negativo, 0 o positivo. */
export function compareVersions(a: string, b: string): number {
  const x = parts(a)
  const y = parts(b)
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]
  return 0
}

const empty = (enabled: boolean, current = VERSION): UpdateInfo => ({
  enabled,
  current,
  latest: null,
  available: false,
  url: null,
  name: null,
  notes: [],
  checkedAt: null,
})

/** Hasta 3 vinetas del cuerpo en texto plano, de 120 caracteres como maximo. */
function notesOf(body: unknown): string[] {
  if (typeof body !== 'string') return []
  const out: string[] = []
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^\s*[-*+]\s+(.+)$/)
    if (!m) continue
    const text = m[1]
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[`*~]/g, '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f<]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120)
    if (text) out.push(text)
    if (out.length === 3) break
  }
  return out
}

/** Valida la respuesta de GitHub. Devuelve null si no es un release publico valido de este repositorio. */
export function parseRelease(json: unknown, current: string = VERSION): UpdateInfo | null {
  if (!json || typeof json !== 'object') return null
  const r = json as Record<string, unknown>
  if (r.draft === true || r.prerelease === true) return null
  const tag = typeof r.tag_name === 'string' ? r.tag_name.trim() : ''
  if (!/^v?\d+\.\d+\.\d+$/i.test(tag)) return null
  if (typeof r.html_url !== 'string' || !r.html_url.startsWith(RELEASES_PREFIX)) return null
  const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 80) : null
  return {
    enabled: true,
    current,
    latest: tag.replace(/^v/i, ''),
    available: compareVersions(tag, current) > 0,
    url: r.html_url,
    name,
    notes: notesOf(r.body),
    checkedAt: null,
  }
}

const file = () => join(dataDir(), 'update.json')

let last: UpdateInfo | null = null
let loaded = false

function load(): void {
  if (loaded) return
  loaded = true
  try {
    const v = JSON.parse(readFileSync(file(), 'utf8')) as Record<string, unknown>
    // se revalida: el archivo es editable por el usuario
    if (typeof v.latest === 'string' && /^\d+\.\d+\.\d+$/.test(v.latest) && typeof v.url === 'string' && v.url.startsWith(RELEASES_PREFIX)) {
      const notes = Array.isArray(v.notes) ? v.notes.filter((n): n is string => typeof n === 'string') : []
      last = {
        ...empty(true),
        latest: v.latest,
        url: v.url,
        name: typeof v.name === 'string' ? v.name.slice(0, 80) : null,
        notes: notes.slice(0, 3).map((n) => n.slice(0, 120)),
        checkedAt: typeof v.checkedAt === 'number' ? v.checkedAt : null,
      }
    }
  } catch {
    /* sin archivo o invalido: sin dato previo */
  }
}

function save(info: UpdateInfo): void {
  try {
    mkdirSync(dataDir(), { recursive: true })
    const tmp = `${file()}.tmp`
    writeFileSync(tmp, JSON.stringify(info) + '\n')
    renameSync(tmp, file())
  } catch {
    /* el dato queda solo en memoria */
  }
}

/** Ultimo resultado conocido. Con la opcion apagada no hay datos de release. */
export function getUpdate(): UpdateInfo {
  if (!config().checkUpdates) return empty(false)
  load()
  if (!last) return empty(true)
  return { ...last, current: VERSION, available: !!last.latest && compareVersions(last.latest, VERSION) > 0 }
}

/** Consulta GitHub Releases. Con checkUpdates en false no hace ninguna peticion. Un fallo conserva el dato previo y no lanza. */
export async function checkUpdate(doFetch: typeof fetch = fetch): Promise<UpdateInfo> {
  if (!config().checkUpdates) return getUpdate()
  try {
    const res = await doFetch(API_URL, {
      headers: { 'User-Agent': `ClaudeHub/${VERSION}`, Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return getUpdate()
    const info = parseRelease(await res.json(), VERSION)
    if (info) {
      load()
      last = { ...info, checkedAt: Date.now() }
      save(last)
    }
  } catch {
    /* sin red, tiempo agotado o JSON invalido */
  }
  return getUpdate()
}

/** Revisa ahora y cada 6 h. El interruptor se lee en cada vuelta. */
export function startUpdateChecks(): () => void {
  void checkUpdate()
  const t = setInterval(() => void checkUpdate(), EVERY_MS)
  t.unref()
  return () => clearInterval(t)
}

/** Solo para pruebas: olvida el dato en memoria. */
export function resetUpdateState(): void {
  last = null
  loaded = false
}
