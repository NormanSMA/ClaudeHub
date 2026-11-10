import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { request } from 'node:http'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const root = mkdtempSync(join(tmpdir(), 'ch-http-'))
const claudeDir = join(root, 'claude')
const distDir = join(root, 'dist')
const dataDir = join(root, 'data')
const configFile = join(dataDir, 'config.json')
let child: ChildProcess | null = null
let port = 0
let base = ''

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Pide un puerto libre al sistema; evita chocar con 4317, 4318 y 4392. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port: p } = srv.address() as { port: number }
      srv.close(() => resolve(p))
    })
  })
}

async function waitPort(timeout = 30_000): Promise<void> {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    try {
      if ((await fetch(`${base}/api/config`)).ok) return
    } catch {
      /* aun no escucha */
    }
    await sleep(150)
  }
  throw new Error('El servidor no abrio el puerto a tiempo')
}

function killChild(): void {
  if (!child?.pid) return
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else child.kill('SIGKILL')
  child = null
}

/** PUT sin content-length: node usa Transfer-Encoding chunked cuando se escribe el cuerpo por partes. */
function putChunked(body: string): Promise<{ status: number; json: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const req = request(
      { host: '127.0.0.1', port, path: '/api/settings', method: 'PUT', headers: { 'Content-Type': 'application/json', Origin: base } },
      (res) => {
        let text = ''
        res.on('data', (d) => (text += d))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, json: JSON.parse(text) }))
      },
    )
    req.on('error', reject)
    for (let i = 0; i < body.length; i += 4000) req.write(body.slice(i, i + 4000))
    req.end()
  })
}

const put = (body: unknown) =>
  fetch(`${base}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Origin: base },
    body: JSON.stringify(body),
  })

const claudeLine = (id: string, model: string, ts: number) =>
  JSON.stringify({
    type: 'assistant',
    isSidechain: false,
    timestamp: new Date(ts).toISOString(),
    sessionId: 's1',
    message: { id, model, usage: { input_tokens: 2, cache_creation_input_tokens: 10, cache_read_input_tokens: 100, output_tokens: 5 } },
  }) + '\n'

async function until<T>(read: () => Promise<T>, ok: (v: T) => boolean, timeout = 12_000): Promise<T> {
  const end = Date.now() + timeout
  let last = await read()
  while (!ok(last) && Date.now() < end) {
    await sleep(300)
    last = await read()
  }
  return last
}

beforeAll(async () => {
  mkdirSync(join(claudeDir, 'C--proj'), { recursive: true })
  mkdirSync(join(distDir, 'assets'), { recursive: true })
  mkdirSync(dataDir, { recursive: true })
  for (const d of ['codex', 'gemini']) mkdirSync(join(root, d), { recursive: true })
  writeFileSync(join(distDir, 'index.html'), '<!doctype html><title>prueba</title>')
  writeFileSync(join(distDir, 'assets', 'app.js'), 'console.log(1)')
  // sin red en las pruebas
  writeFileSync(configFile, JSON.stringify({ checkUpdates: false }))
  port = await freePort()
  base = `http://127.0.0.1:${port}`
  child = spawn('pnpm', ['exec', 'tsx', 'src/server/index.ts'], {
    cwd: process.cwd(),
    shell: process.platform === 'win32',
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: String(port),
      CLAUDEHUB_DEMO: '',
      CLAUDEHUB_DIST: distDir,
      CLAUDE_PROJECTS_DIR: claudeDir,
      CODEX_SESSIONS_DIR: join(root, 'codex'),
      GEMINI_TMP_DIR: join(root, 'gemini'),
      CLAUDEHUB_DATA: dataDir,
      CLAUDEHUB_CACHE: join(dataDir, 'cache.json'),
      CLAUDEHUB_CONFIG: configFile,
    },
  })
  await waitPort()
}, 40_000)

afterAll(() => {
  killChild()
  try {
    rmSync(root, { recursive: true, force: true })
  } catch {
    /* Windows puede retener la carpeta unos instantes */
  }
})

