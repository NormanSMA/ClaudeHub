import { mkdtempSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { planReport } from '../src/core/plan'
import { demoPlanRaw } from '../src/core/demo'
import type { Rec } from '../src/core/types'

const H = 3_600_000
const now = Date.UTC(2026, 8, 30, 18, 0, 0)

const rec = (id: string, ago: number, tokens: number): Rec => ({
  id,
  ts: now - ago,
  model: 'claude-opus-5-5',
  input: 0,
  cacheWrite: 0,
  cacheRead: tokens,
  output: 0,
  session: 's',
  project: 'p',
  role: 'orchestrator',
})

describe('limites del plan', () => {
  it('cuenta los tokens dentro de cada ventana', () => {
    // la ventana de 5 h se restablece en 2 h: empezo hace 3 h
    const recs = [rec('a', 1 * H, 1000), rec('b', 2.9 * H, 500), rec('c', 3.5 * H, 9999), rec('d', 30 * H, 7000)]
    const plan = planReport(recs, now, {
      fiveHour: { pct: 51, resetsAt: now + 2 * H },
      sevenDay: { pct: 33, resetsAt: now + 4 * 24 * H },
      updatedAt: now,
    })!
    expect(plan.fiveHour?.pct).toBe(51)
    expect(plan.fiveHour?.tokens).toBe(1500)
    // la semanal empezo hace 3 dias: entran a, b, c y d
    expect(plan.sevenDay?.tokens).toBe(1000 + 500 + 9999 + 7000)
  })

  it('descarta una ventana cuya hora de reinicio ya paso', () => {
    const plan = planReport([], now, {
      fiveHour: { pct: 90, resetsAt: now - 1000 },
      sevenDay: { pct: 10, resetsAt: now + H },
      updatedAt: now,
    })!
    expect(plan.fiveHour).toBeNull()
    expect(plan.sevenDay?.pct).toBe(10)
  })

  it('devuelve null sin datos o con ambas ventanas vencidas', () => {
    expect(planReport([], now, null)).toBeNull()
    expect(planReport([], now, {})).toBeNull()
    expect(planReport([], now, { fiveHour: { pct: 5, resetsAt: now - 1 }, sevenDay: { pct: 5, resetsAt: now - 1 } })).toBeNull()
  })

  it('acota el porcentaje y rechaza valores invalidos', () => {
    const plan = planReport([], now, {
      fiveHour: { pct: 250, resetsAt: now + H },
      sevenDay: { pct: Number.NaN, resetsAt: now + H },
    })!
    expect(plan.fiveHour?.pct).toBe(100)
    expect(plan.sevenDay).toBeNull()
  })

  it('marca el limite alcanzado que Claude Code registro, sin linea de estado', () => {
    const hit = { ts: now - 1000, resetsAt: now + 1.5 * H, type: 'five_hour', status: 'rejected' }
    const plan = planReport([], now, null, hit)!
    expect(plan.fiveHour).toBeNull()
    expect(plan.blocked).toEqual({ type: 'five_hour', resetsAt: now + 1.5 * H })
    // ya se restablecio, o no fue un rechazo: no hay bloqueo
    expect(planReport([], now, null, { ...hit, resetsAt: now - 1 })).toBeNull()
    expect(planReport([], now, null, { ...hit, status: 'allowed' })).toBeNull()
  })

  it('lee el limite alcanzado desde los registros y conserva el mas reciente', async () => {
    const { mkdirSync, writeFileSync } = await import('node:fs')
    const { scan } = await import('../src/core/scan')
    const root = mkdtempSync(join(tmpdir(), 'ch-hit-'))
    const proj = join(root, 'C--Proyectos-demo')
    mkdirSync(proj, { recursive: true })
    const line = (ts: string, resetsAt: number, status: string) =>
      JSON.stringify({ type: 'assistant', timestamp: ts, error: 'rate_limit', isApiErrorMessage: true, quotaLimits: { status, resetsAt, rateLimitType: 'five_hour' } })
    writeFileSync(join(proj, 's1.jsonl'), [line('2026-09-30T10:00:00Z', 1790000000, 'rejected'), line('2026-09-30T15:00:00Z', 1790018000, 'rejected')].join('\n') + '\n')
    const { limitHit } = scan(root, false)
    expect(limitHit?.type).toBe('five_hour')
    expect(limitHit?.status).toBe('rejected')
    expect(limitHit?.resetsAt).toBe(1790018000 * 1000)
  })

  it('el plan de la demo muestra 51% y 33%', () => {
    const plan = planReport([], now, demoPlanRaw(now))!
    expect(plan.fiveHour?.pct).toBe(51)
    expect(plan.sevenDay?.pct).toBe(33)
    expect(Math.round((plan.fiveHour!.resetsAt - now) / 60_000)).toBe(234)
  })
})

describe('linea de estado y limites del plan', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ch-plan-'))
  const planFile = join(dir, 'rate-limits.json')
  const script = resolve(import.meta.dirname, '../scripts/statusline.cjs')
  const run = (payload: unknown) =>
    spawnSync(process.execPath, [script], {
      input: JSON.stringify(payload),
      env: { ...process.env, CLAUDEHUB_PLAN: planFile, CLAUDEHUB_WINDOWS: join(dir, 'w.json') },
      encoding: 'utf8',
    })
  // eslint-disable-next-line no-control-regex
  const plain = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '')
  const resets5 = Math.floor(Date.now() / 1000) + 3 * 3600
  const resets7 = Math.floor(Date.now() / 1000) + 3 * 86400

  it('guarda los limites (segundos a milisegundos) y los muestra en la barra', () => {
    const r = run({
      session_id: 'p1',
      model: { display_name: 'Opus' },
      context_window: { context_window_size: 200000, used_percentage: 10 },
      rate_limits: { five_hour: { used_percentage: 51.4, resets_at: resets5 }, seven_day: { used_percentage: 33, resets_at: resets7 } },
    })
    expect(plain(r.stdout)).toContain('[Opus] ctx 10% | 5h 51% | 7d 33%')
    const saved = JSON.parse(readFileSync(planFile, 'utf8'))
    expect(saved.fiveHour.pct).toBeCloseTo(51.4)
    expect(saved.fiveHour.resetsAt).toBe(resets5 * 1000)
    expect(saved.sevenDay.resetsAt).toBe(resets7 * 1000)
  })

  it('conserva la ventana que falta en una llamada posterior', () => {
    run({ session_id: 'p2', rate_limits: { five_hour: { used_percentage: 60, resets_at: resets5 } } })
    const saved = JSON.parse(readFileSync(planFile, 'utf8'))
    expect(saved.fiveHour.pct).toBe(60)
    expect(saved.sevenDay.pct).toBe(33)
  })

  it('no toca el archivo si la entrada no trae limites', () => {
    const before = readFileSync(planFile, 'utf8')
    const r = run({ session_id: 'p3', model: { display_name: 'Sonnet' } })
    expect(plain(r.stdout).trim()).toBe('[Sonnet]')
    expect(readFileSync(planFile, 'utf8')).toBe(before)
  })
})
