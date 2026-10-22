import { describe, expect, it } from 'vitest'
import { breakdown, live, projectsReport, sessionsReport } from '../src/core/aggregate'
import { fresh, total, type Rec } from '../src/core/types'

const NOW = new Date(2026, 9, 22, 12).getTime()

const rec = (over: Partial<Rec> = {}): Rec => ({
  id: 'r',
  ts: NOW - 60_000,
  model: 'claude-opus-5-5',
  input: 2,
  cacheWrite: 1000,
  cacheRead: 881200,
  output: 500,
  session: 's',
  project: 'p',
  role: 'orchestrator',
  ...over,
})

const recs = Array.from({ length: 13 }, (_, i) => rec({ id: String(i) }))

describe('tokens nuevos y lectura de cache', () => {
  it('fresh suma entrada, escritura de cache y salida sin duplicar pensamiento', () => {
    expect(fresh(rec({ reasoning: 200 }))).toBe(1502)
    expect(total(rec())).toBe(882702)
    expect(fresh(rec({ input: 0, cacheWrite: 0, output: 0 }))).toBe(0)
  })

  it('breakdown separa tokens nuevos y conserva el total', () => {
    expect(breakdown(recs)).toMatchObject({ fresh: 19526, cacheRead: 11455600, total: 11475126 })
    expect(breakdown([])).toMatchObject({ fresh: 0, cacheRead: 0, total: 0 })
  })

  it('live separa los 13 registros de hoy y excluye ayer', () => {
    const yesterday = rec({ ts: new Date(2026, 9, 21, 23, 59).getTime() })
    expect(live([...recs, yesterday], NOW)).toMatchObject({
      todayFresh: 19526,
      todayCacheRead: 11455600,
      todayTokens: 11475126,
      todayMessages: 13,
    })
    expect(live([], NOW)).toMatchObject({ todayFresh: 0, todayCacheRead: 0, todayTokens: 0 })
  })

  it('sessionsReport separa tokens por sesion e incluye subagentes dentro del rango', () => {
    const extra = rec({ session: 'other', project: 'other', role: 'subagent' })
    const outside = rec({ ts: NOW - 1 })
    const rows = sessionsReport([...recs, extra, outside], new Map(), { from: NOW - 60_000, to: NOW - 60_000 }, 100, NOW)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ session: 's', fresh: 19526, cacheRead: 11455600, total: 11475126 })
    expect(rows[1]).toMatchObject({ session: 'other', fresh: 1502, cacheRead: 881200, sub: 882702, total: 882702 })
  })

  it('projectsReport separa tokens por proyecto e incluye subagentes dentro del rango', () => {
    const extra = rec({ session: 'other', project: 'other', role: 'subagent' })
    const outside = rec({ ts: NOW - 1 })
    const rows = projectsReport([...recs, extra, outside], { from: NOW - 60_000, to: NOW - 60_000 }, NOW)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ project: 'p', fresh: 19526, cacheRead: 11455600, total: 11475126 })
    expect(rows[1]).toMatchObject({ project: 'other', fresh: 1502, cacheRead: 881200, sub: 882702, total: 882702 })
  })
})
