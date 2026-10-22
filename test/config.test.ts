import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { projectFromDir } from '../src/core/parse'
import { dataDir } from '../src/core/paths'

const dir = mkdtempSync(join(tmpdir(), 'ch-cfg-'))
const file = join(dir, 'config.json')
process.env.CLAUDEHUB_CONFIG = file

// se importa despues de fijar la variable: la ruta se lee al cargar el modulo
const { sanitize, saveConfig, config, DEFAULTS } = await import('../src/core/config')

afterAll(() => {
  delete process.env.CLAUDEHUB_CONFIG
})

describe('configuracion', () => {
  it('descarta campos desconocidos y acota valores', () => {
    const c = sanitize({
      name: '  Ada<script>  ',
      alertAt: 5,
      activeMinutes: 99999,
      contextLimits: { 'Opus 5': 1_000_000, malo: -1, enorme: 9e12, texto: 'x' },
      otro: 'ignorado',
    })
    expect(c.name).toBe('Adascript')
    expect(c.alertAt).toBe(0.99)
    expect(sanitize({ alertAt: 0.1 }).alertAt).toBe(0.5)
    expect(c.activeMinutes).toBe(240)
    expect(c.contextLimits).toEqual({ 'Opus 5': 1_000_000 })
    expect('otro' in c).toBe(false)
  })

  it('checkUpdates es true por defecto y solo acepta booleanos', () => {
    expect(sanitize({}).checkUpdates).toBe(true)
    expect(sanitize({ checkUpdates: false }).checkUpdates).toBe(false)
    expect(sanitize({ checkUpdates: 'no' }).checkUpdates).toBe(true)
  })

  it('devuelve los valores por defecto con entradas invalidas', () => {
    expect(sanitize(null)).toEqual(DEFAULTS)
    expect(sanitize('texto')).toEqual(DEFAULTS)
  })

  it('valida la modalidad de facturacion', () => {
    expect(sanitize({}).billing).toBe('subscription')
    expect(sanitize({ billing: 'api' }).billing).toBe('api')
    expect(sanitize({ billing: 'subscription' }).billing).toBe('subscription')
    expect(sanitize({ billing: 'otro' }).billing).toBe('subscription')
    expect(sanitize({ billing: false }).billing).toBe('subscription')
  })

  it('acepta tarifas parciales entre cero y mil y descarta otros campos', () => {
    expect(sanitize({ pricing: { overrides: { 'Opus 5': { input: 0, output: 1000, otro: 4 } }, freeProviders: ['local'] } }).pricing)
      .toEqual({ overrides: { 'Opus 5': { input: 0, output: 1000 } }, freeProviders: ['local'] })
  })

  it.each([-1, 1000.01, NaN, Infinity, -Infinity, '3', null, true])('rechaza la tarifa invalida %s', (value) => {
    const overrides = { 'Opus 5': { input: value, output: value, cacheWrite: value, cacheWrite1h: value, cacheRead: value } }
    expect(sanitize({ pricing: { overrides } }).pricing.overrides).toEqual({})
  })

  it('conserva solamente los campos validos de cada tarifa', () => {
    expect(sanitize({ pricing: { overrides: { 'Opus 5': { input: 5, output: -1, cacheWrite1h: 10 } } } }).pricing.overrides)
      .toEqual({ 'Opus 5': { input: 5, cacheWrite1h: 10 } })
  })

  it('limita los modelos, proveedores y textos de precios', () => {
    const overrides = Object.fromEntries(Array.from({ length: 55 }, (_, i) => [`Modelo ${i}`, { input: 1 }]))
    const freeProviders = Array.from({ length: 55 }, (_, i) => `Proveedor ${i}`)
    const pricing = sanitize({ pricing: { overrides, freeProviders } }).pricing
    expect(Object.keys(pricing.overrides)).toHaveLength(50)
    expect(pricing.freeProviders).toHaveLength(50)
    const valid = 'a'.repeat(80)
    const invalid = 'a'.repeat(81)
    expect(sanitize({ pricing: {
      overrides: { [valid]: { input: 1 }, [invalid]: { input: 2 } },
      freeProviders: [valid, invalid, '', 3],
    } }).pricing).toEqual({ overrides: { [valid]: { input: 1 } }, freeProviders: [valid] })
  })

  it.each([null, 'texto', [], { overrides: [], freeProviders: 'local' }, { overrides: { modelo: [1] } }])(
    'descarta estructuras de precios invalidas: %s', (pricing) => {
      expect(sanitize({ pricing }).pricing).toEqual(DEFAULTS.pricing)
    },
  )

  it('guarda precios y modalidad y los recupera con config()', () => {
    const pricing = { overrides: { 'Opus 5': { input: 4, cacheRead: 0 } }, freeProviders: ['local'] }
    const saved = saveConfig({ pricing, billing: 'api' })
    expect(saved.pricing).toEqual(pricing)
    expect(config().pricing).toEqual(pricing)
    expect(config().billing).toBe('api')
    expect(JSON.parse(readFileSync(file, 'utf8')).pricing).toEqual(pricing)
  })

  it('en modo demo ignora el archivo del usuario', async () => {
    saveConfig({ name: 'Privado', alertAt: 0.6 })
    // instancia nueva del modulo: no contamina las demas pruebas
    vi.resetModules()
    const isolated = await import('../src/core/config')
    expect(isolated.config().name).toBe('Privado')
    isolated.useDefaultsOnly()
    expect(isolated.config().name).toBe('')
    expect(isolated.config().alertAt).toBe(0.85)
  })

  it('guarda de forma atomica y config() lo lee de vuelta', () => {
    const saved = saveConfig({ name: 'Norman', alertAt: 0.9, activeMinutes: 30, contextLimits: { 'Sonnet 5.5': 200_000 } })
    expect(saved.alertAt).toBe(0.9)
    expect(JSON.parse(readFileSync(file, 'utf8')).name).toBe('Norman')
    expect(existsSync(`${file}.tmp`)).toBe(false)
    expect(config().contextLimits['Sonnet 5.5']).toBe(200_000)
  })

  it('guarda sources completo y conserva las otras fuentes al alternar OmniRoute', () => {
    const sources = { codex: false, gemini: true, omniroute: true }
    expect(saveConfig({ sources }).sources).toEqual(sources)
    expect(JSON.parse(readFileSync(file, 'utf8')).sources).toEqual(sources)
    expect(config().sources).toEqual(sources)
    const disabled = { ...sources, omniroute: false }
    expect(saveConfig({ sources: disabled }).sources).toEqual(disabled)
    expect(JSON.parse(readFileSync(file, 'utf8')).sources).toEqual(disabled)
    expect(config().sources).toEqual(disabled)
  })
})