describe('rutas desconocidas y archivos estaticos', () => {
  it('una ruta /api desconocida responde 404 JSON y no el index.html', async () => {
    for (const [method, path] of [['GET', '/api/no-existe'], ['POST', '/api/no-existe'], ['GET', '/api/'], ['GET', '/api']]) {
      const res = await fetch(base + path, { method })
      expect(res.status, `${method} ${path}`).toBe(404)
      expect(res.headers.get('content-type')).toContain('application/json')
      expect(typeof ((await res.json()) as { error?: string }).error).toBe('string')
    }
  })

  it('un directorio de la interfaz sirve index.html y nunca 500', async () => {
    for (const path of ['/assets', '/assets/']) {
      const res = await fetch(base + path)
      expect(res.status, path).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/html')
      expect(await res.text()).toContain('<title>prueba</title>')
    }
  })

  it('sirve un archivo real y cae en index.html con una ruta de la interfaz', async () => {
    const js = await fetch(`${base}/assets/app.js`)
    expect(js.status).toBe(200)
    expect(js.headers.get('content-type')).toBe('text/javascript')
    expect(await js.text()).toBe('console.log(1)')
    const spa = await fetch(`${base}/otra-pestana`)
    expect(spa.status).toBe(200)
    expect(await spa.text()).toContain('<title>prueba</title>')
  })
})

describe('PUT /api/settings', () => {
  it('rechaza con 413 un cuerpo chunked de mas de 20 000 bytes', async () => {
    const big = JSON.stringify({ name: 'a'.repeat(30_000) })
    const r = await putChunked(big)
    expect(r.status).toBe(413)
    expect(typeof r.json.error).toBe('string')
  })

  it('rechaza con 413 un cuerpo grande con content-length', async () => {
    const res = await put({ name: 'a'.repeat(30_000) })
    expect(res.status).toBe(413)
    expect(typeof ((await res.json()) as { error?: string }).error).toBe('string')
  })

  it('acepta un cuerpo chunked pequeno y fusiona un PUT parcial', async () => {
    const first = await putChunked(JSON.stringify({ name: 'Ada', sources: { gemini: false } }))
    expect(first.status).toBe(200)
    const res = await put({ alertAt: 0.7, sources: { omniroute: true } })
    expect(res.status).toBe(200)
    const { config } = (await res.json()) as { config: { name: string; alertAt: number; sources: Record<string, boolean> } }
    expect(config.name).toBe('Ada')
    expect(config.alertAt).toBe(0.7)
    expect(config.sources).toEqual({ codex: true, gemini: false, omniroute: true })
    await put({ sources: { omniroute: false } })
  })
})

describe('reportes memoizados', () => {
  it('un registro nuevo aparece en summary, models y la lista de ajustes', async () => {
    const summary = async () => (await (await fetch(`${base}/api/summary?range=all`)).json()) as { messages: number }
    const settings = async () => (await (await fetch(`${base}/api/settings`)).json()) as { models: string[] }
    const models = async () => (await (await fetch(`${base}/api/models?range=all`)).json()) as { models: { model: string }[] }
    const file = join(claudeDir, 'C--proj', 's1.jsonl')
    writeFileSync(file, claudeLine('m1', 'claude-opus-5', Date.now()))
    const first = await until(summary, (s) => s.messages === 1)
    expect(first.messages).toBe(1)
    expect((await settings()).models).toContain('Opus 5')

    appendFileSync(file, claudeLine('m2', 'claude-sonnet-5-5', Date.now()))
    const second = await until(summary, (s) => s.messages === 2)
    expect(second.messages).toBe(2)
    const names = (await until(settings, (s) => s.models.length === 2)).models
    expect(names).toHaveLength(2)
    expect((await models()).models).toHaveLength(2)
  }, 40_000)

  it('un rango abierto no queda congelado: su tope se renueva cada ciclo', async () => {
    const open = async () => ((await (await fetch(`${base}/api/summary?from=2020-01-01`)).json()) as { range: { to: number } }).range.to
    const a = await open()
    await sleep(4_600)
    const b = await open()
    expect(b).toBeGreaterThan(a)
  }, 20_000)

  it('un rango cerrado con la misma consulta devuelve lo mismo entre peticiones', async () => {
    const url = `${base}/api/summary?from=2020-01-01&to=2020-01-31&source=claude`
    const a = await (await fetch(url)).json()
    const b = await (await fetch(url)).json()
    expect(b).toEqual(a)
  })
})

describe('errores internos', () => {
  it('una excepcion en la ruta responde 500 JSON sin traza', async () => {
    // config.json como carpeta: renameSync falla dentro de saveConfig
    rmSync(configFile, { force: true })
    mkdirSync(configFile)
    try {
      const res = await put({ name: 'x' })
      expect(res.status).toBe(500)
      expect(res.headers.get('content-type')).toContain('application/json')
      const text = await res.text()
      const body = JSON.parse(text) as { error?: string }
      expect(typeof body.error).toBe('string')
      expect(text).not.toMatch(/\bat\s.+\(|EISDIR|EPERM|node:|\.ts:\d+/)
    } finally {
      rmSync(configFile, { recursive: true, force: true })
      rmSync(`${configFile}.tmp`, { force: true })
    }
  })
})
