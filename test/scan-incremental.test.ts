import { appendFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, truncateSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ScanResult } from '../src/core/scan'

const ENV = ['CLAUDE_PROJECTS_DIR', 'CODEX_SESSIONS_DIR', 'GEMINI_TMP_DIR', 'CLAUDEHUB_DATA', 'CLAUDEHUB_CONFIG', 'CLAUDEHUB_CACHE']
const LINES = 50_000
const APPEND = 10
const T0 = Date.UTC(2026, 8, 1)
const iso = (k: number) => new Date(T0 + k * 1000).toISOString()

const claudeLine = (id: string, out: number, k: number) =>
  JSON.stringify({
    type: 'assistant',
    isSidechain: false,
    timestamp: iso(k),
    sessionId: 's1',
    message: { id, model: 'claude-opus-5', usage: { input_tokens: 2, cache_creation_input_tokens: 10, cache_read_input_tokens: 100, output_tokens: out } },
  })

const codexLine = (k: number) =>
  JSON.stringify({
    timestamp: iso(k),
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: { total_token_usage: { input_tokens: k * 80, cached_input_tokens: k * 50, output_tokens: k * 20, reasoning_output_tokens: k * 5, total_tokens: k * 100 } },
    },
  })

const geminiLine = (k: number) =>
  JSON.stringify({
    id: `g-${k}`,
    timestamp: iso(k),
    type: 'gemini',
    tokens: { input: 100 + k, output: 10, cached: 50, thoughts: 1, tool: 0, total: 111 + k },
    model: 'gemini-test-flash',
  })

const claudeBlock = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => claudeLine(`msg_${from + i}`, 5 + ((from + i) % 7), from + i)).join('\n') + '\n'
const codexBlock = (from: number, count: number) => Array.from({ length: count }, (_, i) => codexLine(from + i)).join('\n') + '\n'
const geminiBlock = (from: number, count: number) => Array.from({ length: count }, (_, i) => geminiLine(from + i)).join('\n') + '\n'

/** Arma las tres fuentes con 50 000 lineas cada una y carga scan con las variables de entorno apuntando a ellas. */
async function setup() {
  const base = mkdtempSync(join(tmpdir(), 'ch-inc-'))
  const claude = join(base, 'claude', 'C--Proyectos-demo')
  const codexDir = join(base, 'codex', '2026', '03', '01')
  const geminiDir = join(base, 'gemini', 'mi-proyecto', 'chats')
  for (const d of [claude, codexDir, geminiDir]) mkdirSync(d, { recursive: true })
  const files = {
    claude: join(claude, 's1.jsonl'),
    claudeDup: join(claude, 's2.jsonl'),
    codex: join(codexDir, 'rollout-2026-03-01T10-00-00-sess-inc.jsonl'),
    gemini: join(geminiDir, 'session-2026-03-02T09-00-inc.jsonl'),
  }
  writeFileSync(files.claude, claudeBlock(0, LINES))
  // mismos ids que s1 con distinta salida: unos ganan y otros pierden en el dedupe global
  writeFileSync(files.claudeDup, [claudeLine('msg_0', 9999, 0), claudeLine('msg_1', 1, 1), claudeLine('msg_dup_solo', 3, 2)].join('\n') + '\n')
  const meta = { timestamp: iso(0), type: 'session_meta', payload: { id: 'sess-inc', cwd: 'C:\\Proyectos\\demo-app' } }
  const turn = { timestamp: iso(1), type: 'turn_context', payload: { model: 'gpt-test-1' } }
  writeFileSync(files.codex, JSON.stringify(meta) + '\n' + JSON.stringify(turn) + '\n' + codexBlock(1, LINES))
  writeFileSync(files.gemini, JSON.stringify({ sessionId: 'gsess-inc' }) + '\n' + geminiBlock(1, LINES))
  writeFileSync(join(base, 'config.json'), '{}')
  process.env.CLAUDE_PROJECTS_DIR = join(base, 'claude')
  process.env.CODEX_SESSIONS_DIR = join(base, 'codex')
  process.env.GEMINI_TMP_DIR = join(base, 'gemini')
  process.env.CLAUDEHUB_DATA = join(base, 'data')
  process.env.CLAUDEHUB_CONFIG = join(base, 'config.json')
  process.env.CLAUDEHUB_CACHE = join(base, 'data', 'cache.json')
  vi.resetModules()
  const { scan } = await import('../src/core/scan')
  return { base, files, scan }
}

