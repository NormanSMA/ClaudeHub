import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseFile } from '../src/core/parse'
import { costOf, priceOf } from '../src/core/pricing'
import type { Rec } from '../src/core/types'

const rows: [string, number, number, number, number, number][] = [
  ['claude-fable-5-1', 10, 50, 12.5, 20, 0.25],
  ['claude-fable-5', 10, 50, 12.5, 20, 1],
  ['claude-opus-5-5', 4, 20, 5, 8, 0.2],
  ['claude-opus-5', 5, 25, 6.25, 10, 0.5],
  ['claude-opus-4-8', 5, 25, 6.25, 10, 0.5],
  ['claude-opus-4-7', 5, 25, 6.25, 10, 0.5],
  ['claude-opus-4-6', 5, 25, 6.25, 10, 0.5],
  ['claude-opus-4-5', 5, 25, 6.25, 10, 0.5],
  ['claude-opus-4-1', 15, 75, 18.75, 30, 1.5],
  ['claude-opus-4', 15, 75, 18.75, 30, 1.5],
  ['claude-sonnet-5-5', 2, 10, 2.5, 4, 0.2],
  ['claude-sonnet-5', 2, 10, 2.5, 4, 0.2],
  ['claude-sonnet-4-6', 3, 15, 3.75, 6, 0.3],
  ['claude-sonnet-4-5', 3, 15, 3.75, 6, 0.3],
  ['claude-sonnet-4', 3, 15, 3.75, 6, 0.3],
  ['claude-haiku-5-5', 0.1, 0.5, 0.125, 0.2, 0.01],
  ['claude-haiku-4-5', 1, 5, 1.25, 2, 0.1],
  ['gpt-6.1-sol', 2, 10, 2, 2, 0.1],
  ['gemini-3-flash-preview', 0.5, 3, 0.5, 0.5, 0.05],
]

const rec: Rec = {
  id: 'precio',
  ts: Date.UTC(2026, 9, 22),
  model: 'claude-haiku-4-5',
  input: 100,
  cacheWrite: 80,
  cacheRead: 200,
  output: 50,
  session: 'sesion',
  project: 'proyecto',
  role: 'orchestrator',
}

describe('tarifas', () => {
  it.each(rows)('resuelve la fila de %s', (model, input, output, cacheWrite, cacheWrite1h, cacheRead) => {
    expect(priceOf(model)).toEqual({ input, output, cacheWrite, cacheWrite1h, cacheRead })
  })

  it.each(['desconocido', 'codex-auto-review', 'claude-opus-4-9', 'gpt-6.1-sol-extra', 'toString'])('devuelve null para %s', (model) => {
    expect(priceOf(model)).toBeNull()
    expect(costOf({ ...rec, model })).toBeNull()
  })

  it.each(rows)('acepta el sufijo de fecha de %s', (model) => {
    expect(priceOf(`${model}-20251001`)).toEqual(priceOf(model))
  })

  it('acepta versiones de Claude anteriores al nombre de familia', () => {
    expect(priceOf('claude-4-5-haiku-20251001')).toEqual(priceOf('claude-haiku-4-5'))
  })

  it('cambia Haiku 5.5 solamente por encima de 100k', () => {
    expect(priceOf('claude-haiku-5-5', undefined, 100_000)).toEqual(priceOf('claude-haiku-5-5'))
    expect(priceOf('claude-haiku-5-5', undefined, 100_001)).toEqual({
      input: 0.5, output: 2.5, cacheWrite: 0.625, cacheWrite1h: 1, cacheRead: 0.05,
    })
  })

  it('cambia GPT 6.1 Sol solamente por encima de 272k', () => {
    expect(priceOf('gpt-6.1-sol', undefined, 272_000)).toEqual(priceOf('gpt-6.1-sol'))
    expect(priceOf('gpt-6.1-sol', undefined, 272_001)).toEqual({
      input: 4, output: 15, cacheWrite: 4, cacheWrite1h: 4, cacheRead: 0.2,
    })
  })

  it('cambia Gemini 3.8 Flash al comenzar 2027 en UTC', () => {
    const boundary = Date.UTC(2027, 0, 1)
    expect(priceOf('gemini-3.8-flash', undefined, 0, boundary - 1)).toEqual({
      input: 0.75, output: 3.75, cacheWrite: 0.75, cacheWrite1h: 0.75, cacheRead: 0.075,
    })
    expect(priceOf('gemini-3.8-flash', undefined, 0, boundary)).toEqual({
      input: 1.5, output: 7.5, cacheWrite: 1.5, cacheWrite1h: 1.5, cacheRead: 0.15,
    })
    expect(priceOf('gemini-3.8-flash-20261022', undefined, 0, boundary + 1)).toEqual(
      priceOf('gemini-3.8-flash', undefined, 0, boundary),
    )
  })

  it('reemplaza campos parciales por nombre visible despues de seleccionar el nivel', () => {
    expect(priceOf('claude-haiku-4-5-20251001', { 'Haiku 4.5': { input: 0 } })).toEqual({
      input: 0, output: 5, cacheWrite: 1.25, cacheWrite1h: 2, cacheRead: 0.1,
    })
    expect(priceOf('gpt-6.1-sol', { 'GPT 6.1 Sol': { output: 7 } }, 272_001)).toEqual({
      input: 4, output: 7, cacheWrite: 4, cacheWrite1h: 4, cacheRead: 0.2,
    })
    expect(priceOf('claude-haiku-4-5', { 'claude-haiku-4-5': { input: 0 } })).toEqual(priceOf('claude-haiku-4-5'))
  })

  it('crea una tarifa desconocida con ceros para campos ausentes', () => {
    expect(priceOf('codex-auto-review', { 'codex-auto-review': { output: 3 } })).toEqual({
      input: 0, output: 3, cacheWrite: 0, cacheWrite1h: 0, cacheRead: 0,
    })
    expect(priceOf('desconocido', { desconocido: {} })).toEqual({
      input: 0, output: 0, cacheWrite: 0, cacheWrite1h: 0, cacheRead: 0,
    })
    expect(priceOf('toString', {})).toBeNull()
  })
})

