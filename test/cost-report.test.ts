import { beforeEach, describe, it, expect, vi } from 'vitest'
import { breakdown, live, modelsReport, projectsReport, rolesReport, sessionsReport, summary } from '../src/core/aggregate'
import { config, DEFAULTS } from '../src/core/config'
import { demoData } from '../src/core/demo'
import { costOf, costParts, priceOf } from '../src/core/pricing'
import { sourceOf, total, type Rec } from '../src/core/types'

vi.mock('../src/core/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/core/config')>()
  return { ...actual, config: vi.fn() }
})

// Datos sinteticos y calendario local para comprobar el costo de hoy.
const NOW = new Date(2026, 9, 22, 12).getTime()
const DAY = 86_400_000
const rec = (over: Partial<Rec> = {}): Rec => ({
  id: 'r', ts: NOW, model: 'claude-opus-5-5', input: 1000, output: 100,
  cacheWrite: 200, cacheWrite1h: 50, cacheRead: 500,
  session: 's1', project: 'p1', role: 'orchestrator', ...over,
})

beforeEach(() => {
  vi.mocked(config).mockReturnValue({ ...DEFAULTS, pricing: { overrides: {}, freeProviders: [] } })
})

describe('costParts', () => {
  it('calcula costo y ahorro neto con las dos duraciones de escritura', () => {
    const r = rec()
    const parts = costParts(r)
    expect(parts.costUsd).toBeCloseTo((1000 * 4 + 100 * 20 + 150 * 5 + 50 * 8 + 500 * 0.2) / 1e6)
    expect(parts.cacheSavingsUsd).toBeCloseTo((500 * 3.8 - 150 - 50 * 4) / 1e6)
    expect(parts.unpricedTokens).toBe(0)
    expect(parts.freeSavingsUsd).toBe(0)
    expect(parts.costUsd).toBe(costOf(r))
  })

  it('devuelve ahorro cero sin lectura ni escritura de cache', () => {
    expect(costParts(rec({ cacheWrite: 0, cacheWrite1h: 0, cacheRead: 0 })).cacheSavingsUsd).toBe(0)
  })

  it('conserva el ahorro negativo cuando solo hay escritura', () => {
    const r = rec({ input: 0, output: 0, cacheWrite: 1_000_000, cacheWrite1h: 200_000, cacheRead: 0 })
    expect(costParts(r).costUsd).toBeCloseTo(5.6)
    expect(costParts(r).cacheSavingsUsd).toBeCloseTo(-1.6)
  })

  it('acota la escritura de una hora al total de escritura', () => {
    const parts = costParts(rec({ input: 0, output: 0, cacheWrite: 100, cacheWrite1h: 200, cacheRead: 0 }))
    expect(parts.costUsd).toBeCloseTo(100 * 8 / 1e6)
    expect(parts.cacheSavingsUsd).toBeCloseTo(-100 * 4 / 1e6)
  })

  it('cuenta tokens sin tarifa sin sumar dolares ni ahorros', () => {
    const r = rec({ model: 'modelo-sin-tarifa', reasoning: 30 })
    expect(costParts(r)).toEqual({ costUsd: 0, unpricedTokens: total(r), cacheSavingsUsd: 0, freeSavingsUsd: 0 })
    expect(costOf(r)).toBeNull()
    expect(costParts({ ...r, source: 'omniroute', project: 'gratis' }, {}, ['gratis'])).toEqual(costParts(r))
  })

  it('aplica ajustes sin memorizar sus valores', () => {
    const r = rec({ cacheWrite: 0, cacheRead: 0 })
    expect(costParts(r, { 'Opus 5.5': { input: 10 } }).costUsd).toBeCloseTo(0.012)
    expect(costParts(r, { 'Opus 5.5': { input: 20 } }).costUsd).toBeCloseTo(0.022)
    expect(costParts(r).costUsd).toBeCloseTo(0.006)
  })

  it('recalcula el tramo por volumen aunque la regla este memorizada', () => {
    const r = rec({ model: 'claude-haiku-5-5', input: 100_000, output: 0, cacheWrite: 0, cacheRead: 0 })
    expect(costParts(r).costUsd).toBeCloseTo(0.01)
    expect(costParts({ ...r, input: 100_001 }).costUsd).toBeCloseTo(100_001 * 0.5 / 1e6)
    expect(costParts(r).costUsd).toBeCloseTo(0.01)
  })

  it('recalcula la tarifa temporal aunque la regla este memorizada', () => {
    const model = 'gemini-3.8-flash'
    const end = Date.UTC(2027, 0, 1)
    expect(priceOf(model, undefined, 0, end)?.input).toBe(1.5)
    expect(priceOf(model, undefined, 0, end - 1)?.input).toBe(0.75)
    expect(priceOf(model, undefined, 0, end)?.input).toBe(1.5)
  })

  it('normaliza el id antes de resolver la regla', () => {
    expect(costParts(rec({ model: 'CLAUDE-OPUS-5-5-20261022' }))).toEqual(costParts(rec()))
  })

  it('separa el costo de lista de un proveedor gratuito de OmniRoute', () => {
    const r = rec({ source: 'omniroute', project: 'gratis' })
    const paid = costParts(r)
    expect(costParts(r, {}, ['gratis'])).toEqual({
      ...paid, costUsd: 0, freeSavingsUsd: paid.costUsd,
    })
  })

  it.each([undefined, 'claude', 'codex', 'gemini'] as const)(
    'mantiene el costo de %s aunque el proyecto coincida con un proveedor gratuito', (source) => {
      const r = rec({ source, project: 'gratis' })
      expect(costParts(r, {}, ['gratis'])).toEqual(costParts(r))
    },
  )
})

