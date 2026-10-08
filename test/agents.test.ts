import { appendFileSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { agentStates, collisions, mascotState, readEvents, type HookEvent, type HookState } from '../src/core/agents'

const NOW = 1_800_000_000_000
const MIN = 60_000

const dir = mkdtempSync(join(tmpdir(), 'ch-agents-'))
const prevData = process.env.CLAUDEHUB_DATA
process.env.CLAUDEHUB_DATA = dir

afterAll(() => {
  if (prevData === undefined) delete process.env.CLAUDEHUB_DATA
  else process.env.CLAUDEHUB_DATA = prevData
})

function ev(over: Partial<HookEvent> & { ts: number }): HookEvent {
  return { v: 1, source: 'claude', session: 's1', event: 'X', state: 'thinking', tool: '', cwd: 'C:\\Proyectos\\Demo', ...over }
}

const line = (e: unknown) => JSON.stringify(e) + '\n'

describe('readEvents', () => {
  it('lee con CLAUDEHUB_DATA, descarta lineas rotas y otras versiones', () => {
    writeFileSync(
      join(dir, 'events.jsonl'),
      line(ev({ ts: 1 })) +
        '{linea rota\n' +
        line({ ...ev({ ts: 2 }), v: 2 }) +
        line({ ...ev({ ts: 3 }), source: 'gemini' }) +
        line({ ...ev({ ts: 4 }), state: 'raro' }) +
        line(ev({ ts: 5, state: 'done' })),
    )
    const out = readEvents()
    expect(out.map((e) => e.ts)).toEqual([1, 5])
  })

  it('devuelve vacio si no hay archivos', () => {
    expect(readEvents(join(dir, 'no-existe'))).toEqual([])
  })

  it('completa con events.1.jsonl en orden cronologico', () => {
    const d = mkdtempSync(join(tmpdir(), 'ch-agents-rot-'))
    writeFileSync(join(d, 'events.1.jsonl'), line(ev({ ts: 10 })))
    writeFileSync(join(d, 'events.jsonl'), line(ev({ ts: 20 })))
    expect(readEvents(d).map((e) => e.ts)).toEqual([10, 20])
  })

  it('lee solo el final y descarta la linea cortada', () => {
    const d = mkdtempSync(join(tmpdir(), 'ch-agents-tail-'))
    for (let i = 1; i <= 50; i++) appendFileSync(join(d, 'events.jsonl'), line(ev({ ts: i })))
    const out = readEvents(d, 600)
    expect(out.length).toBeGreaterThan(0)
    expect(out.length).toBeLessThan(50)
    expect(out[out.length - 1].ts).toBe(50)
  })
})

describe('agentStates', () => {
  it('toma el ultimo evento y calcula since de la racha', () => {
    const out = agentStates(
      [
        ev({ ts: NOW - 4000, state: 'starting' }),
        ev({ ts: NOW - 3000, state: 'thinking' }),
        ev({ ts: NOW - 2000, state: 'thinking' }),
        ev({ ts: NOW - 1000, state: 'tool', tool: 'Bash' }),
      ],
      NOW,
    )
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ source: 'claude', session: 's1', project: 'Demo', state: 'tool', since: NOW - 1000, tool: 'Bash', lastTs: NOW - 1000, stuck: false })
    expect(out[0].activeSince).toBe(NOW - 4000)
  })

  it('separa sesiones y fuentes', () => {
    const out = agentStates([ev({ ts: NOW - 1 }), ev({ ts: NOW - 1, session: 's2' }), ev({ ts: NOW - 1, source: 'codex' })], NOW)
    expect(out).toHaveLength(3)
  })

  it('omite sesiones viejas o en idle', () => {
    const out = agentStates(
      [
        ev({ ts: NOW - 30 * MIN - 1, session: 'vieja' }),
        ev({ ts: NOW - 30 * MIN, session: 'limite' }),
        ev({ ts: NOW - 1000, session: 'idle', state: 'idle' }),
      ],
      NOW,
    )
    expect(out.map((s) => s.session)).toEqual(['limite'])
  })

  it('marca atasco de thinking solo despues de 5 min', () => {
    const at = (ms: number) => agentStates([ev({ ts: NOW - ms, state: 'thinking' })], NOW)[0].stuck
    expect(at(5 * MIN)).toBe(false)
    expect(at(5 * MIN + 1)).toBe(true)
  })

  it('marca atasco de tool solo despues de 15 min', () => {
    const at = (ms: number) => agentStates([ev({ ts: NOW - ms, state: 'tool', tool: 'Bash' })], NOW)[0].stuck
    expect(at(15 * MIN)).toBe(false)
    expect(at(15 * MIN + 1)).toBe(true)
    // thinking a 6 min es atasco, tool a 6 min no
    expect(agentStates([ev({ ts: NOW - 6 * MIN, state: 'tool' })], NOW)[0].stuck).toBe(false)
  })

  it('un estado distinto reinicia since', () => {
    const out = agentStates([ev({ ts: NOW - 20 * MIN, state: 'thinking' }), ev({ ts: NOW - 10 * MIN, state: 'tool' }), ev({ ts: NOW - 9 * MIN, state: 'thinking' })], NOW)
    expect(out[0].since).toBe(NOW - 9 * MIN)
    expect(out[0].stuck).toBe(true)
  })

  it('project sin ruta queda vacio y nunca es la ruta completa', () => {
    const out = agentStates(
      [ev({ ts: NOW - 1, session: 'a', cwd: '' }), ev({ ts: NOW - 1, session: 'b', cwd: '/home/ana/proyectos/web/' }), ev({ ts: NOW - 1, session: 'c', cwd: 'C:\\x\\y\\Demo' })],
      NOW,
    )
    const by = Object.fromEntries(out.map((s) => [s.session, s.project]))
    expect(by).toEqual({ a: '', b: 'web', c: 'Demo' })
    expect(JSON.stringify(out)).not.toMatch(/proyectos|home|\\\\x/)
  })
})

