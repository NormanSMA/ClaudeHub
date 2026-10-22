import { describe, expect, it } from 'vitest'
import type { HookEvent } from '../src/core/agents'
import { activeReport, burnRate, cacheEfficiency, delegationShare } from '../src/core/aggregate'
import { demoData, demoPlanRaw } from '../src/core/demo'
import { activeExtras } from '../src/core/overview'
import type { CodexRateLimits } from '../src/core/sources/codex'
import { planReport, type PlanReport } from '../src/core/plan'
import { sourceOf, type Rec } from '../src/core/types'

const NOW = 1_800_000_000_000
const MIN = 60_000

function ev(over: Partial<HookEvent> & { ts: number }): HookEvent {
  return { v: 1, source: 'claude', session: 'abcdefgh-1234-5678', event: 'X', state: 'thinking', tool: '', cwd: 'C:\\Proyectos\\Demo', ...over }
}

const claudePlan: PlanReport = { fiveHour: null, sevenDay: null, blocked: null, updatedAt: 1 }

const limits: CodexRateLimits = {
  ts: NOW - 1000,
  planType: 'plus',
  primary: { usedPercent: 30, windowMinutes: 300, resetsAt: Math.floor((NOW + 60 * MIN) / 1000) },
  secondary: { usedPercent: 12, windowMinutes: 10080, resetsAt: Math.floor((NOW + 3 * 86_400_000) / 1000) },
}

const base = { claudePlan, contextPct: null, recs: [] as Rec[], codexLimits: null, events: [] as HookEvent[], now: NOW }

const rec = (over: Partial<Rec>): Rec => ({
  id: String(Math.random()),
  ts: NOW - MIN,
  model: 'claude-opus-5-5',
  input: 0,
  cacheWrite: 0,
  cacheRead: 0,
  output: 0,
  session: 's',
  project: 'p',
  role: 'orchestrator',
  ...over,
})

describe('ritmo, eficiencia y delegacion', () => {
  it('burnRate cuenta solo Claude dentro de la ventana', () => {
    const recs = [
      rec({ output: 1500 }),
      rec({ ts: NOW - 20 * MIN, output: 9999 }),
      rec({ output: 7777, source: 'codex' }),
    ]
    expect(burnRate(recs, NOW)).toBe(100)
    expect(burnRate([], NOW)).toBe(0)
  })

  it('burnFreshPerMin excluye cache y otras fuentes dentro de la misma ventana', () => {
    const recs = [
      rec({ ts: NOW, input: 2, cacheWrite: 1000, cacheRead: 881200, output: 498, reasoning: 200 }),
      rec({ ts: NOW - 15 * MIN + 1, output: 1500, role: 'subagent', source: 'claude' }),
      rec({ ts: NOW - 15 * MIN, output: 9999 }),
      rec({ ts: NOW + 1, output: 9999 }),
      rec({ output: 9999, source: 'codex' }),
      rec({ output: 9999, source: 'gemini' }),
      rec({ output: 9999, source: 'omniroute' }),
    ]
    const { level } = activeExtras({ ...base, contextPct: 0.5, recs })
    expect(level).toMatchObject({ burnFreshPerMin: 200, burnPerMin: (881200 + 3000) / 15 })
    expect(activeExtras({ ...base, contextPct: 0.5 }).level).toMatchObject({ burnFreshPerMin: 0 })
  })

  it('cacheEfficiency es lectura de cache sobre la entrada', () => {
    expect(cacheEfficiency({ input: 10, cacheWrite: 10, cacheRead: 80 })).toBe(80)
    expect(cacheEfficiency({ input: 0, cacheWrite: 0, cacheRead: 0 })).toBe(0)
  })

  it('delegationShare usa 5 h y solo Claude', () => {
    const recs = [
      rec({ output: 300, role: 'subagent' }),
      rec({ output: 700 }),
      rec({ ts: NOW - 6 * 60 * MIN, output: 5000, role: 'subagent' }),
      rec({ output: 5000, role: 'subagent', source: 'gemini' }),
    ]
    expect(delegationShare(recs, NOW)).toBeCloseTo(0.3)
    expect(delegationShare([], NOW)).toBe(0)
  })
})

