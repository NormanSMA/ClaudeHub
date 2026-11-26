import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { clearOpencodeCache, readOpencode } from '../src/core/sources/opencode'
import { total } from '../src/core/types'

let dir: string
let dbPath: string

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'opencode-test-'))
  dbPath = join(dir, 'opencode.db')
  const db = new DatabaseSync(dbPath)
  db.exec(`
    CREATE TABLE session (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      parent_id TEXT,
      directory TEXT NOT NULL,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL
    );
    CREATE TABLE message (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      time_created INTEGER NOT NULL,
      time_updated INTEGER NOT NULL,
      data TEXT NOT NULL
    );
    CREATE TABLE part (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      data TEXT NOT NULL
    );
  `)
  const insSess = db.prepare('INSERT INTO session VALUES (?,?,?,?,?,?)')
  insSess.run('ses-main', 'global', null, 'C:/Proyectos/Loom/', 1000, 2000)
  insSess.run('ses-sub', 'global', 'ses-main', 'C:/Proyectos/Loom', 1500, 2000)

  const insMsg = db.prepare('INSERT INTO message VALUES (?,?,?,?,?)')
  insMsg.run(
    'msg-user',
    'ses-main',
    1785803200000,
    1785803200000,
    JSON.stringify({ role: 'user', agent: 'build' }),
  )
  insMsg.run(
    'msg-1',
    'ses-main',
    1785803236142,
    1785803236142,
    JSON.stringify({
      role: 'assistant',
      modelID: 'deepseek-v4-pro',
      providerID: 'deepseek',
      mode: 'build',
      agent: 'build',
      tokens: { input: 1000, output: 60, reasoning: 20, cache: { read: 500, write: 10 } },
    }),
  )
  insMsg.run(
    'msg-sub',
    'ses-sub',
    1785803240000,
    1785803240000,
    JSON.stringify({
      role: 'assistant',
      modelID: 'gemini-3.8-flash',
      providerID: 'google',
      agent: 'explore',
      tokens: { input: 200, output: 40, reasoning: 0, cache: { read: 100, write: 0 } },
    }),
  )
  insMsg.run(
    'msg-zero',
    'ses-main',
    1785803250000,
    1785803250000,
    JSON.stringify({
      role: 'assistant',
      modelID: 'deepseek-v4-pro',
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    }),
  )
  db.prepare('INSERT INTO part VALUES (?,?,?,?)').run('prt-1', 'msg-1', 'ses-main', 'secreto del usuario')
  db.close()
})

afterAll(async () => {
  clearOpencodeCache()
  await rm(dir, { recursive: true, force: true })
})

describe('readOpencode', () => {
  it('mapea metricas de tokens y diferencia orquestador vs subagente por parent_id', async () => {
    clearOpencodeCache()
    const res = await readOpencode({ dbPath })
    expect(res.status.ok).toBe(true)
    expect(res.recs).toHaveLength(2)

    const main = res.recs.find((r) => r.id === 'opencode:msg-1')!
    expect(main).toMatchObject({
      model: 'deepseek-v4-pro',
      input: 1000,
      output: 80,
      reasoning: 20,
      cacheRead: 500,
      cacheWrite: 10,
      session: 'ses-main',
      project: 'Loom',
      role: 'orchestrator',
      source: 'opencode',
    })
    expect(total(main)).toBe(1590)

    const sub = res.recs.find((r) => r.id === 'opencode:msg-sub')!
    expect(sub).toMatchObject({
      session: 'ses-main',
      project: 'Loom',
      role: 'subagent',
      agent: 'explore',
      agentFile: 'ses-sub',
      source: 'opencode',
    })
  })

  it('informa error limpio sin lanzar cuando falta opencode.db', async () => {
    const res = await readOpencode({ dbPath: join(dir, 'inexistente.db') })
    expect(res.recs).toEqual([])
    expect(res.status).toEqual({ ok: false, reason: 'base no encontrada' })
  })
})
