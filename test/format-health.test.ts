import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { newerVersion, parseFile } from '../src/core/parse'
import { scan } from '../src/core/scan'
import { modelName } from '../src/core/models'
import { dayKey, live } from '../src/core/aggregate'
import { planReport } from '../src/core/plan'
import { preferLimitHit, type LimitHit } from '../src/core/types'

const usage = { input_tokens: 2, cache_creation_input_tokens: 10, cache_read_input_tokens: 100, output_tokens: 5 }

const line = (id: string | undefined, extra: Record<string, unknown> = {}, msg: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: 'assistant',
    timestamp: '2026-11-09T15:00:00.000Z',
    version: '2.1.300',
    message: { ...(id ? { id } : {}), model: 'claude-fable-5-2', usage, ...msg },
    ...extra,
  })

const quota = (type: string, status: string, resetsAt: number) =>
  JSON.stringify({ type: 'system', timestamp: '2026-11-09T15:00:00.000Z', quotaLimits: { rateLimitType: type, status, resetsAt } })

function project(lines: string[]): { root: string; file: string } {
  const root = join(mkdtempSync(join(tmpdir(), 'ch-fmt-')), 'projects')
  const dir = join(root, 'C--Proyectos-demo')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 's1.jsonl')
  writeFileSync(file, lines.join('\n') + '\n')
  return { root, file }
}

describe('salud de formato', () => {
  it('cuenta las lineas de uso del asistente que no se pueden contar', () => {
    const { file } = project([
      line('msg_a'),
      line(undefined), // sin message.id
      line('msg_b', {}, { model: undefined }), // sin modelo
      line('msg_c', { timestamp: 'no es fecha' }),
      '{"type":"assistant","message":{"usage":{"input_tokens":1}', // JSON roto en medio del archivo
      line('msg_d', {}, { model: '<synthetic>' }), // esperado: no cuenta como descarte
      JSON.stringify({ type: 'user', message: { content: 'hablemos de "usage"' } }),
    ])
    const { recs, meta } = parseFile(file)
    expect(recs.map((r) => r.id)).toEqual(['msg_a'])
    expect(meta.skipped).toBe(4)
  })

  it('guarda la version mas alta de Claude Code', () => {
    const { file } = project([line('msg_a', { version: '2.1.99' }), line('msg_b', { version: '2.1.321' }), line('msg_c', { version: '2.1.100' })])
    expect(parseFile(file).meta.cliVersion).toBe('2.1.321')
    expect(newerVersion('2.1.100', '2.1.99')).toBe(true)
    expect(newerVersion('2.1.99', '2.1.100')).toBe(false)
    expect(newerVersion('no-version', undefined)).toBe(false)
  })

  it('expone descartes y version en la fuente de Claude, tambien al leer de forma incremental', () => {
    const { root, file } = project([line('msg_a'), line(undefined)])
    const first = scan(root, false)
    expect(first.sources.claude.skipped).toBe(1)
    expect(first.sources.claude.cliVersion).toBe('2.1.300')
    const prior = parseFile(file)
    writeFileSync(file, [line('msg_a'), line(undefined), line(undefined, { version: '2.2.0' })].join('\n') + '\n')
    const next = parseFile(file, prior)
    expect(next.meta.skipped).toBe(2)
    expect(next.meta.cliVersion).toBe('2.2.0')
  })
})

describe('modo rapido y deduplicacion', () => {
  it('lee usage.speed y deduplica por message.id quedandose con el de mayor salida', () => {
    const fast = { ...usage, speed: 'fast', output_tokens: 9 }
    const { file } = project([
      line('msg_a', {}, { usage: { ...usage, speed: 'standard' } }),
      line('msg_b', {}, { usage: { ...fast, output_tokens: 3 } }),
      line('msg_b', {}, { usage: fast }),
    ])
    const { recs } = parseFile(file)
    expect(recs).toHaveLength(2)
    expect(recs.find((r) => r.id === 'msg_a')?.speed).toBeUndefined()
    expect(recs.find((r) => r.id === 'msg_b')).toMatchObject({ speed: 'fast', output: 9 })
  })

  it('el mismo message.id en dos archivos cuenta una vez', () => {
    const { root, file } = project([line('msg_a'), line('msg_b')])
    writeFileSync(join(dirname(file), 's2.jsonl'), [line('msg_a'), line('msg_c')].join('\n') + '\n')
    expect(scan(root, false).recs.map((r) => r.id).sort()).toEqual(['msg_a', 'msg_b', 'msg_c'])
  })

  it('asigna el registro al dia local, no al dia UTC', () => {
    // 23:30 hora local del 9 de noviembre: en UTC puede ser ya el dia 10
    const local = new Date(2026, 10, 9, 23, 30, 0)
    const { file } = project([line('msg_a', { timestamp: local.toISOString() })])
    const { recs } = parseFile(file)
    expect(dayKey(recs[0].ts)).toBe('2026-11-09')
    expect(live(recs, new Date(2026, 10, 9, 23, 45).getTime()).todayMessages).toBe(1)
    expect(live(recs, new Date(2026, 10, 10, 0, 5).getTime()).todayMessages).toBe(0)
  })
})

describe('limite alcanzado', () => {
  const now = Date.parse('2026-11-09T16:00:00.000Z')
  const inTwoHours = Math.floor(now / 1000) + 7200
  const inThreeDays = Math.floor(now / 1000) + 3 * 86_400

  it('un aviso semanal que no bloquea no tapa un bloqueo de 5 horas', () => {
    const { root } = project([quota('five_hour', 'rejected', inTwoHours), quota('seven_day', 'allowed_warning', inThreeDays)])
    const { limitHit } = scan(root, false)
    expect(limitHit).toMatchObject({ type: 'five_hour', status: 'rejected' })
    expect(planReport([], now, null, limitHit)?.blocked).toEqual({ type: 'five_hour', resetsAt: inTwoHours * 1000 })
  })

  it('entre dos rechazos gana el que reinicia mas tarde, tambien entre archivos', () => {
    const { root, file } = project([quota('seven_day', 'rejected', inThreeDays)])
    writeFileSync(join(dirname(file), 's2.jsonl'), quota('five_hour', 'rejected', inTwoHours) + '\n')
    expect(scan(root, false).limitHit).toMatchObject({ type: 'seven_day', status: 'rejected' })
  })

  it('preferLimitHit conserva el rechazado frente a otro estado', () => {
    const rejected: LimitHit = { ts: 1, resetsAt: 10, type: 'five_hour', status: 'rejected' }
    const warning: LimitHit = { ts: 2, resetsAt: 99, type: 'seven_day', status: 'allowed_warning' }
    expect(preferLimitHit(rejected, warning)).toBe(rejected)
    expect(preferLimitHit(warning, rejected)).toBe(rejected)
    expect(preferLimitHit(null, warning)).toBe(warning)
  })
})

describe('nombre visible del modelo', () => {
  it('no confunde la fecha del id con la version', () => {
    expect(modelName('claude-opus-4-20250514')).toBe('Opus 4')
    expect(modelName('claude-sonnet-4-20250514')).toBe('Sonnet 4')
    expect(modelName('claude-opus-4-1-20250805')).toBe('Opus 4.1')
    expect(modelName('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
    expect(modelName('claude-fable-5-2')).toBe('Fable 5.2')
    expect(modelName('claude-mythos-5-2')).toBe('Mythos 5.2')
    expect(modelName('claude-3-7-sonnet-20250219')).toBe('Sonnet 3.7')
  })
})
