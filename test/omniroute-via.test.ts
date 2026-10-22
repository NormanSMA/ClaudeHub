import { describe, it, expect } from 'vitest'
import { attachVia } from '../src/core/omniroute-via'
import { demoOmniroute } from '../src/core/demo-omniroute'
import { modelsReport } from '../src/core/aggregate'
import type { OmniCall } from '../src/core/sources/omniroute'
import type { Rec } from '../src/core/types'

// Todo sintetico. Hora fija para que los rangos sean deterministas.
const NOW = Date.parse('2026-05-10T12:00:00.000Z')
const H = 3_600_000

const call = (over: Partial<OmniCall> = {}): OmniCall => ({
  ts: NOW - H,
  provider: 'prov-a',
  model: 'gemini-4-argon-high',
  status: 200,
  ok: true,
  latencyMs: 1000,
  tokens: 100,
  ...over,
})

const failed = (status: number, over: Partial<OmniCall> = {}) => call({ status, ok: false, latencyMs: 50, tokens: 0, ...over })

const rec = (model: string, ts = NOW - H): Rec => ({
  id: `r-${model}-${ts}`,
  ts,
  model,
  input: 10,
  cacheRead: 0,
  cacheWrite: 0,
  output: 5,
  session: 's',
  project: 'p',
  role: 'orchestrator',
})

const report = (recs: Rec[]) => modelsReport(recs, 'all', NOW)
const input = (calls: OmniCall[], over: Partial<Parameters<typeof attachVia>[1]> = {}) => ({ calls, range: 'all' as const, now: NOW, ...over })

