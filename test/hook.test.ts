import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

const script = resolve(import.meta.dirname, '../scripts/hook.cjs')
const dir = mkdtempSync(join(tmpdir(), 'ch-hook-'))
const events = join(dir, 'events.jsonl')
const rotated = join(dir, 'events.1.jsonl')

function run(payload: unknown, source?: string) {
  return spawnSync(process.execPath, source ? [script, source] : [script], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    env: { ...process.env, CLAUDEHUB_DATA: dir },
    encoding: 'utf8',
    timeout: 5000,
  })
}

function lines() {
  if (!existsSync(events)) return []
  return readFileSync(events, 'utf8').split('\n').filter(Boolean)
}

beforeEach(() => {
  rmSync(events, { force: true })
  rmSync(rotated, { force: true })
})

afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('hook de estado', () => {
  it('anota un evento valido con el formato esperado', () => {
    const r = run({ hook_event_name: 'PreToolUse', session_id: 's1', cwd: 'C:\\Proyectos\\X', tool_name: 'Bash' })
    expect(r.status).toBe(0)
    expect(r.stdout).toBe('')
    expect(r.stderr).toBe('')
    const rec = JSON.parse(lines()[0])
    expect(rec).toMatchObject({ v: 1, source: 'claude', session: 's1', event: 'PreToolUse', state: 'tool', tool: 'Bash', cwd: 'C:\\Proyectos\\X' })
    expect(typeof rec.ts).toBe('number')
  })

  it('usa la fuente codex cuando se pasa como argumento', () => {
    run({ hook_event_name: 'Stop', session_id: 's2' }, 'codex')
    expect(JSON.parse(lines()[0])).toMatchObject({ source: 'codex', state: 'done' })
  })

  it('mapea todos los eventos a su estado', () => {
    const map: Record<string, string> = {
      SessionStart: 'starting',
      UserPromptSubmit: 'thinking',
      PreToolUse: 'tool',
      PostToolUse: 'thinking',
      PermissionRequest: 'waiting',
      PermissionDenied: 'thinking',
      PostToolUseFailure: 'error',
      StopFailure: 'error',
      Stop: 'done',
      SessionEnd: 'idle',
    }
    for (const event of Object.keys(map)) run({ hook_event_name: event, session_id: 's' })
    expect(lines().map((l) => JSON.parse(l).state)).toEqual(Object.values(map))
  })

  it('no escribe nada con un evento desconocido', () => {
    const r = run({ hook_event_name: 'Inventado', session_id: 's' })
    expect(r.status).toBe(0)
    expect(r.stdout).toBe('')
    expect(r.stderr).toBe('')
    expect(lines()).toEqual([])
  })

  it('sale con codigo 0 y sin salida con stdin vacio', () => {
    const r = run('')
    expect(r.status).toBe(0)
    expect(r.stdout).toBe('')
    expect(r.stderr).toBe('')
    expect(lines()).toEqual([])
  })

  it('sale con codigo 0 y sin salida con JSON roto o no objeto', () => {
    for (const bad of ['{"hook_event_name": "Stop"', 'no es json', 'null', '42', '[]']) {
      const r = run(bad)
      expect(r.status).toBe(0)
      expect(r.stdout).toBe('')
      expect(r.stderr).toBe('')
    }
    expect(lines()).toEqual([])
  })

  it('termina en menos de 1 s aunque stdin quede abierto', async () => {
    const t0 = Date.now()
    const child = spawn(process.execPath, [script], { env: { ...process.env, CLAUDEHUB_DATA: dir }, stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    const code = await new Promise<number | null>((done) => child.on('close', done))
    expect(code).toBe(0)
    expect(out).toBe('')
    expect(Date.now() - t0).toBeLessThan(1000)
  })

  it('limita la linea a 512 bytes recortando cwd y tool', () => {
    run({ hook_event_name: 'PreToolUse', session_id: 's'.repeat(200), cwd: 'C:\\' + 'ñ'.repeat(5000), tool_name: 'mcp__' + 'x'.repeat(5000) })
    const raw = readFileSync(events, 'utf8')
    expect(Buffer.byteLength(raw)).toBeLessThanOrEqual(512)
    const rec = JSON.parse(raw)
    expect(rec.event).toBe('PreToolUse')
    expect(rec.cwd.length).toBeLessThan(5000)
  })

  it('no guarda el prompt, tool_input ni la salida de herramientas', () => {
    run({
      hook_event_name: 'UserPromptSubmit',
      session_id: 's',
      prompt: 'SECRETO-PROMPT',
      tool_input: { command: 'SECRETO-COMANDO' },
      tool_response: 'SECRETO-SALIDA',
    })
    const raw = readFileSync(events, 'utf8')
    expect(raw).not.toContain('SECRETO')
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(['cwd', 'event', 'session', 'source', 'state', 'tool', 'ts', 'v'])
  })

  it('rota a events.1.jsonl al pasar de 256 KB', () => {
    writeFileSync(events, 'x'.repeat(256 * 1024 + 10) + '\n')
    const r = run({ hook_event_name: 'Stop', session_id: 's' })
    expect(r.status).toBe(0)
    expect(statSync(rotated).size).toBeGreaterThan(256 * 1024)
    expect(lines()).toHaveLength(1)
    expect(JSON.parse(lines()[0]).state).toBe('done')
  })

  it('no rota por debajo de 256 KB', () => {
    writeFileSync(events, 'x'.repeat(1000) + '\n')
    run({ hook_event_name: 'Stop', session_id: 's' })
    expect(existsSync(rotated)).toBe(false)
    expect(lines()).toHaveLength(2)
  })
})
