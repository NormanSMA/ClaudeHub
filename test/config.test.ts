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

  it('devuelve los valores por defecto con entradas invalidas', () => {
    expect(sanitize(null)).toEqual(DEFAULTS)
    expect(sanitize('texto')).toEqual(DEFAULTS)
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
    const d = dataDir()
    expect(d.endsWith('ClaudeHub')).toBe(true)
    process.env.CLAUDEHUB_DATA = '/tmp/ch'
    expect(dataDir()).toBe('/tmp/ch')
    delete process.env.CLAUDEHUB_DATA
  })
})
