import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { readOmniroute } from '../src/core/sources/omniroute'

// Bases sinteticas: ningun dato real de OmniRoute entra al repositorio.
let dir: string
let full: string
let old: string
let seq = 0
const newWork = () => join(dir, `work${seq++}`)
const read = (dbPath: string) => readOmniroute({ container: 'omniroute', dbPath, workDir: newWork() })

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'omniroute-calls-'))

  full = join(dir, 'completa.sqlite')
  const db = new DatabaseSync(full)
  db.exec(`CREATE TABLE usage_history (
    id INTEGER PRIMARY KEY, provider TEXT, model TEXT, api_key_name TEXT,
    tokens_input INTEGER, tokens_output INTEGER, tokens_cache_read INTEGER, tokens_cache_creation INTEGER,
    tokens_reasoning INTEGER, status TEXT, success INTEGER, latency_ms INTEGER, error_code TEXT, timestamp TEXT)`)
  const u = db.prepare('INSERT INTO usage_history VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  u.run(1, 'prov-a', 'm1', 'clave-uno', 100, 20, 0, 0, 5, '200', 1, 800, null, '2026-05-01T10:00:00.000Z')
  u.run(2, 'prov-a', 'm1', null, 0, 0, 0, 0, 0, '429', 0, 150, 'upstream_429', '2026-05-01T10:01:00.000Z')
  u.run(3, 'prov-b', 'm2', null, 10, 5, 0, 0, null, 'raro', null, null, null, '2026-05-01T10:02:00.000Z')
  u.run(4, 'prov-b', 'm2', null, 1, 1, 0, 0, 0, '503', 0, 90, null, 'no-es-fecha')
  db.close()

  // version vieja de OmniRoute: usage_history sin status, success ni latencia
  old = join(dir, 'vieja.sqlite')
  const o = new DatabaseSync(old)
  o.exec(`CREATE TABLE usage_history (
    id INTEGER PRIMARY KEY, provider TEXT, model TEXT, tokens_input INTEGER, tokens_output INTEGER,
    tokens_cache_read INTEGER, tokens_cache_creation INTEGER, tokens_reasoning INTEGER, timestamp TEXT)`)
  const ins = o.prepare('INSERT INTO usage_history VALUES (?,?,?,?,?,?,?,?,?)')
  ins.run(1, 'prov-a', 'm1', 100, 50, 0, 0, 0, '2026-05-01T10:00:00.000Z')
  ins.run(2, 'prov-a', 'm1', 0, 0, 0, 0, 0, '2026-05-01T11:00:00.000Z')
  o.close()
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('readOmniroute: llamadas', () => {
  it('lee las llamadas de usage_history, incluidas las fallidas', async () => {
    const { calls, status } = await read(full)
    expect(status.ok).toBe(true)
    // la fila con fecha invalida se descarta
    expect(calls).toHaveLength(3)
    const at = (ts: string) => calls.find((c) => c.ts === Date.parse(ts))!
    expect(at('2026-05-01T10:00:00.000Z')).toEqual({
      ts: Date.parse('2026-05-01T10:00:00.000Z'),
      provider: 'prov-a',
      model: 'm1',
      status: 200,
      ok: true,
      latencyMs: 800,
      tokens: 125,
    })
    expect(at('2026-05-01T10:01:00.000Z')).toMatchObject({ status: 429, ok: false, tokens: 0 })
  })

  it('con status ilegible y success nulo la llamada cuenta como fallo sin codigo', async () => {
    const { calls } = await read(full)
    expect(calls.find((c) => c.ts === Date.parse('2026-05-01T10:02:00.000Z'))).toMatchObject({
      status: 0,
      ok: false,
      latencyMs: null,
      tokens: 15,
    })
  })

  it('no lee la etiqueta de la clave de API ni otros campos fuera de la lista', async () => {
    const { calls } = await read(full)
    expect(JSON.stringify(calls)).not.toContain('clave-uno')
  })

  it('una base vieja sin las columnas nuevas sigue funcionando', async () => {
    const { calls, recs, status } = await read(old)
    expect(status.ok).toBe(true)
    expect(recs).toHaveLength(1)
    // cada fila sigue siendo una llamada, con codigo 0 y fallo porque no hay status
    expect(calls).toHaveLength(2)
    expect(calls.every((c) => c.status === 0 && !c.ok && c.latencyMs === null)).toBe(true)
  })
})
