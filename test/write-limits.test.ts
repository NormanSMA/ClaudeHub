import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT = resolve(__dirname, '..', 'scripts', 'write-limits.cjs')
const STATUSLINE = resolve(__dirname, '..', 'scripts', 'statusline.cjs')

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'claudehub-limits-'))
  file = join(dir, 'rate-limits.json')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function run(args: string[]) {
  const env: NodeJS.ProcessEnv = { ...process.env, CLAUDEHUB_DATA: dir }
  delete env.CLAUDEHUB_PLAN
  return spawnSync(process.execPath, [SCRIPT, ...args], { env, encoding: 'utf8' })
}

const read = () => JSON.parse(readFileSync(file, 'utf8'))
const future = (ms: number) => Date.now() + ms

describe('write-limits', () => {
  it('escribe ambas ventanas con fecha ISO y milisegundos', () => {
    const five = future(3_600_000)
    const seven = future(86_400_000)
    const r = run(['--five', '51.5', '--five-reset', new Date(five).toISOString(), '--seven', '33', '--seven-reset', String(seven)])
    expect(r.status).toBe(0)
    expect(r.stdout.trim().split('\n')).toHaveLength(1)
    const data = read()
    expect(data.fiveHour).toEqual({ pct: 51.5, resetsAt: five })
    expect(data.sevenDay).toEqual({ pct: 33, resetsAt: seven })
    expect(typeof data.updatedAt).toBe('number')
  })

  it('rechaza porcentajes fuera de rango o no numericos', () => {
    const reset = String(future(60_000))
    for (const pct of ['-1', '101', 'abc', '']) {
      const r = run(['--five', pct, '--five-reset', reset])
      expect(r.status).toBe(1)
      expect(r.stderr).toContain('write-limits')
    }
    expect(existsSync(file)).toBe(false)
  })

  it('rechaza reinicios invalidos y ventanas incompletas', () => {
    expect(run(['--five', '10', '--five-reset', 'manana']).status).toBe(1)
    expect(run(['--five', '10']).status).toBe(1)
    expect(run(['--seven-reset', String(future(60_000))]).status).toBe(1)
    expect(run([]).status).toBe(1)
    expect(run(['--otro', '1']).status).toBe(1)
    expect(existsSync(file)).toBe(false)
  })

  it('conserva la ventana ausente si no expiro', () => {
    const seven = future(86_400_000)
    expect(run(['--seven', '40', '--seven-reset', String(seven)]).status).toBe(0)
    const five = future(60_000)
    expect(run(['--five', '20', '--five-reset', String(five)]).status).toBe(0)
    const data = read()
    expect(data.fiveHour).toEqual({ pct: 20, resetsAt: five })
    expect(data.sevenDay).toEqual({ pct: 40, resetsAt: seven })
  })

  it('descarta la ventana ausente si expiro', () => {
    writeFileSync(file, JSON.stringify({ fiveHour: null, sevenDay: { pct: 90, resetsAt: Date.now() - 1000 }, updatedAt: 1 }))
    const five = future(60_000)
    expect(run(['--five', '5', '--five-reset', String(five)]).status).toBe(0)
    expect(read().sevenDay).toBeNull()
  })

  it('usa el mismo formato que statusline.cjs', () => {
    const resetSec = Math.floor(future(3_600_000) / 1000)
    const input = JSON.stringify({ rate_limits: { five_hour: { used_percentage: 42, resets_at: resetSec } } })
    const env: NodeJS.ProcessEnv = { ...process.env, CLAUDEHUB_DATA: dir }
    delete env.CLAUDEHUB_PLAN
    delete env.CLAUDEHUB_WINDOWS
    spawnSync(process.execPath, [STATUSLINE], { env, input, encoding: 'utf8' })
    const fromStatusline = read()

    expect(run(['--five', '42', '--five-reset', String(resetSec * 1000)]).status).toBe(0)
    const fromScript = read()
    expect(Object.keys(fromScript).sort()).toEqual(Object.keys(fromStatusline).sort())
    expect(fromScript.fiveHour).toEqual(fromStatusline.fiveHour)
    expect(fromScript.sevenDay).toEqual(fromStatusline.sevenDay)
  })
})