describe('attachVia', () => {
  it('une las llamadas con la fila del modelo por su nombre visible', () => {
    const out = attachVia(report([rec('gemini-4-argon-high')]), input([call(), call({ model: 'gemini-4-argon-low' })]))
    expect(out.models).toHaveLength(1)
    expect(out.models[0].model).toBe('Gemini 4 Argon')
    // alto y bajo comparten nombre visible: las dos llamadas son de esa fila
    expect(out.models[0].via?.calls).toBe(2)
  })

  it('cuenta exito, 429, 403 y 5xx y calcula el p95 solo con llamadas exitosas', () => {
    const calls = [call({ latencyMs: 100 }), call({ latencyMs: 200 }), failed(429), failed(403), failed(502), failed(400)]
    const via = attachVia(report([rec('gemini-4-argon-high')]), input(calls)).models[0].via!
    expect(via).toMatchObject({ calls: 6, ok: 2, e429: 1, e403: 1, e5xx: 1, p95Ms: 200, tokens: 200 })
    expect(via.successRate).toBeCloseTo(2 / 6)
  })

  it('p95 nulo si ninguna llamada tuvo exito', () => {
    const via = attachVia(report([rec('gemini-4-argon-high')]), input([failed(429)])).models[0].via!
    expect(via.p95Ms).toBeNull()
    expect(via.successRate).toBe(0)
  })

  it('lista los proveedores ordenados y sin repetir', () => {
    const calls = [call({ provider: 'prov-b' }), call({ provider: 'prov-a' }), call({ provider: 'prov-b' })]
    expect(attachVia(report([rec('gemini-4-argon-high')]), input(calls)).models[0].via?.providers).toEqual(['prov-a', 'prov-b'])
  })

  it('deja sin via a los modelos sin llamadas por OmniRoute', () => {
    const out = attachVia(report([rec('claude-opus-5-5'), rec('gemini-4-argon-high')]), input([call()]))
    const byName = Object.fromEntries(out.models.map((m) => [m.model, m]))
    expect(byName['Opus 5.5']).not.toHaveProperty('via')
    expect(byName['Gemini 4 Argon'].via).toBeDefined()
  })

  it('un modelo usado directo y via OmniRoute es una sola fila', () => {
    const out = attachVia(report([rec('gemini-4-argon-high', NOW - 2 * H), rec('gemini-4-argon-high')]), input([call()]))
    expect(out.models).toHaveLength(1)
    expect(out.models[0].via?.calls).toBe(1)
  })

  it('respeta el rango y conserva el resto del reporte', () => {
    const old = call({ ts: NOW - 40 * 24 * H })
    const out = attachVia(report([rec('gemini-4-argon-high')]), input([call(), old], { range: '7d' }))
    expect(out.models[0].via?.calls).toBe(1)
    expect(out.daily).toEqual(report([rec('gemini-4-argon-high')]).daily)
  })

  it('agrega un modelo con solo llamadas fallidas y todos sus tokens en cero', () => {
    const out = attachVia(report([]), input([failed(429), failed(403), failed(503)]))
    expect(out.models).toEqual([{
      model: 'Gemini 4 Argon',
      input: 0, cacheWrite: 0, cacheRead: 0, output: 0, reasoning: 0, total: 0, fresh: 0, share: 0, ids: [],
      costUsd: 0, costUnpriced: 0, cacheSavingsUsd: 0, freeSavingsUsd: 0,
      via: {
        calls: 3, ok: 0, successRate: 0, e429: 1, e403: 1, e5xx: 1,
        p95Ms: null, tokens: 0, providers: ['prov-a'],
      },
    }])
    expect(out.daily).toEqual([])
  })

  it.each(['all', '7d', '30d', { from: NOW - 2 * H, to: NOW }] as const)(
    'conserva los conteos de todas las llamadas del rango %j', (range) => {
      const recent = [
        call(), call({ model: 'modelo-a' }), failed(429),
        failed(429, { model: 'modelo-a' }), failed(403, { model: 'modelo-b' }),
        failed(502, { model: 'modelo-b' }), failed(400, { model: 'modelo-c' }),
      ]
      const old = [call(), failed(429), failed(403), failed(503)]
        .map((c) => ({ ...c, model: 'modelo-antiguo', ts: NOW - 40 * 24 * H }))
      const calls = [...recent, ...old]
      const out = attachVia(report([rec('gemini-4-argon-high')]), input(calls, { range }))
      const inRange = range === 'all' ? calls : recent
      const sum = (key: 'calls' | 'ok' | 'e429' | 'e403' | 'e5xx') =>
        out.models.reduce((total, m) => total + (m.via?.[key] ?? 0), 0)
      expect(sum('calls')).toBe(inRange.length)
      expect(sum('ok')).toBe(inRange.filter((c) => c.ok).length)
      expect(sum('e429')).toBe(inRange.filter((c) => !c.ok && c.status === 429).length)
      expect(sum('e403')).toBe(inRange.filter((c) => !c.ok && c.status === 403).length)
      expect(sum('e5xx')).toBe(inRange.filter((c) => !c.ok && c.status >= 500).length)
      expect(out.models.some((m) => m.model === 'modelo-antiguo')).toBe(range === 'all')
    },
  )

  it('ordena por total descendente y nombre en los empates sin modificar el reporte', () => {
    const original = report([rec('modelo-z'), rec('modelo-b'), rec('modelo-b'), rec('modelo-a')])
    const before = structuredClone(original)
    const calls = [failed(429, { model: 'modelo-y' }), failed(403, { model: 'modelo-c' })]
    const out = attachVia(original, input(calls))
    expect(out.models.map((m) => m.model)).toEqual([
      'modelo-b', 'modelo-a', 'modelo-z', 'modelo-c', 'modelo-y',
    ])
    expect(out.models.map((m) => m.total)).toEqual([30, 15, 15, 0, 0])
    expect(original).toEqual(before)
    expect(out.daily).toEqual(original.daily)
  })
})

describe('demoOmniroute', () => {
  it('es determinista y trae llamadas exitosas y fallidas', () => {
    const calls = demoOmniroute(NOW)
    expect(calls).toEqual(demoOmniroute(NOW))
    expect(calls.length).toBeGreaterThan(100)
    expect(calls.some((c) => c.ok)).toBe(true)
    expect(calls.some((c) => !c.ok)).toBe(true)
  })

  it('cada modelo de demo con llamadas cae en una fila de Modelos', () => {
    const recs = [rec('gemini-3-pro-preview'), rec('llama-4-70b'), rec('gemini-3-flash-preview')]
    const byName = Object.fromEntries(attachVia(report(recs), input(demoOmniroute(NOW))).models.map((m) => [m.model, m.via]))
    expect(byName['Gemini 3 Pro']?.calls).toBeGreaterThan(0)
    expect(byName['llama-4-70b']?.calls).toBeGreaterThan(0)
    expect(byName['Gemini 3 Flash']?.calls).toBeGreaterThan(0)
  })
})
