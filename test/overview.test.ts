import { describe, expect, it } from 'vitest'
import type { HookEvent } from '../src/core/agents'
import { activeExtras } from '../src/core/overview'
import type { CodexRateLimits } from '../src/core/sources/codex'
import type { PlanReport } from '../src/core/plan'

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

const base = { claudePlan, recs: [], codexLimits: null, events: [] as HookEvent[], now: NOW }

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
