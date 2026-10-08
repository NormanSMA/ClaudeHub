import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { latestCodexLimits } from '../src/core/sources/codex-limits'
import { codexPlanReport, plansReport } from '../src/core/plan'
import type { CodexRateLimits } from '../src/core/sources/codex'
import type { Rec } from '../src/core/types'

const H = 3_600_000
const now = Date.UTC(2026, 8, 30, 18, 0, 0)

function line(ts: number, primary: object, secondary: object, plan = 'plus'): string {
  return JSON.stringify({
    timestamp: new Date(ts).toISOString(),
    type: 'event_msg',
    payload: { type: 'token_count', info: null, rate_limits: { plan_type: plan, primary, secondary } },
  })
}

const win = (used: number, minutes: number, resetsAtMs: number) => ({
  used_percent: used,
  window_minutes: minutes,
  resets_at: Math.floor(resetsAtMs / 1000),
})

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'codex-limits-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function rollout(name: string, content: string, mtimeSec: number, sub = '2026/09/30') {
  const folder = join(dir, sub)
  mkdirSync(folder, { recursive: true })
  const file = join(folder, name)
  writeFileSync(file, content)
  utimesSync(file, mtimeSec, mtimeSec)
}

describe('latestCodexLimits', () => {
  it('devuelve null sin archivos o con carpeta inexistente', () => {
    expect(latestCodexLimits(dir)).toBeNull()
    expect(latestCodexLimits(join(dir, 'no-existe'))).toBeNull()
  })

  it('elige el limite con mayor ts entre los rollouts', () => {
    const p = win(10, 300, now + 2 * H)
    const s = win(20, 10080, now + 24 * H)
    rollout('rollout-a.jsonl', line(now - 3 * H, p, s, 'old') + '\n', 1000)
    rollout('rollout-b.jsonl', line(now - 1 * H, p, s, 'new') + '\n', 900)
    expect(latestCodexLimits(dir)?.planType).toBe('new')
  })

  it('lee como maximo los 5 rollouts mas recientes', () => {
    const p = win(10, 300, now + 2 * H)
    const s = win(20, 10080, now + 24 * H)
    for (let i = 0; i < 5; i++) rollout(`rollout-${i}.jsonl`, line(now - (10 + i) * H, p, s, 'reciente') + '\n', 2000 + i)
    // el mas antiguo por mtime tiene el ts mas alto, pero queda fuera de los 5
    rollout('rollout-viejo.jsonl', line(now, p, s, 'fuera') + '\n', 100)
    expect(latestCodexLimits(dir)?.planType).toBe('reciente')
  })
})

describe('codexPlanReport', () => {
  const rec = (id: string, ago: number, tokens: number, source: 'codex' | 'claude' = 'codex'): Rec => ({
    id,
    ts: now - ago,
    model: 'gpt',
    input: tokens,
    cacheWrite: 0,
    cacheRead: 0,
    output: 0,
    session: 's',
    project: 'p',
    role: 'orchestrator',
    source,
  })

  const limits = (primary: object, secondary: object): CodexRateLimits => ({
    ts: now - H,
    planType: 'plus',
    primary: { usedPercent: (primary as any).used_percent, windowMinutes: (primary as any).window_minutes, resetsAt: (primary as any).resets_at },
    secondary: { usedPercent: (secondary as any).used_percent, windowMinutes: (secondary as any).window_minutes, resetsAt: (secondary as any).resets_at },
  })

  it('convierte segundos a ms y cuenta tokens de Codex por ventana', () => {
    const l = limits(win(40, 300, now + 2 * H), win(15, 10080, now + 4 * 24 * H))
    const recs = [rec('a', 1 * H, 1000), rec('b', 2.9 * H, 500), rec('c', 30 * H, 7000), rec('x', 1 * H, 99999, 'claude')]
    const r = codexPlanReport(l, recs, now)!
    expect(r.fiveHour).toEqual({ pct: 40, resetsAt: Math.floor((now + 2 * H) / 1000) * 1000, tokens: 1500 })
    expect(r.sevenDay?.tokens).toBe(8500)
    expect(r.blocked).toBeNull()
    expect(r.planType).toBe('plus')
  })

  it('una ventana vencida queda en null', () => {
    const l = limits(win(40, 300, now - H), win(15, 10080, now + 24 * H))
    const r = codexPlanReport(l, [], now)!
    expect(r.fiveHour).toBeNull()
    expect(r.sevenDay?.pct).toBe(15)
  })

  it('devuelve null si ambas ventanas estan vencidas o no hay limites', () => {
    expect(codexPlanReport(limits(win(1, 300, now - H), win(1, 10080, now - H)), [], now)).toBeNull()
    expect(codexPlanReport(null, [], now)).toBeNull()
  })

  it('ignora una ventana con minutos distintos', () => {
    const l = limits(win(40, 60, now + H), win(15, 10080, now + 24 * H))
    const r = codexPlanReport(l, [], now)!
    expect(r.fiveHour).toBeNull()
    expect(r.sevenDay?.pct).toBe(15)
  })
})

describe('plansReport', () => {
  it('agrupa Claude y Codex', () => {
    expect(plansReport(null, null)).toEqual({ claude: null, codex: null })
  })
})
