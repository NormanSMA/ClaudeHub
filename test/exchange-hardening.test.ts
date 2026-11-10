import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { readExchangeFile } from '../src/core/paths'
import { readPlanRaw } from '../src/core/plan'
import { mergeWindows } from '../src/core/windows'

const root = mkdtempSync(join(tmpdir(), 'ch-hard-'))
let n = 0
const folder = (): string => {
  const d = join(root, 'd' + n++)
  mkdirSync(d)
  return d
}

afterAll(() => rmSync(root, { recursive: true, force: true }))

const plan = (updatedAt: number, pct: number) => JSON.stringify({ fiveHour: { pct, resetsAt: 9e12 }, sevenDay: null, updatedAt })

describe('archivos de intercambio no confiables', () => {
  it('rechaza un archivo de mas de 1 MiB', () => {
    const dir = folder()
    const file = join(dir, 'rate-limits.json')
    writeFileSync(file, JSON.stringify({ updatedAt: 1, relleno: 'x'.repeat(1024 * 1024) }))
    expect(() => readExchangeFile(file)).toThrow()
    expect(readPlanRaw([dir])).toBeNull()
    writeFileSync(join(dir, 'context-windows.json'), JSON.stringify({ s1: { size: 200_000, ts: 1, relleno: 'x'.repeat(1024 * 1024) } }))
    expect(mergeWindows([dir])).toEqual({})
  })

  it('un updatedAt futuro no gana a los datos reales', () => {
    const real = folder()
    const planted = folder()
    const now = Date.now()
    writeFileSync(join(real, 'rate-limits.json'), plan(now - 5_000, 22))
    writeFileSync(join(planted, 'rate-limits.json'), plan(now + 3_600_000, 1))
    expect(readPlanRaw([planted, real])?.fiveHour?.pct).toBe(22)
    // un desfase de reloj pequeno se tolera
    writeFileSync(join(planted, 'rate-limits.json'), plan(now + 10_000, 7))
    expect(readPlanRaw([planted, real])?.fiveHour?.pct).toBe(7)
  })

  it('ignora ids de sesion que tocarian el prototipo', () => {
    const dir = folder()
    writeFileSync(
      join(dir, 'context-windows.json'),
      '{"__proto__":{"size":999999,"ts":5},"constructor":{"size":999999,"ts":5},"s1":{"size":200000,"ts":5}}',
    )
    const merged = mergeWindows([dir])
    expect(Object.keys(merged)).toEqual(['s1'])
    expect(({} as Record<string, unknown>).size).toBeUndefined()
  })
})
