import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, win32 } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { packagedApp } = require('../scripts/launch.cjs') as {
  packagedApp(platform: string, env: Record<string, string | undefined>, exists: (file: string) => boolean): string | null
}

const ROOT = join(__dirname, '..')
const INSTALLED = win32.join('C:\\Users\\ada\\AppData\\Local', 'Programs', 'claudehub', 'ClaudeHub.exe')
const UNPACKED = win32.join(ROOT, 'release', 'win-unpacked', 'ClaudeHub.exe')
const env = { LOCALAPPDATA: 'C:\\Users\\ada\\AppData\\Local' }

describe('lanzador', () => {
  it('prefiere la app instalada a la copia de prueba de release', () => {
    expect(packagedApp('win32', env, () => true)).toBe(INSTALLED)
  })

  it('usa release\\win-unpacked solo si no hay app instalada', () => {
    expect(packagedApp('win32', env, (f) => f === UNPACKED)).toBe(UNPACKED)
    expect(packagedApp('win32', {}, () => true)).toBe(UNPACKED)
  })

  it('sin ejecutable o fuera de Windows usa Electron desde el codigo', () => {
    expect(packagedApp('win32', env, () => false)).toBeNull()
    expect(packagedApp('darwin', env, () => true)).toBeNull()
  })
})

describe('lanzador como hook SessionStart', () => {
  const roots: string[] = []
  afterEach(() => {
    for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true })
  })

  /** Arma <raiz>/scripts/launch.cjs; con `withLib` copia tambien lib/paths.cjs. Nada sale de la carpeta temporal. */
  function sandbox(withLib: boolean): { script: string; root: string } {
    const root = mkdtempSync(join(tmpdir(), 'ch-launch-'))
    roots.push(root)
    mkdirSync(join(root, 'scripts', 'lib'), { recursive: true })
    const script = join(root, 'scripts', 'launch.cjs')
    copyFileSync(join(ROOT, 'scripts', 'launch.cjs'), script)
    if (withLib) copyFileSync(join(ROOT, 'scripts', 'lib', 'paths.cjs'), join(root, 'scripts', 'lib', 'paths.cjs'))
    return { script, root }
  }

  const run = (script: string, root: string) =>
    spawnSync(process.execPath, [script], {
      // LOCALAPPDATA apunta a la carpeta temporal para no encontrar la app instalada de verdad
      env: { ...process.env, CLAUDEHUB_DATA: root, LOCALAPPDATA: root },
      encoding: 'utf8',
      timeout: 10_000,
    })

  it('sale con codigo 0 y sin salida aunque falte lib/paths.cjs', () => {
    const { script, root } = sandbox(false)
    const r = run(script, root)
    expect(r.status).toBe(0)
    expect(r.stdout).toBe('')
    expect(r.stderr).toBe('')
  })

  it('sale con codigo 0 y sin salida si el ejecutable no se puede lanzar', () => {
    const { script, root } = sandbox(true)
    // electron falso: apunta a un ejecutable que no existe, asi spawn emite 'error' de forma asincrona
    mkdirSync(join(root, 'node_modules', 'electron'), { recursive: true })
    writeFileSync(join(root, 'node_modules', 'electron', 'index.js'), `module.exports = ${JSON.stringify(join(root, 'no-existe', 'electron'))}\n`)
    const r = run(script, root)
    expect(r.status).toBe(0)
    expect(r.stdout).toBe('')
    expect(r.stderr).toBe('')
  })
})