describe('costo por registro', () => {
  it('cobra la escritura de una hora una sola vez', () => {
    expect(costOf({ ...rec, cacheWrite1h: 30 })).toBeCloseTo(0.0004925, 12)
    expect(costOf(rec)).toBeCloseTo(0.00047, 12)
    expect(costOf({ ...rec, cacheWrite1h: 0 })).toBeCloseTo(0.00047, 12)
  })

  it('acota la escritura de 1 h a la escritura total', () => {
    expect(costOf({ ...rec, cacheWrite: 20, cacheWrite1h: 30 })).toBeCloseTo(0.00041, 12)
  })

  it.each([
    ['claude-haiku-5-5', 100_000, 0.0625005],
    ['gpt-6.1-sol', 272_000, 1.088004],
  ] as const)('suma toda la entrada para seleccionar el nivel de %s', (model, cacheWrite, expected) => {
    expect(costOf({ ...rec, model, input: 1, cacheWrite, cacheRead: 0, output: 0 })).toBeCloseTo(expected, 12)
  })

  it('incluye lecturas de cache al seleccionar el nivel', () => {
    expect(costOf({ ...rec, model: 'claude-haiku-5-5', input: 1, cacheWrite: 0, cacheRead: 100_000, output: 0 }))
      .toBeCloseTo(0.0050005, 12)
  })

  it('selecciona la tarifa temporal con la fecha del registro', () => {
    const gemini = { ...rec, model: 'gemini-3.8-flash', input: 1_000_000, cacheWrite: 0, cacheRead: 0, output: 0 }
    expect(costOf({ ...gemini, ts: Date.UTC(2027, 0, 1) - 1 })).toBe(0.75)
    expect(costOf({ ...gemini, ts: Date.UTC(2027, 0, 1) })).toBe(1.5)
  })

  it('aplica overrides parciales al costo', () => {
    expect(costOf(rec, { 'Haiku 4.5': { output: 0 } })).toBeCloseTo(0.00022, 12)
    expect(costOf({ ...rec, model: 'codex-auto-review' }, { 'codex-auto-review': { output: 3 } })).toBeCloseTo(0.00015, 12)
  })
})

describe('lectura de escritura de una hora', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ch-pricing-'))
  const file = join(dir, 'sesion.jsonl')

  it.each([30, 0, -1, '30', null, undefined])('lee solamente numeros positivos: %s', (value) => {
    writeFileSync(file, JSON.stringify({
      type: 'assistant',
      timestamp: '2026-10-22T00:00:00Z',
      message: {
        id: 'precio',
        model: rec.model,
        usage: {
          input_tokens: 100,
          cache_creation_input_tokens: 80,
          cache_creation: { ephemeral_1h_input_tokens: value },
          cache_read_input_tokens: 200,
          output_tokens: 50,
        },
      },
    }) + '\n')
    const [parsed] = parseFile(file).recs
    expect(parsed.cacheWrite).toBe(80)
    if (value === 30) {
      expect(parsed.cacheWrite1h).toBe(30)
      expect(costOf(parsed)).toBeCloseTo(0.0004925, 12)
    } else {
      expect(parsed).not.toHaveProperty('cacheWrite1h')
    }
  })
})
