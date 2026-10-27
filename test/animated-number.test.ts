import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AnimatedNumber, animateNumber, interpolate } from '../src/web/components/AnimatedNumber'

describe('AnimatedNumber', () => {
  let motion: MediaQueryList
  let listeners: Set<() => void>

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    listeners = new Set()
    motion = {
      matches: false,
      addEventListener: vi.fn((_event: string, listener: () => void) => listeners.add(listener)),
      removeEventListener: vi.fn((_event: string, listener: () => void) => listeners.delete(listener)),
    } as unknown as MediaQueryList
    vi.stubGlobal('window', { matchMedia: vi.fn(() => motion) })
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) =>
      setTimeout(() => callback(performance.now()), 16)))
    vi.stubGlobal('cancelAnimationFrame', vi.fn((frame: number) => clearTimeout(frame)))
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('conserva el valor inicial y aplica el formato', () => {
    const html = renderToStaticMarkup(createElement(AnimatedNumber, { value: 12.5, format: (v) => `$${v.toFixed(2)}` }))
    expect(html).toBe('$12.50')
  })

  it.each([1234.56789, 0, -100.125])('alcanza el valor final exacto %s en 400 ms', (value) => {
    const update = vi.fn()
    animateNumber(25, value, update)
    vi.advanceTimersByTime(192)
    expect(update.mock.lastCall?.[0]).toBe(interpolate(25, value, 192))
    expect(update.mock.lastCall?.[0]).not.toBe(value)
    vi.advanceTimersByTime(208)
    expect(update.mock.lastCall?.[0]).toBe(value)
    expect(vi.getTimerCount()).toBe(0)
    expect(listeners.size).toBe(0)
  })

  it('salta al valor final con movimiento reducido', () => {
    Object.assign(motion, { matches: true })
    const update = vi.fn()
    animateNumber(10, 200, update)
    expect(update).toHaveBeenCalledExactlyOnceWith(200)
    expect(requestAnimationFrame).not.toHaveBeenCalled()
    expect(listeners.size).toBe(0)
  })

  it('termina una animación al activar movimiento reducido', () => {
    const update = vi.fn()
    animateNumber(0, 100, update)
    vi.advanceTimersByTime(160)
    expect(update.mock.lastCall?.[0]).toBe(40)
    Object.assign(motion, { matches: true })
    for (const listener of [...listeners]) listener()
    expect(update.mock.lastCall?.[0]).toBe(100)
    expect(vi.getTimerCount()).toBe(0)
    expect(listeners.size).toBe(0)
  })

  it('retoma el valor visible después de cancelar el destino anterior', () => {
    const update = vi.fn()
    const cancel = animateNumber(0, 100, update)
    vi.advanceTimersByTime(160)
    const shown = update.mock.lastCall![0]
    cancel()
    expect(vi.getTimerCount()).toBe(0)
    expect(listeners.size).toBe(0)
    update.mockClear()
    animateNumber(shown, 200, update)
    vi.advanceTimersByTime(16)
    expect(update.mock.lastCall?.[0]).toBe(interpolate(shown, 200, 16))
    vi.advanceTimersByTime(384)
    expect(update.mock.lastCall?.[0]).toBe(200)
  })

  it('cancela los cuadros y las escuchas al desmontar', () => {
    const update = vi.fn()
    const cancel = animateNumber(0, 100, update)
    vi.advanceTimersByTime(32)
    cancel()
    update.mockClear()
    vi.advanceTimersByTime(1000)
    expect(update).not.toHaveBeenCalled()
    expect(listeners.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('omite cuadros cuando el valor no cambia', () => {
    const update = vi.fn()
    animateNumber(42, 42, update)
    expect(update).toHaveBeenCalledExactlyOnceWith(42)
    expect(requestAnimationFrame).not.toHaveBeenCalled()
  })

  it.each([[0, 100], [100, 0], [-30, 50], [10, 10]])('interpola monótonamente desde %s hasta %s', (from, to) => {
    let previous = from
    for (let elapsed = 0; elapsed <= 400; elapsed += 5) {
      const value = interpolate(from, to, elapsed)
      expect(value).toBeGreaterThanOrEqual(Math.min(from, to))
      expect(value).toBeLessThanOrEqual(Math.max(from, to))
      if (to >= from) expect(value).toBeGreaterThanOrEqual(previous)
      else expect(value).toBeLessThanOrEqual(previous)
      previous = value
    }
    expect(previous).toBe(to)
    expect(interpolate(from, to, -1)).toBe(from)
    expect(interpolate(from, to, 1000)).toBe(to)
  })
})
