import { filterRange, type modelsReport } from './aggregate'
import { modelName } from './models'
import type { OmniCall } from './sources/omniroute'
import type { Range } from './types'

/** Lo que paso por OmniRoute para un modelo. */
export interface ModelVia {
  calls: number
  ok: number
  /** de 0 a 1 */
  successRate: number
  e429: number
  e403: number
  e5xx: number
  /** latencia p95 de las llamadas exitosas. null si no hay datos */
  p95Ms: number | null
  tokens: number
  providers: string[]
}

export interface ViaInput {
  calls: OmniCall[]
  range: Range
  now?: number
}

type ModelRow = ReturnType<typeof modelsReport>['models'][number]

/** Percentil por rango mas cercano. `sorted` va de menor a mayor. */
function p95(sorted: number[]): number | null {
  if (!sorted.length) return null
  return sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)]
}

function viaOf(calls: OmniCall[]): ModelVia {
  const times = calls.filter((c) => c.ok && c.latencyMs !== null).map((c) => c.latencyMs as number)
  const failed = calls.filter((c) => !c.ok)
  const ok = calls.length - failed.length
  return {
    calls: calls.length,
    ok,
    successRate: calls.length ? ok / calls.length : 0,
    e429: failed.filter((c) => c.status === 429).length,
    e403: failed.filter((c) => c.status === 403).length,
    e5xx: failed.filter((c) => c.status >= 500).length,
    p95Ms: p95(times.sort((a, b) => a - b)),
    tokens: calls.reduce((a, c) => a + c.tokens, 0),
    providers: [...new Set(calls.map((c) => c.provider))].sort((a, b) => a.localeCompare(b, 'es')),
  }
}

/**
 * Agrega a cada modelo del reporte lo que paso por OmniRoute. Los modelos se unen por su nombre
 * visible: el mismo modelo usado directo y via OmniRoute queda en una sola fila.
 */
export function attachVia<R extends { models: ModelRow[] }>(
  report: R,
  input: ViaInput,
): Omit<R, 'models'> & { models: (ModelRow & { via?: ModelVia })[] } {
  const byName = new Map<string, OmniCall[]>()
  for (const call of filterRange(input.calls, input.range, input.now ?? Date.now())) {
    const name = modelName(call.model)
    byName.set(name, [...(byName.get(name) ?? []), call])
  }
  const models: (ModelRow & { via?: ModelVia })[] = report.models.map((m) => {
    const calls = byName.get(m.model)
    byName.delete(m.model)
    return calls ? { ...m, via: viaOf(calls) } : m
  })
  for (const [model, calls] of byName) {
    models.push({
      model, input: 0, cacheWrite: 0, cacheRead: 0, output: 0, reasoning: 0, total: 0, share: 0,
      via: viaOf(calls),
    })
  }
  models.sort((a, b) => b.total - a.total || a.model.localeCompare(b.model, 'es'))
  return { ...report, models }
}