describe('collisions', () => {
  const two = (secs: number, cwdB = 'C:\\Proyectos\\Demo', stateB: HookState = 'tool') =>
    agentStates(
      [
        ev({ ts: NOW - secs * 1000, session: 'a', state: 'thinking' }),
        ev({ ts: NOW - secs * 1000, session: 'b', state: stateB, cwd: cwdB, source: 'codex' }),
      ],
      NOW,
    )

  it('no avisa a 9 s y avisa a 10 s', () => {
    expect(collisions(two(9), NOW)).toEqual([])
    const out = collisions(two(10), NOW)
    expect(out).toHaveLength(1)
    expect(out[0].project).toBe('Demo')
    expect(out[0].since).toBe(NOW - 10_000)
    expect(out[0].sessions).toEqual([
      { source: 'claude', session: 'a' },
      { source: 'codex', session: 'b' },
    ])
  })

  it('normaliza separadores y barra final', () => {
    expect(collisions(two(20, 'C:/Proyectos/Demo/'), NOW)).toHaveLength(1)
  })

  it.runIf(process.platform === 'win32')('ignora mayusculas en Windows', () => {
    expect(collisions(two(20, 'c:\\proyectos\\DEMO'), NOW)).toHaveLength(1)
  })

  it('no avisa con carpetas distintas, estados no activos o la misma sesion', () => {
    expect(collisions(two(20, 'C:\\Proyectos\\Otro'), NOW)).toEqual([])
    expect(collisions(two(20, 'C:\\Proyectos\\Demo', 'waiting'), NOW)).toEqual([])
    const solo = agentStates([ev({ ts: NOW - 20_000 }), ev({ ts: NOW - 10_000, state: 'tool' })], NOW)
    expect(collisions(solo, NOW)).toEqual([])
  })

  it('no agrupa sesiones sin cwd', () => {
    expect(collisions(two(20, ''), NOW)).toEqual([])
  })

  it('no expone el cwd completo', () => {
    const out = collisions(two(20), NOW)
    expect(JSON.stringify(out)).not.toContain('Proyectos')
  })
})

describe('mascotState', () => {
  const st = (state: HookState, over: Partial<HookEvent> = {}) => agentStates([ev({ ts: NOW - 1000, state, ...over })], NOW)

  it('devuelve sleeping sin sesiones', () => {
    expect(mascotState([], [], NOW)).toBe('sleeping')
  })

  it('respeta la prioridad', () => {
    const all = [
      ...st('thinking', { session: 'a' }),
      ...st('tool', { session: 'b' }),
      ...st('error', { session: 'c' }),
      ...st('waiting', { session: 'd' }),
    ]
    expect(mascotState(all, [], NOW)).toBe('waiting')
    expect(mascotState(all.filter((s) => s.state !== 'waiting'), [], NOW)).toBe('error')
    const ok = all.filter((s) => s.state === 'tool' || s.state === 'thinking')
    expect(mascotState(ok, [], NOW)).toBe('tool')
    expect(mascotState(ok.filter((s) => s.state === 'thinking'), [], NOW)).toBe('thinking')
  })

  it('alert por atasco o choque, por encima de tool', () => {
    const stuck = agentStates([ev({ ts: NOW - 6 * MIN, state: 'thinking', session: 'a' }), ev({ ts: NOW - 1000, state: 'tool', session: 'b', cwd: 'C:\\Otro' })], NOW)
    expect(mascotState(stuck, [], NOW)).toBe('alert')
    const fresh = st('tool')
    expect(mascotState(fresh, [{ project: 'Demo', sessions: [], since: NOW }], NOW)).toBe('alert')
  })

  it('happy con done reciente y sleeping si ya paso', () => {
    expect(mascotState(st('done'), [], NOW)).toBe('happy')
    const old = agentStates([ev({ ts: NOW - 10_000, state: 'done' })], NOW)
    expect(mascotState(old, [], NOW)).toBe('sleeping')
  })
})
