import type { On, SessionMeasureInput } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { ContextWindowsFile, RateLimitsFile } from '../../../src/shared/files'

type Write = { path: string; text: string }

const WINDOWS_DATA = 'C:\\Users\\ada\\AppData\\Roaming\\ClaudeHub'
const RESET_5H = '2026-10-26T18:00:00.000Z'
const RESET_7D = '2026-10-30T12:00:00.000Z'
const NOW = Date.parse('2026-10-26T15:00:00.000Z')

const MEASURE: SessionMeasureInput = {
  context: { window: 200_000, tokens: 86_000, percent: 43 },
  rateLimits: [
    { kind: 'five_hour', percentUsed: 51.5, resetsAt: RESET_5H },
    { kind: 'seven_day', percentUsed: 33, resetsAt: RESET_7D },
  ],
  changed: ['context', 'rateLimits'],
}

// Nada corre debajo del mod: cada hook hace de motor y anota lo que el mod escribe.
function engine(on: On, env: Record<string, string>, hasLibrary = false) {
  const writes: Write[] = []
  mock.env(on, env)
  mock.clock(on, { now: NOW })
  on('session.id', () => ({ value: 'sesion-1' }))
  on('session.model', () => ({ value: 'claude-opus-5' }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('fs.exists', () => ({ value: hasLibrary }))
  on('fs.read', () => ({ deny: 'no existe' }))
  on('fs.write', (_, e) => {
    writes.push({ path: e.path, text: e.text })
    return { value: undefined }
  })
  return writes
}

// En un host Windows el motor completa las rutas con unidad y barras invertidas antes de que el hook las vea.
function posix(writes: Write[]): string[] {
  return writes.map((w) => w.path.replace(/^[A-Za-z]:/, '').replaceAll('\\', '/')).sort()
}

function parse<T>(writes: Write[], file: string): T {
  const hit = writes.find((w) => w.path.endsWith(file))
  if (!hit) throw new Error(`no se escribio ${file}`)
  return JSON.parse(hit.text) as T
}

test('rate-limits.json cumple la forma de RateLimitsFile y convierte porcentaje y reinicio', async ($, on) => {
  const writes = engine(on, { APPDATA: 'C:\\Users\\ada\\AppData\\Roaming' })
  await $.session.measure(MEASURE)

  const file = parse<RateLimitsFile>(writes, 'rate-limits.json')
  const typed = file satisfies RateLimitsFile
  expect(Object.keys(typed).sort()).toEqual(['fiveHour', 'sevenDay', 'updatedAt'])
  expect(typed.fiveHour).toEqual({ pct: 51.5, resetsAt: Date.parse(RESET_5H) })
  expect(typed.sevenDay).toEqual({ pct: 33, resetsAt: Date.parse(RESET_7D) })
  expect(typed.updatedAt).toBe(NOW)
})

test('context-windows.json cumple la forma de ContextWindowsFile', async ($, on) => {
  const writes = engine(on, { APPDATA: 'C:\\Users\\ada\\AppData\\Roaming' })
  await $.session.measure(MEASURE)

  const file = parse<ContextWindowsFile>(writes, 'context-windows.json')
  const typed = file satisfies ContextWindowsFile
  expect(Object.keys(typed)).toEqual(['sesion-1'])
  expect(typed['sesion-1']).toEqual({ size: 200_000, model: 'claude-opus-5', ts: NOW })
})

test('en Windows escribe en APPDATA con barras invertidas', async ($, on) => {
  const writes = engine(on, { APPDATA: 'C:\\Users\\ada\\AppData\\Roaming' })
  await $.session.measure(MEASURE)

  expect(writes.map((w) => w.path).sort()).toEqual([`${WINDOWS_DATA}\\context-windows.json`, `${WINDOWS_DATA}\\rate-limits.json`])
})

test('en Linux escribe en ~/.config/ClaudeHub', async ($, on) => {
  const writes = engine(on, { HOME: '/home/ada' })
  await $.session.measure(MEASURE)

  expect(posix(writes)).toEqual(['/home/ada/.config/ClaudeHub/context-windows.json', '/home/ada/.config/ClaudeHub/rate-limits.json'])
})

test('en macOS escribe en Library/Application Support', async ($, on) => {
  const writes = engine(on, { HOME: '/Users/ada' }, true)
  await $.session.measure(MEASURE)

  expect(posix(writes)).toEqual([
    '/Users/ada/Library/Application Support/ClaudeHub/context-windows.json',
    '/Users/ada/Library/Application Support/ClaudeHub/rate-limits.json',
  ])
})

test('sin carpeta de datos no escribe nada', async ($, on) => {
  const writes = engine(on, {})
  await $.session.measure(MEASURE)

  expect(writes).toHaveLength(0)
})

test('sin limites del plan ni ventana no inventa valores', async ($, on) => {
  const writes = engine(on, { APPDATA: 'C:\\Users\\ada\\AppData\\Roaming' })
  await $.session.measure({ context: { window: 0 }, rateLimits: [], changed: ['context', 'rateLimits'] })

  expect(writes).toHaveLength(0)
})

test('una ventana sin reinicio se guarda como null y la otra se conserva', async ($, on) => {
  const writes = engine(on, { APPDATA: 'C:\\Users\\ada\\AppData\\Roaming' })
  await $.session.measure({
    context: { window: 200_000 },
    rateLimits: [{ kind: 'five_hour', percentUsed: 120, resetsAt: RESET_5H }, { kind: 'seven_day', percentUsed: 10 }],
    changed: ['rateLimits'],
  })

  const file = parse<RateLimitsFile>(writes, 'rate-limits.json')
  expect(file.fiveHour).toEqual({ pct: 100, resetsAt: Date.parse(RESET_5H) })
  expect(file.sevenDay).toBeNull()
})

const CHUB = { command: 'chub', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

const FRESH = { todayFresh: 1_250_000, todayCacheRead: 48_000_000, todayCostUsd: 3.456 }

test('/chub se registra al iniciar la sesion', async ($, on) => {
  const names: string[] = []
  on('command.register', (_, e) => {
    names.push(e.name)
    return { value: { command: e.name } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  expect(names).toEqual(['chub'])
})

test('/chub resume tokens nuevos, cache y costo con una respuesta simulada', async ($, on) => {
  on('http.fetch', (_, e) => {
    expect(e.url).toBe('http://127.0.0.1:4317/api/active')
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ ...FRESH, chats: [] }) } }
  })
  const { text } = await $.command.run(CHUB)

  expect(text).toBe('ClaudeHub hoy: nuevos 1.3M | cache 48M | costo $3.46')
})

test('/chub avisa "sin precio" cuando el servidor no trae costo', async ($, on) => {
  const { todayFresh, todayCacheRead } = FRESH
  on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ todayFresh, todayCacheRead }) } }))
  const { text } = await $.command.run(CHUB)

  expect(text).toContain('costo sin precio')
})

