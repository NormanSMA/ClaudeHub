import { describe, expect, it } from 'vitest'
import { activeReport, filterSource, parseSource, rolesReport, summary } from '../src/core/aggregate'
import { planReport } from '../src/core/plan'
import type { Rec, Source } from '../src/core/types'

const H = 3_600_000
const now = Date.UTC(2026, 8, 30, 18, 0, 0)

const rec = (id: string, tokens: number, source?: Source, role: Rec['role'] = 'orchestrator'): Rec => ({
  id,
  ts: now - H,
  model: 'm',
  input: 0,
  cacheWrite: 0,
  cacheRead: tokens,
  output: 0,
  session: `s-${source ?? 'claude'}`,
  project: 'p',
  role,
  ...(source ? { source } : {}),
})

const mixed = [
  rec('a', 1000),
  rec('b', 500, 'claude', 'subagent'),
  rec('c', 70_000, 'codex'),
  rec('d', 9_000, 'gemini'),
  rec('e', 300, 'omniroute'),
]

describe('filtro por fuente', () => {
  it('parseSource acepta solo la lista blanca', () => {
    expect(parseSource('claude')).toBe('claude')
    expect(parseSource('codex')).toBe('codex')
    expect(parseSource('gemini')).toBe('gemini')
    expect(parseSource('omniroute')).toBe('omniroute')
    expect(parseSource('all')).toBe('all')
    expect(parseSource(undefined)).toBe('all')
    expect(parseSource('')).toBe('all')
    expect(parseSource('CODEX')).toBe('all')
    expect(parseSource('../etc/passwd')).toBe('all')
    expect(parseSource('__proto__')).toBe('all')
  })

  it('filterSource separa por fuente y trata la ausencia como claude', () => {
    expect(filterSource(mixed, 'all')).toHaveLength(5)
    expect(filterSource(mixed, 'claude').map((r) => r.id)).toEqual(['a', 'b'])
    expect(filterSource(mixed, 'codex').map((r) => r.id)).toEqual(['c'])
    expect(filterSource(mixed, 'gemini').map((r) => r.id)).toEqual(['d'])
    expect(filterSource(mixed, 'omniroute').map((r) => r.id)).toEqual(['e'])
  })

  it('summary por fuente da menos tokens que all', () => {
    const all = summary(mixed, 'all', now).tokens.total
    const codex = summary(filterSource(mixed, 'codex'), 'all', now).tokens.total
    expect(codex).toBe(70_000)
    expect(codex).toBeLessThan(all)
  })

  it('el plan de Claude no incluye Codex con registros mezclados', () => {
    const raw = {
      fiveHour: { pct: 10, resetsAt: now + 2 * H },
      sevenDay: { pct: 5, resetsAt: now + 4 * 24 * H },
      updatedAt: now,
    }
    const plan = planReport(filterSource(mixed, 'claude'), now, raw)!
    expect(plan.fiveHour?.tokens).toBe(1500)
    expect(plan.sevenDay?.tokens).toBe(1500)
  })

  it('rolesReport con solo Claude no cuenta Codex ni Gemini', () => {
    const r = rolesReport(filterSource(mixed, 'claude'), 'all', now)
    expect(r.orchestrator.total).toBe(1000)
    expect(r.subagent.total).toBe(500)
    expect(r.orchestrator.messages + r.subagent.messages).toBe(2)
  })
})

describe('activeReport con varias fuentes', () => {
  it('ignora registros recientes de Codex, Gemini y OmniRoute', () => {
    const now = Date.now()
    const mk = (source: Source, session: string): Rec => ({
      id: `${source}:${session}`,
      ts: now - 1000,
      model: 'x',
      input: 10,
      cacheRead: 0,
      cacheWrite: 0,
      output: 5,
      session,
      project: 'p',
      role: 'orchestrator',
      source,
    })
    const recs = [mk('claude', 'c1'), mk('codex', 'x1'), mk('gemini', 'g1'), mk('omniroute', 'o1')]
    const chats = activeReport(recs, new Map(), now, undefined, {})
    expect(chats).toHaveLength(1)
  })
})
