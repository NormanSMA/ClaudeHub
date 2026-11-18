import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DatabaseSync } from 'node:sqlite'
import {
  clearAntigravityQuotasCache,
  clearAntigravitySummariesCache,
  initAntigravityState,
  latestAntigravityQuotas,
  parseAntigravity,
  parseAntigravityChunk,
  readAntigravitySummaries,
  seenAntigravityIds,
} from '../src/core/sources/antigravity'
import { modelName } from '../src/core/models'
import { costOf, priceOf } from '../src/core/pricing'
import { scan } from '../src/core/scan'
import { sanitize } from '../src/core/config'

const line = (o: Record<string, unknown>): string => JSON.stringify(o)
const planner = (step: number, input: number, cache: number, output: number): string =>
  line({ step_index: step, type: 'PLANNER_RESPONSE', created_at: '2026-11-18T10:00:00Z', content: 'texto privado', input_tokens: input, cache_read_tokens: cache, output_tokens: output })
const modelChange = (step: number, to: string): string =>
  line({ step_index: step, type: 'USER_INPUT', created_at: '2026-11-18T10:00:00Z', content: `<USER_REQUEST>\nArregla el login\nsegunda linea\n</USER_REQUEST>\nThe user changed setting \`Model Selection\` from Gemini 4 Argon (High) to ${to}.` })

describe('parseAntigravity', () => {
  it('crea un registro por PLANNER_RESPONSE con tokens', () => {
    const text = [planner(1, 100, 50, 20), planner(2, 0, 0, 0), line({ step_index: 3, type: 'USER_INPUT', content: 'x', input_tokens: 9 })].join('\n')
    const recs = parseAntigravity(text, 'abc')
    expect(recs).toHaveLength(1)
    expect(recs[0]).toMatchObject({
      id: 'antigravity:abc:1',
      input: 100,
      cacheRead: 50,
      cacheWrite: 0,
      output: 20,
      session: 'abc',
      project: 'antigravity',
      role: 'orchestrator',
      source: 'antigravity',
    })
    expect(recs[0].ts).toBe(Date.parse('2026-11-18T10:00:00Z'))
  })

  it('ignora fechas invalidas y lineas corruptas', () => {
    const bad = line({ step_index: 5, type: 'PLANNER_RESPONSE', created_at: 'no', input_tokens: 5 })
    expect(parseAntigravity(`${bad}\n{"step_index":\n${planner(6, 1, 0, 0)}`, 's')).toHaveLength(1)
  })

  it('es incremental y deduplica', () => {
    const state = initAntigravityState('s1')
    const seen = new Map<string, number>()
    const a = parseAntigravityChunk(planner(1, 1, 0, 1) + '\n', state, seen)
    const b = parseAntigravityChunk(planner(1, 1, 0, 1) + '\n' + planner(2, 2, 0, 2) + '\n', state, seen)
    expect(a).toHaveLength(1)
    expect(b.map((r) => r.id)).toEqual(['antigravity:s1:2'])
    expect([...seenAntigravityIds([...a, ...b]).keys()].sort()).toEqual(['antigravity:s1:1', 'antigravity:s1:2'])
  })

  it('conserva mayor salida al repetir step_index y descarta negativos', () => {
    const state = initAntigravityState('s1')
    const seen = new Map<string, number>()
    const a = parseAntigravityChunk(planner(1, -50, 10, 5) + '\n', state, seen)
    const b = parseAntigravityChunk(planner(1, 20, 10, 15) + '\n', state, seen)
    expect(a[0]).toMatchObject({ input: 0, cacheRead: 10, output: 5 })
    expect(b[0]).toMatchObject({ id: 'antigravity:s1:1', input: 20, output: 15 })
  })

  it('detecta el cambio de modelo solo en USER_INPUT y no guarda texto del pedido', () => {
    const fakeModelMsg = line({ step_index: 1, type: 'PLANNER_RESPONSE', created_at: '2026-11-18T10:00:00Z', content: 'The user changed setting `Model Selection` from Gemini 4 Argon (High) to Claude Opus 5.5 (High).', input_tokens: 5, output_tokens: 2 })
    const text = [modelChange(0, 'Gemini 4 Hydrogen (High)'), fakeModelMsg, modelChange(2, 'Claude Opus 5.5 (Low)'), planner(3, 1, 0, 1), modelChange(4, 'GPT-OSS 120B (Medium)'), planner(5, 1, 0, 1)].join('\n')
    const state = initAntigravityState('s')
    const recs = parseAntigravityChunk(text, state, new Map())
    expect(recs.map((r) => r.model)).toEqual(['gemini-4-hydrogen', 'claude-opus-5-5', 'gpt-oss-120b'])
    expect(state.title).toBeUndefined()
  })

  it('mapea nombres visibles a ids', () => {
    const ids = ['Orchestrator (Argon)', 'Gemini 3.8 Flash (Low)', 'Claude Sonnet 5.5 (High)', 'Claude Opus 4.6 (Thinking)', 'Claude Opus 4'].map((n) => {
      const r = parseAntigravityChunk(modelChange(0, n) + '\n' + planner(1, 1, 0, 1), initAntigravityState('s'), new Map())
      return r[0].model
    })
    expect(ids).toEqual(['gemini-4-argon', 'gemini-3.8-flash', 'claude-sonnet-5-5', 'claude-opus-4-6', 'claude-opus-4'])
  })

  it('marca subagentes con la sesion padre', () => {
    const state = { ...initAntigravityState('hijo'), parentSession: 'padre', agent: 'worker', project: 'App' }
    const [r] = parseAntigravityChunk(planner(1, 1, 0, 1), state, new Map())
    expect(r).toMatchObject({ session: 'padre', role: 'subagent', agent: 'worker', agentFile: 'hijo', project: 'App', id: 'antigravity:hijo:1' })
  })
})

