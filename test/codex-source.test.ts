import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCodex, codexRateLimits } from '../src/core/sources/codex'
import { total } from '../src/core/types'

const text = readFileSync(join(__dirname, 'fixtures', 'codex-rollout.jsonl'), 'utf8')

describe('parseCodex', () => {
  it('los incrementos suman el acumulado final', () => {
    const recs = parseCodex(text)
    expect(recs).toHaveLength(3)
    const sum = recs.reduce((a, r) => a + total(r), 0)
    expect(sum).toBe(4800)
    expect(recs.reduce((a, r) => a + r.cacheRead, 0)).toBe(3000)
    expect(recs.reduce((a, r) => a + r.input, 0)).toBe(1000)
    expect(recs.reduce((a, r) => a + r.output, 0)).toBe(800)
  })

  it('total de cada registro es el incremento de total_tokens', () => {
    expect(parseCodex(text).map(total)).toEqual([1200, 1800, 1800])
  })

  it('ids con el acumulado y mapeo de campos', () => {
    const [a, b] = parseCodex(text)
    expect(a.id).toBe('codex:sess-demo-0001:1200')
    expect(b.id).toBe('codex:sess-demo-0001:3000')
    expect(a).toMatchObject({ input: 400, cacheRead: 600, cacheWrite: 0, output: 200 })
    expect(b).toMatchObject({ input: 300, cacheRead: 1200, output: 300 })
  })

  it('lineas repetidas no duplican', () => {
    const recs = parseCodex(text + text)
    // el segundo bloque repite session_meta y los mismos acumulados: solo suben si superan el previo
    expect(new Set(recs.map((r) => r.id)).size).toBe(recs.length)
    expect(parseCodex(text)).toHaveLength(3)
  })

  it('modelo del ultimo turn_context, proyecto y sesion', () => {
    const recs = parseCodex(text)
    expect(recs.map((r) => r.model)).toEqual(['gpt-test-1', 'gpt-test-1', 'gpt-test-2'])
    for (const r of recs) {
      expect(r.project).toBe('demo-app')
      expect(r.session).toBe('sess-demo-0001')
      expect(r.role).toBe('orchestrator')
      expect(r.source).toBe('codex')
    }
    expect(recs[0].ts).toBe(Date.parse('2026-03-01T10:00:10.000Z'))
  })

  it('una linea corrupta no rompe el resto', () => {
    const recs = parseCodex(text)
    expect(recs.at(-1)?.id).toBe('codex:sess-demo-0001:4800')
    expect(() => parseCodex('{"type":"token_count" roto\n' + text)).not.toThrow()
  })

  it('archivo vacio', () => {
    expect(parseCodex('')).toEqual([])
    expect(codexRateLimits('')).toBeNull()
  })

  it('no copia texto de la conversacion', () => {
    const json = JSON.stringify(parseCodex(text))
    expect(json).not.toContain('TEXTO-SECRETO')
    expect(json).not.toContain('instructions')
  })
})

describe('parseCodex con campos por tipo en cero', () => {
  const line = (obj: unknown) => JSON.stringify(obj)
  const meta = line({ timestamp: '2026-07-09T19:34:20.000Z', type: 'session_meta', payload: { id: 'sess-old', cwd: 'C:\\demo\\viejo' } })
  const tc = (ts: string, totalTokens: number) =>
    line({
      timestamp: ts,
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: { total_token_usage: { input_tokens: 0, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 0, total_tokens: totalTokens } },
      },
    })

  it('cuenta el total_tokens aunque los campos por tipo vengan en 0', () => {
    const old = [meta, tc('2026-07-09T19:34:28.000Z', 16398), tc('2026-07-09T19:35:00.000Z', 20000)].join('\n')
    const recs = parseCodex(old)
    expect(recs.map(total)).toEqual([16398, 3602])
    expect(recs.reduce((a, r) => a + total(r), 0)).toBe(20000)
  })
})

describe('codexRateLimits', () => {
  it('devuelve el ultimo rate_limits', () => {
    expect(codexRateLimits(text)).toEqual({
      ts: Date.parse('2026-03-01T10:00:40.000Z'),
      planType: 'plus',
      primary: { usedPercent: 12.5, windowMinutes: 300, resetsAt: 1772363000 },
      secondary: { usedPercent: 14.5, windowMinutes: 10080, resetsAt: 1772903000 },
    })
  })

  it('ignora rate_limits nulos o incompletos', () => {
    const line = '{"timestamp":"2026-03-01T11:00:00.000Z","type":"event_msg","payload":{"type":"token_count","info":null,"rate_limits":null}}\n'
    expect(codexRateLimits(text + line)?.primary.usedPercent).toBe(12.5)
  })
})
