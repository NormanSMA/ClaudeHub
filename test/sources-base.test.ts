import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { modelName } from '../src/core/models'
import { sanitize, DEFAULTS } from '../src/core/config'
import { codexSessionsDir, geminiTmpDir } from '../src/core/paths'
import { sourceOf, type Rec } from '../src/core/types'

const rec = (extra: Partial<Rec> = {}): Rec => ({
  id: 'a',
  ts: 1,
  model: 'm',
  input: 0,
  cacheWrite: 0,
  cacheRead: 0,
  output: 0,
  session: 's',
  project: 'p',
  role: 'orchestrator',
  ...extra,
})

describe('sourceOf', () => {
  it('sin source es claude', () => {
    expect(sourceOf(rec())).toBe('claude')
    expect(sourceOf(rec({ source: 'codex' }))).toBe('codex')
  })
})

describe('modelName gpt y gemini', () => {
  it('reconoce gpt', () => {
    expect(modelName('gpt-6.1-sol')).toBe('GPT 6.1 Sol')
    expect(modelName('gpt-6-luna')).toBe('GPT 6 Luna')
  })
  it('reconoce gemini', () => {
    expect(modelName('gemini-3-flash-preview')).toBe('Gemini 3 Flash')
    expect(modelName('gemini-3.8-flash')).toBe('Gemini 3.8 Flash')
  })
  it('no rompe claude ni ids desconocidos', () => {
    expect(modelName('claude-opus-5-5')).toBe('Opus 5.5')
    expect(modelName('algo-raro')).toBe('algo-raro')
  })
})

describe('rutas de fuentes', () => {
  it('usan la variable de entorno o la carpeta del usuario', () => {
    const prev = { c: process.env.CODEX_SESSIONS_DIR, g: process.env.GEMINI_TMP_DIR }
    delete process.env.CODEX_SESSIONS_DIR
    delete process.env.GEMINI_TMP_DIR
    expect(codexSessionsDir()).toBe(join(homedir(), '.codex', 'sessions'))
    expect(geminiTmpDir()).toBe(join(homedir(), '.gemini', 'tmp'))
    process.env.CODEX_SESSIONS_DIR = 'X:\\codex'
    process.env.GEMINI_TMP_DIR = 'X:\\gemini'
    expect(codexSessionsDir()).toBe('X:\\codex')
    expect(geminiTmpDir()).toBe('X:\\gemini')
    if (prev.c === undefined) delete process.env.CODEX_SESSIONS_DIR
    else process.env.CODEX_SESSIONS_DIR = prev.c
    if (prev.g === undefined) delete process.env.GEMINI_TMP_DIR
    else process.env.GEMINI_TMP_DIR = prev.g
  })
})

describe('config de fuentes', () => {
  it('trae valores por defecto', () => {
    const c = sanitize({})
    expect(c.sources).toEqual({ codex: true, gemini: true, omniroute: false })
    expect(c.omniroute).toEqual({ container: 'omniroute', dbPath: '' })
    expect(c).toEqual(DEFAULTS)
  })
  it('acepta valores validos', () => {
    const c = sanitize({ sources: { codex: false, omniroute: true }, omniroute: { container: 'mi.omni-1', dbPath: ' C:\\db\\storage.sqlite ' } })
    expect(c.sources).toEqual({ codex: false, gemini: true, omniroute: true })
    expect(c.omniroute).toEqual({ container: 'mi.omni-1', dbPath: 'C:\\db\\storage.sqlite' })
  })
  it('rechaza container invalido y acota dbPath', () => {
    expect(sanitize({ omniroute: { container: 'a b; rm' } }).omniroute.container).toBe('omniroute')
    expect(sanitize({ omniroute: { container: 'x'.repeat(65) } }).omniroute.container).toBe('omniroute')
    expect(sanitize({ omniroute: { dbPath: 'a'.repeat(400) } }).omniroute.dbPath).toHaveLength(260)
    expect(sanitize({ sources: { codex: 'si' } }).sources.codex).toBe(true)
  })
})
