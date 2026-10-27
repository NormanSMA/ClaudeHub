import { createRequire } from 'node:module'
import { join, win32 } from 'node:path'
import { describe, expect, it } from 'vitest'

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