test('/chub con el servidor caido da un mensaje claro en espanol', async ($, on) => {
  on('http.fetch', () => ({ deny: 'ECONNREFUSED' }))
  const { text } = await $.command.run(CHUB)

  expect(text).toContain('ClaudeHub no responde')
})

test('/chub con un error HTTP da el mensaje de servidor caido', async ($, on) => {
  on('http.fetch', () => ({ value: { status: 500, ok: false, headers: {}, text: 'error' } }))

  expect((await $.command.run(CHUB)).text).toContain('ClaudeHub no responde')
})

test('/chub con un cuerpo ajeno avisa del formato', async ($, on) => {
  on('http.fetch', () => ({ value: { status: 200, ok: true, headers: {}, text: '<html></html>' } }))

  expect((await $.command.run(CHUB)).text).toContain('formato')
})

const BAND = {
  plugin: 'claudehub-mod',
  component: 'AbovePrompt',
  requestId: 'banda',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

test('la banda esta apagada por defecto', async ($, on) => {
  engine(on, { APPDATA: 'C:\\Users\\ada\\AppData\\Roaming' })
  on('ui.render', ($, e) => $.ui.resolve(e).Text({ children: 'motor' }))
  await $.session.measure(MEASURE)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /Plan 5 h/ })).toBeUndefined()
  await ui.unmount()
})

test('la banda muestra el porcentaje de 5 h cuando se activa', { options: { showBand: true } }, async ($, on) => {
  engine(on, { APPDATA: 'C:\\Users\\ada\\AppData\\Roaming' })
  await $.session.measure(MEASURE)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /Plan 5 h/ }))?.text).toBe('Plan 5 h: 52%')
    await ui.unmount()
  }
})