describe('nivel y subagentes con datos del demo', () => {
  const now = Date.now()
  const { recs, sessions } = demoData(now)
  const claude = recs.filter((r) => sourceOf(r) === 'claude')
  const plan = planReport(claude, now, demoPlanRaw(now))
  const chats = activeReport(claude, sessions, now, undefined, {})

  it('activeExtras da nivel 3 con ritmo y proyeccion', () => {
    const contextPct = Math.max(...chats.map((c) => c.context.pct))
    const { level } = activeExtras({ claudePlan: plan, contextPct, recs, codexLimits: null, events: [], now })
    expect(level).toMatchObject({ level: 3, basis: 'plan5h' })
    expect(level!.burnPerMin).toBeGreaterThan(0)
    expect(level!.minutesLeft).not.toBeNull()
    expect(level!.exhaustsBeforeReset).not.toBeNull()
    expect(level!.cacheEfficiency).toBeGreaterThan(0)
  })

  it('level es null sin plan ni chats', () => {
    expect(activeExtras(base).level).toBeNull()
  })

  it('el chat pg-migration trae sus subagentes', () => {
    const chat = chats.find((c) => c.session === 'demo-pg-migration')!
    expect(chat.subagents.length).toBeGreaterThan(0)
    const live = chat.subagents.find((s) => s.file === 'agent-live-1')!
    expect(live).toMatchObject({ agent: 'Explore', working: true })
    expect(live.tokens).toBeGreaterThan(0)
    expect(chat.activeSubagents).toBe(chat.subagents.filter((s) => s.working).length)
    // solo los 10 mas recientes, del mas nuevo al mas viejo
    expect(chat.subagents.length).toBeLessThanOrEqual(10)
    expect(chat.subagents[0].file).toBe('agent-live-1')
    const ts = chat.subagents.map((s) => s.lastTs)
    expect(ts).toEqual([...ts].sort((a, b) => b - a))
    expect(chat.subagents.reduce((a, s) => a + s.tokens, 0)).toBeLessThanOrEqual(chat.tokens.subagents)
  })
})

describe('activeExtras', () => {
  it('sin eventos ni limites: planes vacios y mascota durmiendo', () => {
    const r = activeExtras(base)
    expect(r.plans).toEqual({ claude: claudePlan, codex: null })
    expect(r.agents).toEqual([])
    expect(r.collisions).toEqual([])
    expect(r.mascot).toBe('sleeping')
  })

  it('plans.codex sale de los limites', () => {
    const r = activeExtras({ ...base, codexLimits: limits })
    expect(r.plans.codex?.fiveHour?.pct).toBe(30)
    expect(r.plans.codex?.sevenDay?.pct).toBe(12)
    expect(r.plans.codex?.planType).toBe('plus')
  })

  it('agentes en forma publica: sesion de 8 caracteres y sin cwdKey ni rutas', () => {
    const r = activeExtras({ ...base, events: [ev({ ts: NOW - 5000, state: 'tool', tool: 'Edit' })] })
    expect(r.agents).toEqual([
      { source: 'claude', session: 'abcdefgh', project: 'Demo', state: 'tool', since: NOW - 5000, tool: 'Edit', stuck: false },
    ])
    const text = JSON.stringify(r)
    expect(text).not.toContain('cwdKey')
    expect(text).not.toContain('Proyectos')
    expect(text).not.toContain('1234-5678')
  })

  it('choque: sesiones truncadas a 8 caracteres', () => {
    const events = [
      ev({ ts: NOW - 30_000, session: 'aaaaaaaa-xxxx' }),
      ev({ ts: NOW - 30_000, session: 'bbbbbbbb-yyyy', source: 'codex' }),
    ]
    const r = activeExtras({ ...base, events })
    expect(r.collisions).toHaveLength(1)
    expect(r.collisions[0].project).toBe('Demo')
    expect(r.collisions[0].sessions).toEqual([
      { source: 'claude', session: 'aaaaaaaa' },
      { source: 'codex', session: 'bbbbbbbb' },
    ])
    expect(r.mascot).toBe('alert')
  })

  it('mascota segun prioridad: waiting gana a tool', () => {
    const events = [
      ev({ ts: NOW - 5000, state: 'tool', session: 's-tool', cwd: 'C:\\a' }),
      ev({ ts: NOW - 5000, state: 'waiting', session: 's-wait', cwd: 'C:\\b' }),
    ]
    expect(activeExtras({ ...base, events }).mascot).toBe('waiting')
    expect(activeExtras({ ...base, events: [events[0]] }).mascot).toBe('tool')
  })
})
