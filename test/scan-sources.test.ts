import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sourceOf, total } from '../src/core/types'

const fixtures = join(__dirname, 'fixtures')
const ENV = ['CLAUDE_PROJECTS_DIR', 'CODEX_SESSIONS_DIR', 'GEMINI_TMP_DIR', 'CLAUDEHUB_DATA', 'CLAUDEHUB_CONFIG', 'CLAUDEHUB_CACHE']

const claudeLine = (id: string, out: number) =>
  JSON.stringify({
    type: 'assistant',
    isSidechain: false,
    timestamp: '2026-09-01T15:00:00.000Z',
    sessionId: 's1',
    message: { id, model: 'claude-opus-5', usage: { input_tokens: 2, cache_creation_input_tokens: 10, cache_read_input_tokens: 100, output_tokens: out } },
  })

/** Arma carpetas temporales con las tres fuentes y carga scan con las variables de entorno apuntando a ellas. */
async function setup(config?: object) {
  const base = mkdtempSync(join(tmpdir(), 'ch-src-'))
  const claude = join(base, 'claude')
  const codex = join(base, 'codex', '2026', '03', '01')
  const gemini = join(base, 'gemini')
  mkdirSync(join(claude, 'C--Proyectos-demo'), { recursive: true })
  mkdirSync(codex, { recursive: true })
  mkdirSync(join(gemini, 'mi-proyecto', 'chats'), { recursive: true })
  writeFileSync(join(claude, 'C--Proyectos-demo', 's1.jsonl'), [claudeLine('msg_a', 5), claudeLine('msg_b', 7)].join('\n') + '\n')
  copyFileSync(join(fixtures, 'codex-rollout.jsonl'), join(codex, 'rollout-2026-03-01T10-00-00-sess-demo-0001.jsonl'))
  writeFileSync(join(codex, 'otro-archivo.jsonl'), 'no es un rollout\n')
  copyFileSync(join(fixtures, 'gemini-session.jsonl'), join(gemini, 'mi-proyecto', 'chats', 'session-2026-03-02T09-00-gsess.jsonl'))
  writeFileSync(join(base, 'config.json'), JSON.stringify(config ?? {}))
  process.env.CLAUDE_PROJECTS_DIR = claude
  process.env.CODEX_SESSIONS_DIR = join(base, 'codex')
  process.env.GEMINI_TMP_DIR = gemini
  process.env.CLAUDEHUB_DATA = join(base, 'data')
  process.env.CLAUDEHUB_CONFIG = join(base, 'config.json')
  process.env.CLAUDEHUB_CACHE = join(base, 'data', 'cache.json')
  vi.resetModules()
  const { scan } = await import('../src/core/scan')
  return { base, codex, gemini, scan }
}

afterEach(() => {
  for (const k of ENV) delete process.env[k]
})

describe('scan con varias fuentes', () => {
  it('suma Claude, Codex y Gemini', async () => {
    const { scan } = await setup()
    const { recs, sources } = scan()
    const by = (s: string) => recs.filter((r) => sourceOf(r) === s)
    expect(by('claude')).toHaveLength(2)
    expect(by('codex')).toHaveLength(3)
    expect(by('gemini')).toHaveLength(3)
    expect(by('codex').reduce((a, r) => a + total(r), 0)).toBe(4800)
    expect(by('gemini').every((r) => r.project === 'mi-proyecto')).toBe(true)
    expect(sources.claude).toEqual({ enabled: true, files: 1, records: 2, ok: true })
    expect(sources.codex).toEqual({ enabled: true, files: 1, records: 3, ok: true })
    expect(sources.gemini).toEqual({ enabled: true, files: 1, records: 3, ok: true })
    expect(sources.omniroute).toEqual({ enabled: false, files: 0, records: 0, ok: false, reason: 'sin configurar' })
  })

  it('no lee una fuente desactivada en la configuracion', async () => {
    const { scan } = await setup({ sources: { codex: false } })
    const { recs, sources } = scan()
    expect(recs.some((r) => sourceOf(r) === 'codex')).toBe(false)
    expect(recs.filter((r) => sourceOf(r) === 'gemini')).toHaveLength(3)
    expect(sources.codex.enabled).toBe(false)
    expect(sources.codex.ok).toBe(false)
    expect(sources.codex.files).toBe(0)
    expect(sources.gemini.enabled).toBe(true)
  })

  it('un archivo corrupto no rompe las demas fuentes', async () => {
    const { scan, codex, gemini } = await setup()
    writeFileSync(join(codex, 'rollout-2026-03-01T11-00-00-roto.jsonl'), '{"type":"token_count" roto\n\u0000\u0001 basura\n')
    writeFileSync(join(gemini, 'mi-proyecto', 'chats', 'session-roto.jsonl'), '{"sessionId": \n"type":"gemini" sin cerrar\n')
    const { recs, sources } = scan()
    expect(recs.filter((r) => sourceOf(r) === 'claude')).toHaveLength(2)
    expect(recs.filter((r) => sourceOf(r) === 'codex')).toHaveLength(3)
    expect(recs.filter((r) => sourceOf(r) === 'gemini')).toHaveLength(3)
    expect(sources.codex).toMatchObject({ files: 2, records: 3, ok: true })
    expect(sources.gemini).toMatchObject({ files: 2, records: 3, ok: true })
  })

  it('un archivo ilegible se cuenta como error y no rompe el resto', async () => {
    const { scan, gemini } = await setup()
    // una carpeta con nombre de sesion: statSync funciona, readFileSync falla
    mkdirSync(join(gemini, 'mi-proyecto', 'chats', 'session-dir.jsonl'))
    const { recs, sources } = scan()
    expect(recs.filter((r) => sourceOf(r) === 'claude')).toHaveLength(2)
    expect(recs.filter((r) => sourceOf(r) === 'codex')).toHaveLength(3)
    expect(sources.gemini.ok).toBe(true)
  })

  it('reutiliza la cache en la segunda llamada y detecta cambios', async () => {
    const { scan, codex } = await setup()
    const first = scan()
    expect(scan()).toBe(first)
    const second = scan(undefined, false)
    expect(second.recs).toHaveLength(first.recs.length)
    // un rollout nuevo invalida la memoria y se reflejan sus registros
    copyFileSync(join(fixtures, 'codex-rollout.jsonl'), join(codex, 'rollout-2026-03-01T12-00-00-copia.jsonl'))
    const third = scan()
    expect(third).not.toBe(first)
    // la copia repite los mismos ids: el dedupe global los descarta
    expect(third.recs).toHaveLength(first.recs.length)
    expect(third.sources.codex.files).toBe(2)
    expect(third.sources.codex.records).toBe(6)
  })

  it('con otra carpeta de Claude no lee Codex ni Gemini', async () => {
    const { scan, base } = await setup()
    const other = join(base, 'otra')
    mkdirSync(join(other, 'p'), { recursive: true })
    writeFileSync(join(other, 'p', 's.jsonl'), claudeLine('msg_x', 1) + '\n')
    const { recs, sources } = scan(other, false)
    expect(recs).toHaveLength(1)
    expect(sources.codex.enabled).toBe(false)
    expect(sources.gemini.enabled).toBe(false)
  })

  it('marca carpeta no encontrada', async () => {
    const { scan } = await setup()
    process.env.CODEX_SESSIONS_DIR = join(tmpdir(), 'ch-no-existe-codex')
    const { sources } = scan(undefined, false)
    expect(sources.codex).toMatchObject({ enabled: true, files: 0, ok: false, reason: 'carpeta no encontrada' })
  })
})
