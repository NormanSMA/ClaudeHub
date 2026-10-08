import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseGemini } from '../src/core/sources/gemini'
import { total } from '../src/core/types'

const text = readFileSync(join(__dirname, 'fixtures', 'gemini-session.jsonl'), 'utf8')

describe('parseGemini', () => {
  it('deduplica por id', () => {
    const recs = parseGemini(text, 'demo-app')
    expect(recs.map((r) => r.id)).toEqual(['gemini:g-0001', 'gemini:g-0002', 'gemini:g-0004'])
    expect(parseGemini(text + text, 'demo-app')).toHaveLength(3)
  })

  it('total de cada registro es tokens.total del mensaje', () => {
    expect(parseGemini(text, 'demo-app').map(total)).toEqual([1260, 2300, 625])
  })

  it('mapea cached como cacheRead y lo resta de input', () => {
    const [a, b, c] = parseGemini(text, 'demo-app')
    expect(a).toMatchObject({ input: 400, cacheRead: 600, cacheWrite: 0, output: 260 })
    expect(b).toMatchObject({ input: 2000, cacheRead: 0, cacheWrite: 0, output: 300 })
    expect(c).toMatchObject({ input: 0, cacheRead: 500, cacheWrite: 0, output: 125 })
  })

  it('modelo, sesion, proyecto, rol, fuente y fecha', () => {
    const recs = parseGemini(text, 'demo-app')
    expect(recs.map((r) => r.model)).toEqual(['gemini-test-flash', 'gemini-test-pro', 'gemini-test-flash'])
    for (const r of recs) {
      expect(r.session).toBe('gsess-demo-0001')
      expect(r.project).toBe('demo-app')
      expect(r.role).toBe('orchestrator')
      expect(r.source).toBe('gemini')
    }
    expect(recs[0].ts).toBe(Date.parse('2026-03-02T09:00:05.000Z'))
  })

  it('mensaje sin tokens se ignora', () => {
    expect(parseGemini(text, 'demo-app').some((r) => r.id === 'gemini:g-0003')).toBe(false)
  })

  it('sin cabecera la sesion es unknown', () => {
    const body = text.split('\n').filter((l) => !l.includes('"sessionId"')).join('\n')
    expect(parseGemini(body, 'demo-app')[0].session).toBe('unknown')
  })

  it('una linea corrupta no rompe el resto', () => {
    const recs = parseGemini('{"type":"gemini" roto\n' + text, 'demo-app')
    expect(recs).toHaveLength(3)
  })

  it('no copia texto de la conversacion', () => {
    const json = JSON.stringify(parseGemini(text, 'demo-app'))
    expect(json).not.toContain('TEXTO-SECRETO')
    expect(json).not.toContain('razonamiento')
  })

  it('archivo vacio', () => {
    expect(parseGemini('', 'demo-app')).toEqual([])
  })
})
