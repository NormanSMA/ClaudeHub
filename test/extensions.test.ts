import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import vm from 'node:vm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

interface Manifest {
  manifest_version: number
  permissions: string[]
  host_permissions: string[]
  background: { service_worker?: string; scripts?: string[] }
  browser_specific_settings?: { gecko?: { id?: string; strict_min_version?: string } }
  action: { default_popup: string; default_icon: Record<string, string> }
  icons: Record<string, string>
}

const ROOT = resolve(__dirname, '..')
const SHARED = join(ROOT, 'safari', 'extension')
const require = createRequire(import.meta.url)
const { buildExtensions } = require(join(ROOT, 'scripts', 'build-extensions.cjs')) as {
  buildExtensions: (outDir?: string) => string[]
}

function readManifest(dir: string): Manifest {
  return JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as Manifest
}

function referencedFiles(m: Manifest): string[] {
  const bg = m.background.service_worker ? [m.background.service_worker] : (m.background.scripts ?? [])
  return [m.action.default_popup, ...Object.values(m.action.default_icon), ...Object.values(m.icons), ...bg]
}

const sources = {
  safari: SHARED,
  chromium: join(ROOT, 'extensions', 'chromium'),
  firefox: join(ROOT, 'extensions', 'firefox'),
}

describe('manifiestos de las extensiones', () => {
  const manifests = Object.entries(sources).map(([name, dir]) => [name, readManifest(dir)] as const)

  it('son JSON valido con manifest_version 3', () => {
    for (const [, m] of manifests) expect(m.manifest_version).toBe(3)
  })

  it('chromium usa service_worker y no scripts', () => {
    const { background } = readManifest(sources.chromium)
    expect(background.service_worker).toBe('background.js')
    expect(background.scripts).toBeUndefined()
  })

  it('firefox declara gecko.id y scripts de fondo', () => {
    const m = readManifest(sources.firefox)
    expect(m.browser_specific_settings?.gecko?.id).toBe('claudehub@normansma.github.io')
    expect(m.browser_specific_settings?.gecko?.strict_min_version).toBe('115.0')
    expect(m.background.scripts).toEqual(['shared.js', 'background.js'])
  })

  it('todos listan los mismos permisos y host_permissions', () => {
    const [first, ...rest] = manifests
    for (const [, m] of rest) {
      expect(m.permissions).toEqual(first[1].permissions)
      expect(m.host_permissions).toEqual(first[1].host_permissions)
    }
  })
})

describe('build-extensions', () => {
  let out: string
  let dirs: string[]

  beforeAll(() => {
    out = mkdtempSync(join(tmpdir(), 'claudehub-ext-'))
    dirs = buildExtensions(out)
  })
  afterAll(() => rmSync(out, { recursive: true, force: true }))

  it('genera chromium y firefox con todos los archivos que mencionan', () => {
    expect(dirs).toEqual([join(out, 'chromium'), join(out, 'firefox')])
    for (const dir of dirs) {
      for (const file of referencedFiles(readManifest(dir))) expect(existsSync(join(dir, file)), `${dir}: ${file}`).toBe(true)
      const html = readFileSync(join(dir, 'popup.html'), 'utf8')
      for (const m of html.matchAll(/(?:src|href)="([\w.]+\.(?:js|css))"/g)) expect(existsSync(join(dir, m[1])), m[1]).toBe(true)
    }
  })

  it('usa el manifiesto de cada navegador y no el de Safari', () => {
    expect(readManifest(dirs[0]).background.service_worker).toBe('background.js')
    expect(readManifest(dirs[1]).background.scripts).toBeDefined()
  })
})

describe('compatibilidad entre navegadores', () => {
  it('background.js y popup.js no usan browser. sin pasar por api', () => {
    for (const file of ['background.js', 'popup.js']) {
      const code = readFileSync(join(SHARED, file), 'utf8')
      expect(code, file).not.toMatch(/(?<![\w.])browser\./)
    }
  })
})

interface Calls {
  badge: string[]
  color: string[]
  title: string[]
}

async function runBackground(fetchImpl: (url: string) => Promise<unknown>) {
  const calls: Calls = { badge: [], color: [], title: [] }
  const chrome = {
    action: {
      setBadgeText: async ({ text }: { text: string }) => void calls.badge.push(text),
      setBadgeBackgroundColor: async ({ color }: { color: string }) => void calls.color.push(color),
      setTitle: async ({ title }: { title: string }) => void calls.title.push(title),
    },
    alarms: { create: () => undefined, onAlarm: { addListener: () => undefined } },
    runtime: { onInstalled: { addListener: () => undefined }, onStartup: { addListener: () => undefined } },
  }
  // Sin "browser" ni "importScripts": el contexto es el de Chromium con shared.js ya cargado.
  const ctx = vm.createContext({ chrome, fetch: fetchImpl })
  for (const file of ['shared.js', 'background.js']) vm.runInContext(readFileSync(join(SHARED, file), 'utf8'), ctx, { filename: file })
  await new Promise((done) => setImmediate(done))
  return calls
}

describe('background.js con chrome simulado', () => {
  it('pone el porcentaje del limite de 5 horas en la insignia', async () => {
    const body = { plan: { fiveHour: { pct: 42.4 } }, alertAt: 0.85 }
    const calls = await runBackground(async () => ({ ok: true, json: async () => body }))
    expect(calls.badge).toEqual(['42'])
    expect(calls.color).toEqual(['#6fa58a'])
    expect(calls.title[0]).toContain('42%')
  })

  it('pone -- cuando no hay servidor', async () => {
    const calls = await runBackground(async () => {
      throw new Error('ECONNREFUSED')
    })
    expect(calls.badge).toEqual(['--'])
    expect(calls.color).toEqual(['#9b978d'])
  })
})
