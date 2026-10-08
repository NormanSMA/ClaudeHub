import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { createEventHub, createWatcher } from '../src/server/watch'

const root = mkdtempSync(join(tmpdir(), 'ch-watch-'))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function until(cond: () => boolean, timeout = 3000): Promise<void> {
  const end = Date.now() + timeout
  while (!cond() && Date.now() < end) await sleep(20)
}

afterAll(() => rmSync(root, { recursive: true, force: true }))

describe('createWatcher', () => {
  const open: Array<{ close(): void }> = []
  afterEach(() => {
    while (open.length) open.pop()?.close()
  })

  it('una rafaga de escrituras produce un solo aviso con el ultimo archivo', async () => {
    const dir = mkdtempSync(join(root, 'burst-'))
    const calls: string[] = []
    open.push(createWatcher([dir], (f) => calls.push(f), { debounceMs: 150 }))
    for (let i = 0; i < 5; i++) writeFileSync(join(dir, 'a.jsonl'), `linea ${i}\n`)
    await until(() => calls.length > 0)
    await sleep(400)
    expect(calls).toHaveLength(1)
    expect(calls[0].endsWith('a.jsonl')).toBe(true)
  })

  it('un archivo .txt no avisa', async () => {
    const dir = mkdtempSync(join(root, 'txt-'))
    const calls: string[] = []
    open.push(createWatcher([dir], (f) => calls.push(f), { debounceMs: 100 }))
    writeFileSync(join(dir, 'nota.txt'), 'hola')
    await sleep(500)
    expect(calls).toHaveLength(0)
  })

  it('detecta cambios en subcarpetas', async () => {
    const dir = mkdtempSync(join(root, 'rec-'))
    mkdirSync(join(dir, 'sub'))
    const calls: string[] = []
    open.push(createWatcher([dir], (f) => calls.push(f), { debounceMs: 100 }))
    writeFileSync(join(dir, 'sub', 'b.json'), '{}')
    await until(() => calls.length > 0)
    expect(calls).toHaveLength(1)
    expect(calls[0].endsWith('b.json')).toBe(true)
  })

  it('una carpeta inexistente no falla y se reintenta', async () => {
    const dir = join(root, 'tarde')
    const errors: unknown[] = []
    const calls: string[] = []
    const w = createWatcher([dir], (f) => calls.push(f), { debounceMs: 100, retryMs: 100, onError: (e) => errors.push(e) })
    open.push(w)
    expect(w.watching()).toEqual([])
    mkdirSync(dir)
    await until(() => w.watching().length === 1)
    expect(w.watching()).toEqual([dir])
    writeFileSync(join(dir, 'c.sqlite'), 'x')
    await until(() => calls.length > 0)
    expect(calls).toHaveLength(1)
    expect(errors).toHaveLength(0)
  })

  it('close cancela watchers y temporizadores', async () => {
    const dir = mkdtempSync(join(root, 'close-'))
    const calls: string[] = []
    const w = createWatcher([dir, join(root, 'nunca')], (f) => calls.push(f), { debounceMs: 200, retryMs: 50 })
    expect(w.watching()).toEqual([dir])
    writeFileSync(join(dir, 'd.jsonl'), 'x')
    await sleep(60)
    w.close()
    expect(w.watching()).toEqual([])
    mkdirSync(join(root, 'nunca'))
    await sleep(400)
    expect(calls).toHaveLength(0)
    expect(w.watching()).toEqual([])
  })
})

describe('createEventHub', () => {
  afterEach(() => vi.useRealTimers())

  it('el noveno cliente recibe null', () => {
    const hub = createEventHub()
    const unsubs = Array.from({ length: 8 }, () => hub.subscribe(() => {}))
    expect(unsubs.every((u) => typeof u === 'function')).toBe(true)
    expect(hub.subscribe(() => {})).toBeNull()
    expect(hub.size()).toBe(8)
    unsubs[0]?.()
    expect(hub.size()).toBe(7)
    expect(hub.subscribe(() => {})).not.toBeNull()
    hub.close()
  })

  it('broadcast envia el evento sin datos a todos', () => {
    const hub = createEventHub()
    const a: string[] = []
    const b: string[] = []
    hub.subscribe((c) => a.push(c))
    hub.subscribe((c) => b.push(c))
    hub.broadcast('changed')
    expect(a).toEqual(['event: changed\ndata: {}\n\n'])
    expect(b).toEqual(a)
    hub.close()
  })

  it('envia un latido cada 25 s', () => {
    vi.useFakeTimers()
    const hub = createEventHub()
    const got: string[] = []
    hub.subscribe((c) => got.push(c))
    vi.advanceTimersByTime(24_999)
    expect(got).toEqual([])
    vi.advanceTimersByTime(1)
    expect(got).toEqual([': ping\n\n'])
    vi.advanceTimersByTime(25_000)
    expect(got).toHaveLength(2)
    hub.close()
  })

  it('un cliente cuyo send lanza se elimina', () => {
    const hub = createEventHub()
    const ok: string[] = []
    hub.subscribe(() => {
      throw new Error('roto')
    })
    hub.subscribe((c) => ok.push(c))
    expect(hub.size()).toBe(2)
    hub.broadcast('changed')
    expect(hub.size()).toBe(1)
    expect(ok).toHaveLength(1)
    hub.close()
  })

  it('close elimina clientes y detiene el latido', () => {
    vi.useFakeTimers()
    const hub = createEventHub()
    const got: string[] = []
    hub.subscribe((c) => got.push(c))
    hub.close()
    expect(hub.size()).toBe(0)
    vi.advanceTimersByTime(100_000)
    expect(got).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })
})
