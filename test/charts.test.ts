import { describe, expect, it } from 'vitest'
import { categorySegments } from '../src/web/components/charts'

const sum = (t: Parameters<typeof categorySegments>[0]) => categorySegments(t).reduce((a, s) => a + s.value, 0)
const get = (t: Parameters<typeof categorySegments>[0], key: string) => categorySegments(t).find((s) => s.key === key)!.value

describe('categorySegments', () => {
  it('sin reasoning: la salida completa y pensamiento en 0', () => {
    const t = { input: 10, cacheWrite: 20, cacheRead: 300, output: 40, total: 370 }
    expect(sum(t)).toBe(t.total)
    expect(get(t, 'output')).toBe(40)
    expect(get(t, 'reasoning')).toBe(0)
  })

  it('con reasoning: lo descuenta de la salida visible sin doble conteo', () => {
    const t = { input: 10, cacheWrite: 20, cacheRead: 300, output: 40, total: 370, reasoning: 15 }
    expect(sum(t)).toBe(t.total)
    expect(get(t, 'output')).toBe(25)
    expect(get(t, 'reasoning')).toBe(15)
  })

  it('reasoning mayor que la salida no rompe la suma ni da negativos', () => {
    const t = { input: 1, cacheWrite: 2, cacheRead: 3, output: 5, total: 11, reasoning: 9 }
    expect(sum(t)).toBe(t.total)
    expect(categorySegments(t).every((s) => s.value >= 0)).toBe(true)
  })
})
