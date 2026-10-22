import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { dayKey, filterRange, live, summary } from '../src/core/aggregate'
import type { Rec } from '../src/core/types'

// Nueva York: el horario de verano termina el 1 de noviembre de 2026
const ORIGINAL_TZ = process.env.TZ
beforeAll(() => {
  process.env.TZ = 'America/New_York'
})
afterAll(() => {
  process.env.TZ = ORIGINAL_TZ
})

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime()

const rec = (ts: number): Rec => ({
  id: String(ts),
  ts,
  model: 'claude-opus-5-5',
  input: 1,
  cacheWrite: 0,
  cacheRead: 0,
  output: 1,
  session: 's',
  project: 'p',
  role: 'orchestrator',
})

describe('rangos por calendario local', () => {
  it('hoy empieza a la medianoche local', () => {
    const now = local(2026, 10, 22, 0, 15)
    const out = live([rec(local(2026, 10, 21, 23, 59)), rec(local(2026, 10, 22, 0, 1))], now)
    expect(out.todayMessages).toBe(1)
    expect(dayKey(local(2026, 10, 22, 0, 1))).toBe('2026-10-22')
  })

  it('7d cruza el fin del horario de verano sin perder ni ganar una hora', () => {
    const now = local(2026, 11, 3, 12)
    const inside = rec(local(2026, 10, 28, 0, 1))
    const outside = rec(local(2026, 10, 27, 23, 30))
    expect(filterRange([inside, outside], '7d', now)).toEqual([inside])
  })

  it('30d cruza el fin del horario de verano', () => {
    const now = local(2026, 11, 20, 12)
    const inside = rec(local(2026, 10, 22, 0, 1))
    const outside = rec(local(2026, 10, 21, 23, 30))
    expect(filterRange([inside, outside], '30d', now)).toEqual([inside])
  })

  it('el heatmap no repite ni salta dias con cambio de horario', () => {
    const heat = summary([], 'all', local(2026, 11, 3, 12)).heatmap
    const days = heat.map((h) => h.day)
    expect(days).toHaveLength(28 * 7)
    expect(new Set(days).size).toBe(days.length)
    expect(days[0]).toBe('2026-04-27') // lunes, 28 semanas antes
    expect(days.at(-1)).toBe('2026-11-08') // domingo de la semana actual
    expect(days).toContain('2026-11-01')
  })
})
