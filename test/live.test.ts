import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLive, throttle, type SourceLike } from '../src/web/live'

class FakeSource implements SourceLike {
  readyState = 1
  closed = false
  private handlers = new Map<string, Array<() => void>>()
  addEventListener(type: string, listener: () => void) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), listener])
  }
  close() {
    this.closed = true
    this.readyState = 2
  }
  emit(type: string) {
    for (const h of this.handlers.get(type) ?? []) h()
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('throttle', () => {
  it('ejecuta el primer aviso de inmediato', () => {
    const fn = vi.fn()
    const t = throttle(fn, 1500)
    t()
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1500)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('una rafaga produce una sola ejecucion final', () => {
    const fn = vi.fn()
    const t = throttle(fn, 1500)
    t()
    for (let i = 0; i < 5; i++) t()
    expect(fn).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1500)
    expect(fn).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(5000)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('cancel descarta la ejecucion pendiente', () => {
    const fn = vi.fn()
    const t = throttle(fn, 1500)
    t()
    t()
    t.cancel()
    vi.advanceTimersByTime(3000)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('no lanza si fn falla', () => {
    const t = throttle(() => {
      throw new Error('x')
    }, 100)
    expect(() => t()).not.toThrow()
  })
})

describe('createLive', () => {
  it('sin EventSource el estado es poll', () => {
    const live = createLive(() => null)
    const status = vi.fn()
    live.onStatus(status)
    live.subscribeChanges(() => {})
    expect(status).toHaveBeenCalledWith('poll')
    expect(status).toHaveBeenCalledTimes(1)
  })

  it('si el constructor falla el estado es poll', () => {
    const live = createLive(() => {
      throw new Error('no disponible')
    })
    const status = vi.fn()
    expect(() => live.onStatus(status)).not.toThrow()
    expect(status).toHaveBeenLastCalledWith('poll')
  })

  it('usa una sola conexion y pasa a live con hello', () => {
    const sources: FakeSource[] = []
    const live = createLive(() => {
      const s = new FakeSource()
      sources.push(s)
      return s
    })
    const status = vi.fn()
    const changed = vi.fn()
    live.onStatus(status)
    live.subscribeChanges(changed)
    live.subscribeChanges(() => {})
    expect(sources).toHaveLength(1)
    sources[0].emit('hello')
    expect(status).toHaveBeenLastCalledWith('live')
    sources[0].emit('changed')
    expect(changed).toHaveBeenCalledTimes(1)
  })

  it('un error cierra el canal (429) y vuelve a poll', () => {
    const sources: FakeSource[] = []
    const live = createLive(() => {
      const s = new FakeSource()
      sources.push(s)
      return s
    })
    const status = vi.fn()
    live.onStatus(status)
    sources[0].emit('hello')
    sources[0].readyState = 2
    sources[0].emit('error')
    expect(status).toHaveBeenLastCalledWith('poll')
    expect(sources[0].closed).toBe(true)
    vi.advanceTimersByTime(30_000)
    expect(sources).toHaveLength(2)
  })

  it('cierra la conexion al irse el ultimo oyente', () => {
    const sources: FakeSource[] = []
    const live = createLive(() => {
      const s = new FakeSource()
      sources.push(s)
      return s
    })
    const off = live.subscribeChanges(() => {})
    off()
    expect(sources[0].closed).toBe(true)
  })

  it('un oyente que lanza no afecta a los demas', () => {
    const sources: FakeSource[] = []
    const live = createLive(() => {
      const s = new FakeSource()
      sources.push(s)
      return s
    })
    const ok = vi.fn()
    live.subscribeChanges(() => {
      throw new Error('x')
    })
    live.subscribeChanges(ok)
    expect(() => sources[0].emit('changed')).not.toThrow()
    expect(ok).toHaveBeenCalledTimes(1)
  })
})