describe('modelos y precios', () => {
  it('limpia sufijos de esfuerzo en nombres', () => {
    expect(modelName('claude-opus-5-5-high')).toBe('Opus 5.5')
    expect(modelName('gemini-4-hydrogen-high')).toBe('Gemini 4 Hydrogen')
    expect(modelName('gemini-3.8-flash-low')).toBe('Gemini 3.8 Flash')
    expect(modelName('gemini-pro-orchestrator-g1-pro')).toBe('Gemini 4 Argon')
    expect(modelName('gemini-pro-orchestrator-g1-pro-high')).toBe('Gemini 4 Argon')
    expect(modelName('gpt-oss-120b')).toBe('GPT-OSS 120B')
    expect(modelName('gpt-oss-120b-medium')).toBe('GPT-OSS 120B')
    expect(modelName('gpt-6.2-sol')).toBe('GPT 6.2 Sol')
  })

  it('resuelve tarifas con sufijo de esfuerzo', () => {
    expect(priceOf('gemini-4-hydrogen-high')?.input).toBe(2.5)
    expect(priceOf('gemini-pro-orchestrator-g1-pro')?.output).toBe(5)
    expect(priceOf('gpt-6.2-sol', undefined, 300_000)?.input).toBe(4)
    expect(priceOf('gpt-oss-120b-medium')?.output).toBe(0.6)
    expect(priceOf('claude-opus-5-5-high')?.input).toBe(4)
    const rec = parseAntigravity(modelChange(0, 'Gemini 4 Hydrogen (High)') + '\n' + planner(1, 1_000_000, 0, 0), 's')[0]
    expect(costOf(rec)).toBeCloseTo(2.5)
  })
})

describe('configuracion', () => {
  it('antigravity esta activa por defecto', () => {
    expect(sanitize({}).sources.antigravity).toBe(true)
    expect(sanitize({ sources: { antigravity: false } }).sources.antigravity).toBe(false)
  })
})

