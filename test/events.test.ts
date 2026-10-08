import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PORT = 4392
const BASE = `http://127.0.0.1:${PORT}`
const root = mkdtempSync(join(tmpdir(), 'ch-events-'))
const claudeDir = join(root, 'claude')
const dataDir = join(root, 'data')
let child: ChildProcess | null = null

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Sse {
  text(): string
  count(event: string): number
  close(): void
}

/** Abre /api/events y acumula el texto recibido. */
async function openSse(): Promise<{ status: number; sse: Sse }> {
  const ac = new AbortController()
  const res = await fetch(`${BASE}/api/events`, { signal: ac.signal })
  let buf = ''
  if (res.status === 200 && res.body) {
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    void (async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
        }
      } catch {
        /* conexion cerrada por el test */
      }
    })()
  } else {
    await res.text()
  }
  return {
    status: res.status,
    sse: {
      text: () => buf,
      count: (event) => buf.split(`event: ${event}\n`).length - 1,
      close: () => ac.abort(),
    },
  }
}

/** Pide con un Host ajeno. fetch no permite cambiar Host, por eso se usa node:http. */
function statusWithHost(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: PORT, path: '/api/events', headers: { Host: host } }, (res) => {
      resolve(res.statusCode ?? 0)
      res.destroy()
    })
    req.on('error', reject)
    req.end()
  })
}

async function waitPort(timeout = 30_000): Promise<void> {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    try {
      const r = await fetch(`${BASE}/api/config`)
      if (r.ok) return
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

beforeAll(async () => {
  mkdirSync(claudeDir, { recursive: true })
  mkdirSync(dataDir, { recursive: true })
  for (const d of ['codex', 'gemini']) mkdirSync(join(root, d), { recursive: true })
  child = spawn('pnpm', ['exec', 'tsx', 'src/server/index.ts'], {
    cwd: process.cwd(),
    shell: process.platform === 'win32',
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: String(PORT),
      CLAUDEHUB_DEMO: '',
      CLAUDE_PROJECTS_DIR: claudeDir,
      CODEX_SESSIONS_DIR: join(root, 'codex'),
      GEMINI_TMP_DIR: join(root, 'gemini'),
      CLAUDEHUB_DATA: dataDir,
      CLAUDEHUB_CACHE: join(dataDir, 'cache.json'),
      CLAUDEHUB_CONFIG: join(dataDir, 'config.json'),
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

describe('GET /api/events', () => {
  it('envia hello con las cabeceras SSE y sin CORS', async () => {
    const res = await fetch(`${BASE}/api/events`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/event-stream; charset=utf-8')
    expect(res.headers.get('cache-control')).toBe('no-cache')
    expect(res.headers.get('x-accel-buffering')).toBe('no')
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
    const reader = res.body!.getReader()
    const { value } = await reader.read()
    expect(new TextDecoder().decode(value)).toBe('event: hello\ndata: {}\n\n')
    await reader.cancel()
  })

  it('escribir un .jsonl avisa changed en menos de 1500 ms', async () => {
    const { sse } = await openSse()
    await sleep(200)
    const t0 = Date.now()
    writeFileSync(join(claudeDir, 's1.jsonl'), '{}\n')
    while (sse.count('changed') === 0 && Date.now() - t0 < 3000) await sleep(20)
    const took = Date.now() - t0
    sse.close()
    expect(sse.count('changed')).toBe(1)
    expect(took).toBeLessThan(1500)
  })

  it('una rafaga de 5 escrituras produce un solo aviso', async () => {
    await sleep(800)
    const { sse } = await openSse()
    await sleep(200)
    for (let i = 0; i < 5; i++) writeFileSync(join(claudeDir, 's2.jsonl'), `linea ${i}\n`)
    await sleep(1500)
    sse.close()
    expect(sse.count('changed')).toBe(1)
  })

  it('escribir cache.json no dispara aviso', async () => {
    await sleep(800)
    const { sse } = await openSse()
    await sleep(200)
    writeFileSync(join(dataDir, 'cache.json'), '{}')
    await sleep(1200)
    sse.close()
    expect(sse.count('changed')).toBe(0)
  })

  it('el noveno cliente recibe 429 con JSON', async () => {
    const open: Sse[] = []
    for (let i = 0; i < 8; i++) {
      const r = await openSse()
      expect(r.status).toBe(200)
      open.push(r.sse)
    }
    const res = await fetch(`${BASE}/api/events`)
    expect(res.status).toBe(429)
    const body = (await res.json()) as { error?: string }
    expect(typeof body.error).toBe('string')
    for (const s of open) s.close()
    // al cerrar los clientes se liberan los cupos
    await sleep(500)
    const again = await openSse()
    expect(again.status).toBe(200)
    again.sse.close()
  })

  it('un Host ajeno recibe 403', async () => {
    expect(await statusWithHost('evil.com')).toBe(403)
  })
})