describe('rutas y nombres de proyecto', () => {
  it('nombra proyectos de Windows, macOS y Linux', () => {
    expect(projectFromDir('C--Proyectos-mi-app')).toBe('mi-app')
    expect(projectFromDir('C--Users-ada-dev-tool')).toBe('tool')
    expect(projectFromDir('-home-ada-proyectos-mi-app')).toBe('mi-app')
    expect(projectFromDir('-Users-ada-code-blog')).toBe('blog')
    expect(projectFromDir('C--Proyectos-app--claude-worktrees-x1')).toBe('app')
    expect(projectFromDir('C--Users-ada-AppData-Roaming-Claude-scratch-abc')).toBe('scratch')
  })

  it('usa una carpeta de datos propia de cada sistema', () => {
    // test/setup.ts fija CLAUDEHUB_DATA: se quita para ver la ruta por defecto y se restaura
    const prev = process.env.CLAUDEHUB_DATA
    delete process.env.CLAUDEHUB_DATA
    try {
      expect(dataDir().endsWith('ClaudeHub')).toBe(true)
      process.env.CLAUDEHUB_DATA = '/tmp/ch'
      expect(dataDir()).toBe('/tmp/ch')
    } finally {
      process.env.CLAUDEHUB_DATA = prev
    }
  })
})
