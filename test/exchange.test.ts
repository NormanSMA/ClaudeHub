import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { readEvents } from '../src/core/agents'
import { exchangeDir, exchangeReadDirs } from '../src/core/paths'
import { readPlanRaw } from '../src/core/plan'
import { mergeWindows } from '../src/core/windows'

const root = mkdtempSync(join(tmpdir(), 'ch-exchange-'))
let n = 0
const folder = (): string => {
  const d = join(root, 'd' + n++)
  mkdirSync(d)
  return d
}

afterAll(() => rmSync(root, { recursive: true, force: true }))

const plan = (updatedAt: number, pct: number) => JSON.stringify({ fiveHour: { pct, resetsAt: 9e12 }, sevenDay: null, updatedAt })
const win = (ts: number, size: number) => ({ size, model: 'm', ts })
const ev = (ts: number, session = 's') => JSON.stringify({ v: 1, ts, source: 'claude', session, event: 'Stop', state: 'done', tool: '', cwd: 'C:\\x' }) + '\n'

describe('exchangeDir y exchangeReadDirs', () => {
  const saved = { ex: process.env.CLAUDEHUB_EXCHANGE, data: process.env.CLAUDEHUB_DATA }
  afterEach(() => {
    for (const [k, v] of [['CLAUDEHUB_EXCHANGE', saved.ex], ['CLAUDEHUB_DATA', saved.data]] as const) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })

  it('CLAUDEHUB_EXCHANGE gana sobre CLAUDEHUB_DATA y este sobre ~/.claudehub', () => {
    process.env.CLAUDEHUB_EXCHANGE = 'A'
    process.env.CLAUDEHUB_DATA = 'B'
    expect(exchangeDir()).toBe('A')
    expect(exchangeReadDirs()).toEqual(['A', 'B'])
    delete process.env.CLAUDEHUB_EXCHANGE
    expect(exchangeDir()).toBe('B')
    expect(exchangeReadDirs()).toEqual(['B'])
    delete process.env.CLAUDEHUB_DATA
    expect(exchangeDir()).toMatch(/\.claudehub$/)
  })
})

describe('lectura de varias carpetas', () => {
  it('rate-limits.json: gana el de mayor updatedAt entre tres carpetas', () => {
    const [a, b, c] = [folder(), folder(), folder()]
    writeFileSync(join(a, 'rate-limits.json'), plan(100, 10))
    writeFileSync(join(b, 'rate-limits.json'), plan(300, 30))
    writeFileSync(join(c, 'rate-limits.json'), plan(200, 20))
    expect(readPlanRaw([a, b, c])?.updatedAt).toBe(300)
    expect(readPlanRaw([c, a])?.updatedAt).toBe(200)
  })

  it('rate-limits.json: un JSON a medias conserva el ultimo valido de esa ruta', () => {
    const d = folder()
    const file = join(d, 'rate-limits.json')
    writeFileSync(file, plan(500, 50))
    expect(readPlanRaw([d])?.updatedAt).toBe(500)
    writeFileSync(file, '{"fiveHour":{"pct":6')
    expect(readPlanRaw([d])?.updatedAt).toBe(500)
    writeFileSync(file, plan(600, 60))
    expect(readPlanRaw([d])?.updatedAt).toBe(600)
  })

  it('rate-limits.json: sin archivos da null', () => {
    expect(readPlanRaw([folder()])).toBeNull()
  })

  it('context-windows.json: por sesion gana el ts mayor', () => {
    const [a, b] = [folder(), folder()]
    writeFileSync(join(a, 'context-windows.json'), JSON.stringify({ s1: win(10, 200_000), s2: win(50, 200_000) }))
    writeFileSync(join(b, 'context-windows.json'), JSON.stringify({ s1: win(20, 1_000_000), s3: win(5, 200_000) }))
    const merged = mergeWindows([a, b])
    expect(merged.s1.size).toBe(1_000_000)
    expect(merged.s2.ts).toBe(50)
    expect(Object.keys(merged).sort()).toEqual(['s1', 's2', 's3'])
  })

  it('events.jsonl: une dos carpetas sin duplicados y en orden', () => {
    const [a, b] = [folder(), folder()]
    writeFileSync(join(a, 'events.jsonl'), ev(10) + ev(30) + ev(40))
    writeFileSync(join(b, 'events.1.jsonl'), ev(5))
    writeFileSync(join(b, 'events.jsonl'), ev(30) + ev(20, 'otra'))
    expect(readEvents([a, b]).map((e) => e.ts)).toEqual([5, 10, 20, 30, 40])
  })
})

describe('escritores', () => {
  const clean = (extra: Record<string, string>): NodeJS.ProcessEnv => {
    const env: NodeJS.ProcessEnv = { ...process.env, ...extra }
    delete env.CLAUDEHUB_PLAN
    delete env.CLAUDEHUB_WINDOWS
    return env
  }

  it('hook.cjs escribe events.jsonl en la carpeta de intercambio', () => {
    const [exchange, data] = [folder(), folder()]
    const r = spawnSync(process.execPath, [resolve(import.meta.dirname, '../scripts/hook.cjs')], {
      input: JSON.stringify({ hook_event_name: 'Stop', session_id: 's1', cwd: 'C:\\x' }),
      env: clean({ CLAUDEHUB_EXCHANGE: join(exchange, 'nueva'), CLAUDEHUB_DATA: data }),
      encoding: 'utf8',
    })
    expect(r.status).toBe(0)
    expect(r.stdout).toBe('')
    expect(JSON.parse(readFileSync(join(exchange, 'nueva', 'events.jsonl'), 'utf8')).session).toBe('s1')
    expect(() => readFileSync(join(data, 'events.jsonl'))).toThrow()
  })

  it('statusline.cjs escribe ventanas y limites en la carpeta de intercambio', () => {
    const [exchange, data] = [folder(), folder()]
    const input = {
      session_id: 's1',
      model: { id: 'claude-opus-5-5' },
      context_window: { context_window_size: 200_000 },
      rate_limits: { five_hour: { used_percentage: 40, resets_at: Math.floor(Date.now() / 1000) + 3600 } },
    }
    const run = () =>
      spawnSync(process.execPath, [resolve(import.meta.dirname, '../scripts/statusline.cjs')], {
        input: JSON.stringify(input),
        env: clean({ CLAUDEHUB_EXCHANGE: exchange, CLAUDEHUB_DATA: data }),
        encoding: 'utf8',
      })
    expect(run().status).toBe(0)
    expect(JSON.parse(readFileSync(join(exchange, 'context-windows.json'), 'utf8')).s1.size).toBe(200_000)
    expect(JSON.parse(readFileSync(join(exchange, 'rate-limits.json'), 'utf8')).fiveHour.pct).toBe(40)
    // la segunda llamada lee lo guardado en la carpeta nueva y no lo reescribe
    const before = readFileSync(join(exchange, 'rate-limits.json'), 'utf8')
    run()
    expect(readFileSync(join(exchange, 'rate-limits.json'), 'utf8')).toBe(before)
    expect(() => readFileSync(join(data, 'rate-limits.json'))).toThrow()
  })
})
