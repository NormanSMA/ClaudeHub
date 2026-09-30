import { appendFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseFile } from '../src/core/parse'
import { scan } from '../src/core/scan'
import { modelName } from '../src/core/models'
import { summary, rolesReport, sessionTitle, activeReport } from '../src/core/aggregate'
import { demoData } from '../src/core/demo'

const line = (id: string, out: number, extra: object = {}) =>
  JSON.stringify({
    type: 'assistant',
    isSidechain: false,
    timestamp: '2026-09-01T15:00:00.000Z',
    sessionId: 's1',
    message: {
      id,
      model: 'claude-opus-5',
      usage: { input_tokens: 2, cache_creation_input_tokens: 10, cache_read_input_tokens: 100, output_tokens: out },
    },
    ...extra,
  })

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'ch-'))
  const proj = join(root, 'projects', 'C--Proyectos-demo')
  mkdirSync(join(proj, 's1', 'subagents'), { recursive: true })
  // msg_a aparece en 3 lineas (un bloque por linea): debe contar una vez
  writeFileSync(
    join(proj, 's1.jsonl'),
    [line('msg_a', 5), line('msg_a', 5), line('msg_a', 5), line('msg_b', 7), 'no es json', ''].join('\n'),
  )
  writeFileSync(join(proj, 's1', 'subagents', 'agent-x.jsonl'), line('msg_c', 20, { isSidechain: true }))
  writeFileSync(join(proj, 's1', 'subagents', 'agent-x.meta.json'), JSON.stringify({ agentType: 'Explore' }))
  return join(root, 'projects')
}

describe('parser', () => {
  it('deduplica por message.id', () => {
    const root = fixture()
    const { recs } = parseFile(join(root, 'C--Proyectos-demo', 's1.jsonl'))
    expect(recs).toHaveLength(2)
  })

  it('separa orquestador y subagente y etiqueta el agente', () => {
    const { recs } = scan(fixture(), false)
    const r = rolesReport(recs, 'all')
    expect(r.orchestrator.messages).toBe(2)
    expect(r.subagent.messages).toBe(1)
    expect(r.agents[0].agent).toBe('Explore')
    expect(recs.every((x) => x.project === 'demo' && x.session === 's1')).toBe(true)
  })

  it('suma input + cache + output', () => {
    const { recs } = scan(fixture(), false)
    const s = summary(recs, 'all')
    // msg_a 117 + msg_b 119 + msg_c 132
    expect(s.tokens.total).toBe(368)
    expect(s.sessions).toBe(1)
  })

  it('lee solo lo nuevo cuando el archivo crece', () => {
    const root = fixture()
    const file = join(root, 'C--Proyectos-demo', 's1.jsonl')
    const first = parseFile(file)
    expect(first.recs).toHaveLength(2)
    appendFileSync(file, '\n' + line('msg_d', 9) + '\n')
    const second = parseFile(file, first)
    expect(second.recs).toHaveLength(3)
    expect(second.offset).toBeGreaterThan(first.offset)
  })

  it('arma el titulo del chat: customTitle, o ultimo prompt con espacios colapsados', () => {
    expect(sessionTitle({ title: 'Mi chat' })).toBe('Mi chat')
    expect(sessionTitle({ lastPrompt: 'revisa las   sesiones\ny los  servidores' })).toBe('revisa las sesiones y los servidores')
    expect(sessionTitle({ lastPrompt: 'x'.repeat(100) })).toHaveLength(70)
    expect(sessionTitle(undefined)).toBe('Sin titulo')
  })

  it('el modo demo arma tres chats activos con contexto verde, ambar y rojo', () => {
    const { recs, sessions } = demoData(Date.now())
    const active = activeReport(recs, sessions)
    expect(active).toHaveLength(3)
    const pct = active.map((a) => Math.round(a.context.pct * 100)).sort((a, b) => a - b)
    expect(pct).toEqual([31, 66, 94])
    expect(active.some((a) => a.activeSubagents > 0)).toBe(true)
  })

  it('nombra modelos', () => {
    expect(modelName('claude-opus-5')).toBe('Opus 5')
    expect(modelName('claude-opus-5-5')).toBe('Opus 5.5')
    expect(modelName('claude-sonnet-4-5')).toBe('Sonnet 4.5')
    expect(modelName('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
    expect(modelName('claude-opus-4-8')).toBe('Opus 4.8')
  })
})