describe('lectura de disco', () => {
  let dir: string
  const prev = process.env.ANTIGRAVITY_DIR
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'agy-'))
    process.env.ANTIGRAVITY_DIR = dir
    clearAntigravitySummariesCache()
    clearAntigravityQuotasCache()
  })
  afterEach(() => {
    if (prev === undefined) delete process.env.ANTIGRAVITY_DIR
    else process.env.ANTIGRAVITY_DIR = prev
    rmSync(dir, { recursive: true, force: true })
  })

  const transcript = (id: string): string => {
    const logs = join(dir, 'brain', id, '.system_generated', 'logs')
    mkdirSync(logs, { recursive: true })
    return join(logs, 'transcript.jsonl')
  }

  it('devuelve un mapa vacio sin base', () => {
    expect(readAntigravitySummaries(dir).size).toBe(0)
  })

  it('lee conversation_summaries.db sintetica sin usar preview', () => {
    const db = new DatabaseSync(join(dir, 'conversation_summaries.db'))
    db.exec('CREATE TABLE conversation_summaries (conversation_id text, title text, preview text, workspace_uris text, agent_name text, parent_conversation_id text)')
    const ins = db.prepare('INSERT INTO conversation_summaries VALUES (?, ?, ?, ?, ?, ?)')
    ins.run('root', 'Mi titulo', 'Texto privado', JSON.stringify(['file:///c%3A/Proyectos/ClaudeHub']), '', '')
    ins.run('child', '', 'Arreglar el login', '[]', 'worker', 'root')
    db.close()
    const m = readAntigravitySummaries(dir)
    expect(m.get('root')).toEqual({ title: 'Mi titulo', project: 'ClaudeHub', cwd: 'c:/Proyectos/ClaudeHub' })
    expect(m.get('child')).toEqual({ title: '', project: '', cwd: null, parentSession: 'root', agent: 'worker' })
  })

  it('extrae las cuotas vigentes del snapshot mas reciente', () => {
    const now = Date.parse('2026-11-18T12:00:00Z')
    const quotas = {
      models: ['a'],
      quotas: {
        'claude-opus-5-5-high': { quota_remaining: '100%', quota_resets: '2026-11-19T01:16:51Z' },
        'claude-sonnet-5-5-low': { quota_remaining: '90%', quota_resets: '2026-11-19T01:16:51Z' },
        'gemini-4-hydrogen-high': { quota_remaining: '85%', quota_resets: '2026-11-18T22:50:12Z' },
        'gemini-3.8-flash-low': { quota_remaining: '85%', quota_resets: '2026-11-18T22:50:12Z' },
        'gemini-pro-orchestrator-g1-pro': { quota_remaining: '94%', quota_resets: '2026-11-25T20:07:30Z' },
        'gpt-oss-120b-medium': { quota_remaining: '100%', quota_resets: '2026-11-19T01:16:51Z' },
      },
    }
    const old = { ...quotas, quotas: { 'gpt-oss-120b-medium': { quota_remaining: '10%', quota_resets: '2026-11-19T01:16:51Z' } } }
    const mk = (q: unknown, at: string): string => line({ step_index: 1, type: 'TOOL', created_at: at, content: JSON.stringify(q) })
    writeFileSync(transcript('c1'), mk(quotas, '2026-11-18T10:00:00Z') + '\n' + mk(old, '2026-11-18T09:00:00Z') + '\n')
    const q = latestAntigravityQuotas(dir, now)
    expect(q?.updatedAt).toBe(Date.parse('2026-11-18T10:00:00Z'))
    const byLabel = Object.fromEntries((q?.groups ?? []).map((g) => [g.label, g]))
    expect(Object.keys(byLabel).sort()).toEqual(['Claude 5.5', 'GPT-OSS 120B', 'Gemini 4 Argon', 'Gemini 4 Hydrogen / 3.8'])
    expect(byLabel['Claude 5.5']).toMatchObject({ remainingPct: 90, usedPct: 10 })
    expect(byLabel['Gemini 4 Hydrogen / 3.8'].models.sort()).toEqual(['Gemini 3.8 Flash', 'Gemini 4 Hydrogen'])
    expect(byLabel['Gemini 4 Argon']).toMatchObject({ remainingPct: 94, resetsAt: Date.parse('2026-11-25T20:07:30Z') })
    expect(byLabel['GPT-OSS 120B'].remainingPct).toBe(100)
  })

  it('descarta cuotas vencidas', () => {
    const now = Date.parse('2026-11-20T00:00:00Z')
    const expired = { quotas: { 'claude-opus-5-5-high': { quota_remaining: '50%', quota_resets: '2026-11-19T01:00:00Z' } } }
    writeFileSync(transcript('c-exp'), line({ step_index: 1, type: 'TOOL', created_at: '2026-11-18T10:00:00Z', content: JSON.stringify(expired) }) + '\n')
    expect(latestAntigravityQuotas(dir, now)).toBeNull()
  })

  it('devuelve null sin snapshot', () => {
    writeFileSync(transcript('c2'), planner(1, 1, 0, 1) + '\n')
    expect(latestAntigravityQuotas(dir)).toBeNull()
  })

  it('scan lee transcripts de forma incremental midiendo bytes y changed', () => {
    const file = transcript('conv-1')
    writeFileSync(file, modelChange(0, 'Gemini 4 Hydrogen (Low)') + '\n' + planner(1, 10, 5, 2) + '\n')
    const root = join(dir, 'claude-empty')
    mkdirSync(root)
    let read1 = 0
    const first = scan(root, true, { extra: true, onRead: (_f, b) => (read1 += b) })
    expect(read1).toBeGreaterThan(0)
    expect(first.sources.antigravity).toMatchObject({ enabled: true, files: 1, records: 1, ok: true })
    expect(first.recs.filter((r) => r.source === 'antigravity')[0]).toMatchObject({ source: 'antigravity', model: 'gemini-4-hydrogen', session: 'conv-1' })
    let read2 = 0
    const unchanged = scan(root, true, { extra: true, changed: [file], onRead: (_f, b) => (read2 += b) })
    expect(read2).toBe(0)
    expect(unchanged.sources.antigravity.records).toBe(1)
    const extraLine = planner(2, 1, 0, 1) + '\n'
    appendFileSync(file, extraLine)
    let read3 = 0
    const second = scan(root, true, { extra: true, changed: [file], onRead: (_f, b) => (read3 += b) })
    expect(read3).toBe(Buffer.byteLength(extraLine))
    expect(second.sources.antigravity.records).toBe(2)
  })
})