/** Escanea con la cache en memoria y devuelve el resultado junto con los bytes leidos por archivo. */
function counted(scan: Awaited<ReturnType<typeof setup>>['scan'], changed?: string[]) {
  const bytes = new Map<string, number>()
  const result = scan(undefined, true, { changed, onRead: (f, n) => bytes.set(f, (bytes.get(f) ?? 0) + n) })
  return { result, bytes }
}

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** El orden de los registros no es parte del contrato: se compara por id. */
const view = (r: ScanResult) => ({
  recs: [...r.recs].sort(byId),
  sessions: [...r.sessions.entries()].sort(([a], [b]) => (a < b ? -1 : 1)),
  limitHit: r.limitHit,
  sources: r.sources,
})

afterEach(() => {
  for (const k of ENV) delete process.env[k]
})

describe('scan incremental', () => {
  it('el segundo escaneo sin cambios lee 0 bytes y devuelve el mismo resultado', { timeout: 60_000 }, async () => {
    const { scan, files } = await setup()
    const first = counted(scan)
    expect(first.bytes.size).toBe(4)
    expect(first.bytes.get(files.codex)).toBeGreaterThan(1_000_000)
    const second = counted(scan)
    expect([...second.bytes.values()].reduce((a, n) => a + n, 0)).toBe(0)
    expect(second.result).toBe(first.result)
    const third = counted(scan, [files.claude, files.codex, files.gemini])
    expect(third.bytes.size).toBe(0)
    expect(third.result).toBe(first.result)
  })

  it('al anexar 10 lineas por fuente lee solo esas y cuadra con el escaneo completo', { timeout: 60_000 }, async () => {
    const { scan, files } = await setup()
    const before = counted(scan).result
    const add = { claude: claudeBlock(LINES, APPEND), codex: codexBlock(LINES + 1, APPEND), gemini: geminiBlock(LINES + 1, APPEND) }
    for (const s of ['claude', 'codex', 'gemini'] as const) appendFileSync(files[s], add[s])
    const { result, bytes } = counted(scan)
    expect(bytes.size).toBe(3)
    for (const s of ['claude', 'codex', 'gemini'] as const) expect(bytes.get(files[s])).toBe(Buffer.byteLength(add[s]))
    expect(result.recs).toHaveLength(before.recs.length + 3 * APPEND)
    expect(result.sources.claude.records).toBe(before.sources.claude.records + APPEND)
    expect(view(result)).toEqual(view(scan(undefined, false)))
  })

  it('con rutas avisadas solo revisa esas y cuadra con el escaneo completo', { timeout: 60_000 }, async () => {
    const { scan, files } = await setup()
    counted(scan)
    const add = codexBlock(LINES + 1, APPEND)
    appendFileSync(files.codex, add)
    // el log de Gemini tambien crece, pero no se avisa: el escaneo de respaldo lo recoge despues
    appendFileSync(files.gemini, geminiBlock(LINES + 1, APPEND))
    const { result, bytes } = counted(scan, [files.codex, join(tmpdir(), 'ajeno.jsonl'), files.codex + '.tmp'])
    expect([...bytes.keys()]).toEqual([files.codex])
    expect(bytes.get(files.codex)).toBe(Buffer.byteLength(add))
    expect(result.sources.gemini.records).toBe(LINES)
    const full = counted(scan)
    expect(full.bytes.size).toBe(1)
    expect(view(full.result)).toEqual(view(scan(undefined, false)))
  })

  it('un mensaje de Gemini repetido en lo anexado no se cuenta dos veces', { timeout: 60_000 }, async () => {
    const { scan, files } = await setup()
    const before = counted(scan).result
    appendFileSync(files.gemini, geminiLine(5) + '\n' + geminiBlock(LINES + 1, 2))
    const after = scan()
    expect(after.recs).toHaveLength(before.recs.length + 2)
    expect(view(after)).toEqual(view(scan(undefined, false)))
  })

  it('una linea a medio escribir se completa en el siguiente escaneo sin perder ni duplicar', { timeout: 60_000 }, async () => {
    const { scan, files } = await setup()
    counted(scan)
    const line = codexLine(LINES + 1)
    appendFileSync(files.codex, line.slice(0, 40))
    expect(counted(scan).result.sources.codex.records).toBe(LINES)
    appendFileSync(files.codex, line.slice(40) + '\n')
    const { result, bytes } = counted(scan)
    expect(result.sources.codex.records).toBe(LINES + 1)
    expect(bytes.get(files.codex)).toBe(Buffer.byteLength(line) + 1)
    expect(view(result)).toEqual(view(scan(undefined, false)))
  })

  it('un archivo reescrito, truncado o borrado reconstruye el resultado', { timeout: 60_000 }, async () => {
    const { scan, files } = await setup()
    counted(scan)
    truncateSync(files.claude, 0)
    writeFileSync(files.claude, claudeBlock(0, 100))
    rmSync(files.gemini)
    const { result } = counted(scan, [files.claude, files.gemini])
    expect(view(result)).toEqual(view(scan(undefined, false)))
    expect(result.sources.gemini.files).toBe(0)
    expect(result.recs.filter((r) => r.id.startsWith('gemini:'))).toHaveLength(0)
    // msg_0 sigue ganando por la copia de s2 con mayor salida
    expect(result.recs.find((r) => r.id === 'msg_0')?.output).toBe(9999)
  })

  it('un archivo nuevo avisado por el vigilante entra y cuadra con el escaneo completo', { timeout: 60_000 }, async () => {
    const { scan, base } = await setup()
    counted(scan)
    const fresh = join(base, 'claude', 'C--Proyectos-demo', 's3.jsonl')
    writeFileSync(fresh, claudeBlock(900_000, APPEND))
    const { result, bytes } = counted(scan, [fresh])
    expect([...bytes.keys()]).toEqual([fresh])
    expect(result.sources.claude.files).toBe(3)
    expect(view(result)).toEqual(view(scan(undefined, false)))
  })

  it('la cache en disco permite seguir leyendo por offset tras reiniciar', { timeout: 60_000 }, async () => {
    const { scan, files, base } = await setup()
    counted(scan)
    const cacheFile = join(base, 'data', 'cache.json')
    const end = Date.now() + 10_000
    while (!existsSync(cacheFile) && Date.now() < end) await new Promise((r) => setTimeout(r, 50))
    // la escritura es asincrona: se espera a que el archivo exista y deje de crecer
    await new Promise((r) => setTimeout(r, 500))
    vi.resetModules()
    const reloaded = (await import('../src/core/scan')).scan
    expect([...counted(reloaded).bytes.values()].reduce((a, n) => a + n, 0)).toBe(0)
    const add = { codex: codexBlock(LINES + 1, APPEND), gemini: geminiBlock(LINES + 1, APPEND) }
    appendFileSync(files.codex, add.codex)
    appendFileSync(files.gemini, add.gemini)
    const { result, bytes } = counted(reloaded)
    expect(bytes.get(files.codex)).toBe(Buffer.byteLength(add.codex))
    expect(bytes.get(files.gemini)).toBe(Buffer.byteLength(add.gemini))
    expect(view(result)).toEqual(view(reloaded(undefined, false)))
  })
})
