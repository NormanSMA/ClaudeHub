import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { readOmniroute } from '../src/core/sources/omniroute'
import { total } from '../src/core/types'

let dir: string
let dbFile: string
let seq = 0

const newWork = () => join(dir, `work${seq++}`)

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'omniroute-test-'))
  dbFile = join(dir, 'storage.sqlite')
  const db = new DatabaseSync(dbFile)
  db.exec(`CREATE TABLE usage_history (
    id INTEGER PRIMARY KEY, provider TEXT, model TEXT,
    tokens_input INTEGER, tokens_output INTEGER, tokens_cache_read INTEGER,
    tokens_cache_creation INTEGER, tokens_reasoning INTEGER, success INTEGER, timestamp TEXT)`)
  const ins = db.prepare('INSERT INTO usage_history VALUES (?,?,?,?,?,?,?,?,?,?)')
  ins.run(1, 'openai', 'gpt-x', 100, 50, 30, 20, 10, 1, '2026-05-01T10:00:00.000Z')
  ins.run(2, 'groq', 'llama', 0, 0, 0, 0, 0, 1, '2026-05-01T11:00:00.000Z')
  ins.run(3, 'groq', 'llama', 200, 40, null, null, null, 1, '2026-05-01T12:00:00.000Z')
  db.close()
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

/** copy falso: copia la base sintetica; -wal y -shm no existen */
const fakeCopy = (calls: string[], source = () => dbFile) => async (src: string, dest: string) => {
  calls.push(src)
  if (!src.endsWith('storage.sqlite')) throw new Error('no existe')
  await copyFile(source(), dest)
}

describe('readOmniroute con dbPath', () => {
  it('mapea las columnas de uso a registros', async () => {
    const { recs, status } = await readOmniroute({ container: 'omniroute', dbPath: dbFile, workDir: newWork() })
    expect(status.ok).toBe(true)
    const r = recs.find((x) => x.id === 'omniroute:1')!
    expect(r).toMatchObject({
      input: 100,
      cacheRead: 30,
      cacheWrite: 20,
      output: 60,
      model: 'openai/gpt-x',
      project: 'openai',
      session: 'omniroute:openai',
      role: 'orchestrator',
      source: 'omniroute',
      ts: Date.parse('2026-05-01T10:00:00.000Z'),
    })
    expect(total(r)).toBe(210)
  })

  it('ignora filas con total 0', async () => {
    const { recs } = await readOmniroute({ container: 'omniroute', dbPath: dbFile, workDir: newWork() })
    expect(recs.map((r) => r.id)).toEqual(['omniroute:1', 'omniroute:3'])
  })

  it('trata null en cache y razonamiento como 0', async () => {
    const { recs } = await readOmniroute({ container: 'omniroute', dbPath: dbFile, workDir: newWork() })
    const r = recs.find((x) => x.id === 'omniroute:3')!
    expect(r).toMatchObject({ input: 200, cacheRead: 0, cacheWrite: 0, output: 40 })
  })

  it('devuelve error sin lanzar si la base no existe', async () => {
    const { recs, status } = await readOmniroute({
      container: 'omniroute',
      dbPath: join(dir, 'no-existe.sqlite'),
      workDir: newWork(),
    })
    expect(recs).toEqual([])
    expect(status.ok).toBe(false)
  })

  it('informa si node:sqlite no esta disponible', async () => {
    const { recs, status } = await readOmniroute({
      container: 'omniroute',
      dbPath: dbFile,
      workDir: newWork(),
      loadSqlite: async () => {
        throw new Error('sin modulo')
      },
    })
    expect(recs).toEqual([])
    expect(status).toEqual({ ok: false, reason: 'node:sqlite no disponible' })
  })
})

