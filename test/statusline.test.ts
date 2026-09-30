import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = mkdtempSync(join(tmpdir(), 'ch-sl-'))
const file = join(dir, 'context-windows.json')
process.env.CLAUDEHUB_WINDOWS = file

const { recordedWindows } = await import('../src/core/windows')
const { contextLimit, activeReport } = await import('../src/core/aggregate')

const script = resolve(import.meta.dirname, '../scripts/statusline.cjs')

function run(payload: unknown) {
  return spawnSync(process.execPath, [script], {
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
    env: { ...process.env, CLAUDEHUB_WINDOWS: file },
    encoding: 'utf8',
  })
}

const sample = {
  session_id: 'sess-1',
  model: { id: 'claude-opus-5-5', display_name: 'Opus' },
  context_window: {
    context_window_size: 1_000_000,
    used_percentage: 43,
    current_usage: { input_tokens: 8, cache_creation_input_tokens: 1000, cache_read_input_tokens: 429_000, output_tokens: 500 },
  },
}

describe('linea de estado', () => {
  it('imprime una linea corta y guarda el tamano real de la ventana', () => {
    const r = run(sample)
    expect(r.status).toBe(0)
    // eslint-disable-next-line no-control-regex
    expect(r.stdout.replace(/\u001b\[[0-9;]*m/g, '')).toContain('[Opus] ctx 43% (430k/1.0M)')
    const saved = JSON.parse(readFileSync(file, 'utf8'))
    expect(saved['sess-1'].size).toBe(1_000_000)
    expect(saved['sess-1'].model).toBe('claude-opus-5-5')
  })

  it('no falla con entradas invalidas ni sin ventana', () => {
    expect(run('esto no es json').status).toBe(0)
    expect(run({ session_id: 'x', model: { display_name: 'Sonnet' } }).stdout).toContain('[Sonnet]')
  })

  it('ClaudeHub usa el tamano real y deja de estimar', () => {
    expect(recordedWindows()['sess-1'].size).toBe(1_000_000)
    expect(contextLimit(150_000, 'Opus 5.5', 1_000_000)).toEqual({ limit: 1_000_000, estimated: false, source: 'statusline' })
    expect(contextLimit(150_000, 'Opus 5.5')).toMatchObject({ limit: 200_000, estimated: true, source: 'estimate' })
  })

  it('el tamano real tiene prioridad en el informe de chats activos', () => {
    const now = Date.now()
    const rec = {
      id: 'm1', ts: now - 1000, model: 'claude-opus-5-5', input: 5, cacheWrite: 100, cacheRead: 99_895, output: 50,
      session: 'sess-1', project: 'p', role: 'orchestrator' as const,
    }
    const [chat] = activeReport([rec], new Map(), now, 600_000, recordedWindows())
    expect(chat.context.limit).toBe(1_000_000)
    expect(chat.context.estimated).toBe(false)
    expect(chat.context.pct).toBeCloseTo(0.1, 2)
  })
})
