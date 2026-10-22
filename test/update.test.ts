import { mkdtempSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const dir = mkdtempSync(join(tmpdir(), 'ch-upd-'))
process.env.CLAUDEHUB_DATA = dir
process.env.CLAUDEHUB_CONFIG = join(dir, 'config.json')

const { compareVersions, parseRelease, checkUpdate, getUpdate, manualCheck, resetUpdateState, VERSION } = await import('../src/core/update')
const { saveConfig } = await import('../src/core/config')
const { demoUpdate } = await import('../src/core/demo')

const URL_OK = 'https://github.com/NormanSMA/ClaudeHub/releases/tag/v9.0.0'
const release = (over: Record<string, unknown> = {}) => ({
  tag_name: 'v9.0.0',
  name: 'ClaudeHub 9',
  html_url: URL_OK,
  body: '## Cambios\n- **Nuevo** aviso [docs](http://x.y)\n* Segunda `nota`\n+ Tercera\n- Cuarta\nTexto suelto',
  ...over,
})
const reply = (json: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => json }) as Response)

beforeEach(() => {
  resetUpdateState()
  saveConfig({ checkUpdates: true })
})

describe('compareVersions', () => {
  it('compara x.y.z con o sin v', () => {
    expect(compareVersions('v0.5.0', '0.4.9')).toBeGreaterThan(0)
    expect(compareVersions('0.4.0', 'v0.4.0')).toBe(0)
    expect(compareVersions('0.4.10', '0.4.9')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0', '0.99.99')).toBeGreaterThan(0)
    expect(compareVersions('0.3.0', '0.4.0')).toBeLessThan(0)
  })
})

describe('parseRelease', () => {
  it('lee version, enlace y hasta 3 notas en texto plano', () => {
    const r = parseRelease(release(), '0.4.0')!
    expect(r.latest).toBe('9.0.0')
    expect(r.available).toBe(true)
    expect(r.url).toBe(URL_OK)
    expect(r.notes).toEqual(['Nuevo aviso docs', 'Segunda nota', 'Tercera'])
  })

  it('recorta cada nota a 120 caracteres', () => {
    expect(parseRelease(release({ body: `- ${'a'.repeat(300)}` }), '0.4.0')!.notes[0]).toHaveLength(120)
  })

  it('no hay aviso si la version es igual o menor', () => {
    expect(parseRelease(release({ tag_name: 'v0.4.0' }), '0.4.0')!.available).toBe(false)
    expect(parseRelease(release({ tag_name: 'v0.3.0' }), '0.4.0')!.available).toBe(false)
  })

  it('rechaza enlaces ajenos, borradores y etiquetas invalidas', () => {
    expect(parseRelease(release({ html_url: 'https://evil.example/NormanSMA/ClaudeHub/releases/x' }), '0.4.0')).toBeNull()
    expect(parseRelease(release({ html_url: 'javascript:alert(1)' }), '0.4.0')).toBeNull()
    expect(parseRelease(release({ draft: true }), '0.4.0')).toBeNull()
    expect(parseRelease(release({ tag_name: 'nightly' }), '0.4.0')).toBeNull()
    expect(parseRelease(null, '0.4.0')).toBeNull()
  })
})

describe('checkUpdate', () => {
  it('pide el ultimo release con User-Agent y guarda update.json', async () => {
    const f = reply(release())
    const info = await checkUpdate(f as unknown as typeof fetch)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.github.com/repos/NormanSMA/ClaudeHub/releases/latest')
    expect((init.headers as Record<string, string>)['User-Agent']).toBe(`ClaudeHub/${VERSION}`)
    expect(info.available).toBe(true)
    expect(info.checkedAt).toBeTypeOf('number')
    expect(JSON.parse(readFileSync(join(dir, 'update.json'), 'utf8')).latest).toBe('9.0.0')
    expect(existsSync(join(dir, 'update.json.tmp'))).toBe(false)
  })

  it('un fallo conserva el dato previo y no lanza', async () => {
    await checkUpdate(reply(release()) as unknown as typeof fetch)
    const fail = vi.fn(async () => {
      throw new Error('sin red')
    })
    const info = await checkUpdate(fail as unknown as typeof fetch)
    expect(info.latest).toBe('9.0.0')
    expect((await checkUpdate(reply({}, false) as unknown as typeof fetch)).latest).toBe('9.0.0')
    expect((await checkUpdate(reply({ tag_name: 'x' }) as unknown as typeof fetch)).latest).toBe('9.0.0')
  })

  it('con checkUpdates en false no hace peticiones', async () => {
    saveConfig({ checkUpdates: false })
    const f = reply(release())
    const info = await checkUpdate(f as unknown as typeof fetch)
    expect(f).not.toHaveBeenCalled()
    expect(info).toMatchObject({ enabled: false, available: false, latest: null })
    expect(getUpdate().enabled).toBe(false)
  })

  it('al reiniciar lee el ultimo resultado de update.json', async () => {
    await checkUpdate(reply(release()) as unknown as typeof fetch)
    resetUpdateState()
    expect(getUpdate()).toMatchObject({ enabled: true, latest: '9.0.0', available: true, url: URL_OK })
  })
})

describe('demoUpdate', () => {
  it('sube el menor de la version actual, con enlace valido y 3 notas', () => {
    const d = demoUpdate(1000)
    const [major, minor] = VERSION.split('.').map(Number)
    expect(d.latest).toBe(`${major}.${minor + 1}.0`)
    expect(d.available).toBe(true)
    expect(d.url!.startsWith('https://github.com/NormanSMA/ClaudeHub/releases/')).toBe(true)
    expect(d.notes).toHaveLength(3)
  })
})

describe('manualCheck', () => {
  it('con checkUpdates en false no pide nada y devuelve la version actual', async () => {
    saveConfig({ checkUpdates: false })
    const f = reply(release())
    const out = await manualCheck(f, 1_000)
    expect(out.result).toBe('disabled')
    expect(out.info).toMatchObject({ enabled: false, current: VERSION })
    expect(f).not.toHaveBeenCalled()
  })

  it('marca checked con una respuesta valida y failed sin ella', async () => {
    expect((await manualCheck(reply(release()), 1_000)).result).toBe('checked')
    resetUpdateState()
    expect((await manualCheck(reply({}, false), 1_000)).result).toBe('failed')
  })

  it('permite una consulta por minuto', async () => {
    const f = reply(release())
    await manualCheck(f, 1_000)
    const again = await manualCheck(f, 31_000)
    expect(again).toMatchObject({ result: 'throttled', retryInMs: 30_000 })
    expect(f).toHaveBeenCalledTimes(1)
    expect((await manualCheck(f, 61_000)).result).toBe('checked')
  })
})
