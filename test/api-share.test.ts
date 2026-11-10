import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetSharedRequests, sharedRequest } from '../src/web/api'

const reply = (body: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })

describe('peticiones compartidas', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetSharedRequests()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('dos componentes que piden la misma ruta a la vez hacen una sola petición', async () => {
    const fetchMock = vi.fn(() => reply({ n: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    const [a, b] = await Promise.all([sharedRequest('/api/active', 5_000), sharedRequest('/api/active', 4_000)])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(a).toEqual({ n: 1 })
    expect(b).toBe(a)
  })

  it('un sondeo reutiliza el último dato mientras sea más joven que su intervalo', async () => {
    const fetchMock = vi.fn(() => reply({ n: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    await sharedRequest('/api/active', 5_000)
    vi.advanceTimersByTime(3_000)
    await sharedRequest('/api/active', 5_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(2_500)
    await sharedRequest('/api/active', 5_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('un aviso del servidor (maxAge 0) no reutiliza datos terminados', async () => {
    const fetchMock = vi.fn(() => reply({ n: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    await sharedRequest('/api/active', 0)
    await sharedRequest('/api/active', 0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rutas distintas no se mezclan y un error no queda guardado', async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }))
      .mockImplementation(() => reply({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(sharedRequest('/api/live', 5_000)).rejects.toThrow('500')
    await expect(sharedRequest('/api/live', 5_000)).resolves.toEqual({ ok: true })
    await sharedRequest('/api/config', 5_000)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
