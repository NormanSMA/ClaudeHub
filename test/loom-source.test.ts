import { afterAll, describe, expect, it } from 'vitest'
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dayKey } from '../src/core/aggregate'
import { scan } from '../src/core/scan'
import { parseLoomChunk, seenLoomIds } from '../src/core/sources/loom'

const dirs: string[] = []
function makeTempDir(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix))
  dirs.push(d)
  return d
}

afterAll(() => {
  delete process.env.LOOM_RUNS_FILE
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
})

describe('parseLoomChunk', () => {
  it('parsea registros validos, deduplica y descarta cero tokens o lineas gigantes', () => {
    const seen = new Set<string>()
    const oversized = JSON.stringify({
      id: 'big',
      ts: 1785803236000,
      model: 'claude-sonnet-5-5',
      input: 100,
      output: 50,
      pad: 'x'.repeat(17_000),
    })
    const chunk = [
      JSON.stringify({
        id: 'run-1',
        ts: 1785803236000,
        session: 'msn-1',
        project: 'Loom',
        role: 'orchestrator',
        model: 'claude-sonnet-5-5',
        input: 500,
        output: 120,
        cacheRead: 300,
        cacheWrite: 40,
      }),
      JSON.stringify({
        id: 'loom:run-2',
        ts: '2026-11-26T04:00:00.000Z',
        session: 'msn-1',
        project: 'Loom',
        role: 'subagent',
        provider: 'codex',
        model: 'gpt-6.1-sol',
        input: 200,
        output: 80,
        cache_read: 50,
        cache_write: 0,
      }),
      // duplicado
      JSON.stringify({
        id: 'run-1',
        ts: 1785803236000,
        model: 'claude-sonnet-5-5',
        input: 999,
        output: 1,
      }),
      // stub con cero tokens
      JSON.stringify({
        id: 'stub-0',
        ts: 1785803236000,
        model: 'claude',
        input: 0,
        output: 0,
      }),
      oversized,
      '{corrupto',
    ].join('\n')

    const recs = parseLoomChunk(chunk, seen)
    expect(recs).toHaveLength(2)
    expect(recs[0]).toMatchObject({
      id: 'loom:run-1',
      role: 'orchestrator',
      project: 'Loom',
      cacheRead: 300,
      cacheWrite: 40,
      source: 'loom',
    })
    expect(recs[1]).toMatchObject({
      id: 'loom:run-2',
      role: 'subagent',
      agent: 'codex',
      agentFile: 'msn-1',
      cacheRead: 50,
      source: 'loom',
    })
    expect(seenLoomIds(recs).has('loom:run-1')).toBe(true)
  })

  it('escanea incrementalmente loom-runs.jsonl cuando crece y respeta dayKey local', () => {
    const dir = makeTempDir('loom-scan-')
    const claudeDir = join(dir, 'projects')
    const loomFile = join(dir, 'loom-runs.jsonl')
    process.env.LOOM_RUNS_FILE = loomFile

    const ts1 = new Date(2026, 10, 25, 23, 55, 0).getTime()
    expect(dayKey(ts1)).toBe('2026-11-25')

    writeFileSync(
      loomFile,
      JSON.stringify({
        id: 'r1',
        ts: ts1,
        session: 's1',
        project: 'Loom',
        role: 'orchestrator',
        model: 'claude-sonnet-5-5',
        input: 100,
        output: 50,
      }) + '\n',
    )

    const first = scan(claudeDir, false, { extra: true })
    expect(first.sources.loom).toMatchObject({ enabled: true, ok: true, records: 1 })

    appendFileSync(
      loomFile,
      JSON.stringify({
        id: 'r2',
        ts: ts1 + 60_000,
        session: 's1',
        project: 'Loom',
        role: 'subagent',
        agent: 'reviewer',
        model: 'gpt-6.1-sol',
        input: 80,
        output: 20,
      }) + '\n',
    )

    const second = scan(claudeDir, false, { extra: true })
    expect(second.sources.loom).toMatchObject({ enabled: true, ok: true, records: 2 })
    expect(second.recs.filter((r) => r.source === 'loom' && r.role === 'subagent')).toHaveLength(1)
  })
})