describe('costo en reportes', () => {
  const rows = () => [
    rec(),
    rec({ id: 'r2', session: 's2', project: 'p2', role: 'subagent', agent: 'Explore', model: 'claude-sonnet-5' }),
    rec({ id: 'r3', session: 's2', project: 'p2', source: 'codex', model: 'gpt-6.1-sol' }),
    rec({ id: 'r4', session: 's3', project: 'gratis', source: 'omniroute' }),
    rec({ id: 'r5', model: 'modelo-sin-tarifa' }),
    rec({ id: 'antiguo', ts: NOW - 40 * DAY }),
  ]
  const sumCost = (rows: { costUsd: number }[]) => rows.reduce((sum, r) => sum + r.costUsd, 0)
  const sumSavings = (rows: { cacheSavingsUsd: number }[]) => rows.reduce((sum, r) => sum + r.cacheSavingsUsd, 0)

  beforeEach(() => {
    vi.mocked(config).mockReturnValue({
      ...DEFAULTS, pricing: { overrides: { 'Opus 5.5': { input: 10 } }, freeProviders: ['gratis'] },
    })
  })

  it.each(['all', '7d', '30d', { from: NOW - DAY, to: NOW }] as const)(
    'conserva costo y ahorro entre modelos, sesiones, proyectos y roles para %j', (range) => {
      const recs = rows()
      const models = modelsReport(recs, range, NOW).models
      const sessions = sessionsReport(recs, new Map(), range, 100, NOW)
      const projects = projectsReport(recs, range, NOW)
      const totals = summary(recs, range, NOW).tokens
      const roles = rolesReport(recs, range, NOW)
      const selected = range === 'all' ? recs : recs.filter((r) => r.id !== 'antiguo')
      const expectedCost = selected.reduce((sum, r) => sum + costParts(r, config().pricing.overrides, ['gratis']).costUsd, 0)
      expect(sumCost(models)).toBeCloseTo(expectedCost)
      expect(sumCost(sessions)).toBeCloseTo(expectedCost)
      expect(sumCost(projects)).toBeCloseTo(expectedCost)
      expect(totals.costUsd).toBeCloseTo(expectedCost)
      expect(roles.orchestrator.costUsd + roles.subagent.costUsd).toBeCloseTo(expectedCost)
      expect(sumCost(roles.agents)).toBeCloseTo(roles.subagent.costUsd)
      expect(sumSavings(sessions)).toBeCloseTo(totals.cacheSavingsUsd)
      expect(sumSavings(projects)).toBeCloseTo(totals.cacheSavingsUsd)
      expect(sumSavings(models)).toBeCloseTo(totals.cacheSavingsUsd)
      expect(totals.freeSavingsUsd).toBeCloseTo(costParts(recs[3], config().pricing.overrides).costUsd)
      expect(roles.orchestrator.freeSavingsUsd).toBeCloseTo(totals.freeSavingsUsd)
    },
  )

  it('expone tokens sin tarifa en resumen, modelos y roles', () => {
    const r = rec({ model: 'modelo-sin-tarifa' })
    const expected = { costUsd: 0, costUnpriced: total(r), cacheSavingsUsd: 0, freeSavingsUsd: 0 }
    expect(summary([r], 'all', NOW).tokens).toMatchObject(expected)
    expect(modelsReport([r], 'all', NOW).models[0]).toMatchObject(expected)
    expect(rolesReport([r], 'all', NOW).orchestrator).toMatchObject(expected)
    expect(breakdown([])).toMatchObject({ ...expected, costUnpriced: 0 })
  })

  it('suma el costo de hoy y excluye otros dias en live', () => {
    const today = rec()
    const free = rec({ source: 'omniroute', project: 'gratis' })
    const unknown = rec({ model: 'modelo-sin-tarifa' })
    const yesterday = rec({ ts: NOW - DAY })
    const tomorrow = rec({ ts: NOW + DAY })
    const result = live([today, free, unknown, yesterday, tomorrow], NOW)
    expect(result.todayCostUsd).toBeCloseTo(0.01325)
    expect(result.todayTokens).toBe(total(today) + total(free) + total(unknown))
    expect(result.todayMessages).toBe(3)
    expect(live([yesterday], NOW).todayCostUsd).toBe(0)
  })

  it('mantiene los calculos al cambiar solo la modalidad de facturacion', () => {
    const before = breakdown(rows())
    vi.mocked(config).mockReturnValue({ ...config(), billing: 'api' })
    expect(breakdown(rows())).toEqual(before)
  })

  it('el demo tiene tarifa en todo Claude y muestra al menos un modelo sin precio', () => {
    const { recs } = demoData(NOW)
    expect(recs.length).toBeGreaterThan(0)
    expect(recs.filter((r) => sourceOf(r) === 'claude').every((r) => costParts(r).unpricedTokens === 0)).toBe(true)
    expect(recs.some((r) => costParts(r).unpricedTokens > 0)).toBe(true)
  })
})