describe('readOmniroute con copia del contenedor', () => {
  it('copia la base y la lee', async () => {
    const calls: string[] = []
    const { recs, status } = await readOmniroute({
      container: 'omniroute',
      dbPath: '',
      workDir: newWork(),
      now: () => 1000,
      copy: fakeCopy(calls),
    })
    expect(status).toEqual({ ok: true, copiedAt: 1000 })
    expect(recs).toHaveLength(2)
    expect(calls).toEqual([
      'omniroute:/app/data/storage.sqlite',
      'omniroute:/app/data/storage.sqlite-wal',
      'omniroute:/app/data/storage.sqlite-shm',
    ])
  })

  it('respeta el TTL y vuelve a copiar al vencer', async () => {
    const calls: string[] = []
    let t = 0
    const o = { container: 'omniroute', dbPath: '', workDir: newWork(), now: () => t, copy: fakeCopy(calls), ttlMs: 60_000 }
    await readOmniroute(o)
    expect(calls).toHaveLength(3)
    t = 59_000
    const again = await readOmniroute(o)
    expect(calls).toHaveLength(3)
    expect(again.recs).toHaveLength(2)
    t = 61_000
    await readOmniroute(o)
    expect(calls).toHaveLength(6)
  })

  it('reintenta la copia hasta 2 veces si quick_check falla', async () => {
    const bad = join(dir, 'corrupta.sqlite')
    await writeFile(bad, Buffer.alloc(8192, 7))
    const calls: string[] = []
    const { recs, status } = await readOmniroute({
      container: 'omniroute',
      dbPath: '',
      workDir: newWork(),
      copy: fakeCopy(calls, () => bad),
    })
    expect(recs).toEqual([])
    expect(status.ok).toBe(false)
    expect(calls.filter((c) => c.endsWith('storage.sqlite'))).toHaveLength(3)
  })

  it('se recupera si el segundo intento copia una base sana', async () => {
    const bad = join(dir, 'corrupta2.sqlite')
    await writeFile(bad, Buffer.alloc(8192, 7))
    const calls: string[] = []
    let n = 0
    const { recs, status } = await readOmniroute({
      container: 'omniroute',
      dbPath: '',
      workDir: newWork(),
      copy: fakeCopy(calls, () => (n++ === 0 ? bad : dbFile)),
    })
    expect(status.ok).toBe(true)
    expect(recs).toHaveLength(2)
  })

  it('rechaza un contenedor invalido sin ejecutar nada', async () => {
    const calls: string[] = []
    const { recs, status } = await readOmniroute({
      container: 'omni; rm -rf /',
      dbPath: '',
      workDir: newWork(),
      copy: fakeCopy(calls),
    })
    expect(recs).toEqual([])
    expect(status.ok).toBe(false)
    expect(calls).toEqual([])
  })

  it('sin copia previa y con error de copia devuelve vacio sin lanzar', async () => {
    const { recs, status } = await readOmniroute({
      container: 'omniroute',
      dbPath: '',
      workDir: newWork(),
      copy: async () => {
        throw Object.assign(new Error('spawn docker ENOENT'), { code: 'ENOENT' })
      },
    })
    expect(recs).toEqual([])
    expect(status).toEqual({ ok: false, reason: 'Docker no disponible' })
  })

  it('con copia previa y error de copia usa la copia con stale', async () => {
    let t = 0
    let fail = false
    const o = {
      container: 'omniroute',
      dbPath: '',
      workDir: newWork(),
      now: () => t,
      ttlMs: 1000,
      copy: async (src: string, dest: string) => {
        if (fail) throw new Error('contenedor caido')
        if (!src.endsWith('storage.sqlite')) throw new Error('no existe')
        await copyFile(dbFile, dest)
      },
    }
    await readOmniroute(o)
    t = 5000
    fail = true
    const { recs, status } = await readOmniroute(o)
    expect(recs).toHaveLength(2)
    expect(status.ok).toBe(false)
    expect(status.stale).toBe(true)
    expect(status.copiedAt).toBe(0)
  })
})
