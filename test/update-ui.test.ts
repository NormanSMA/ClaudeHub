import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UpdateInfo } from '../src/web/api'
import { balloonText, loadDismissed, normVersion, saveDismissed, shouldShow } from '../src/web/update'

const info = (over: Partial<UpdateInfo> = {}): UpdateInfo => ({
  enabled: true,
  current: '0.4.0',
  latest: '0.5.0',
  available: true,
  url: 'https://github.com/NormanSMA/ClaudeHub/releases/tag/v0.5.0',
  name: 'v0.5.0',
  notes: ['Aviso de version nueva'],
  checkedAt: 1,
  ...over,
})

afterEach(() => vi.unstubAllGlobals())

describe('shouldShow', () => {
  it('muestra una version nueva no descartada', () => {
    expect(shouldShow(info(), null)).toBe(true)
  })
  it('no muestra sin respuesta, apagado o sin version nueva', () => {
    expect(shouldShow(null, null)).toBe(false)
    expect(shouldShow(undefined, null)).toBe(false)
    expect(shouldShow(info({ available: false }), null)).toBe(false)
    expect(shouldShow(info({ enabled: false }), null)).toBe(false)
  })
  it('no muestra sin version o sin enlace https', () => {
    expect(shouldShow(info({ latest: null }), null)).toBe(false)
    expect(shouldShow(info({ url: null }), null)).toBe(false)
    expect(shouldShow(info({ url: 'javascript:alert(1)' }), null)).toBe(false)
  })
  it('oculta la version descartada y avisa de la siguiente', () => {
    expect(shouldShow(info(), '0.5.0')).toBe(false)
    expect(shouldShow(info(), 'v0.5.0')).toBe(false)
    expect(shouldShow(info({ latest: '0.6.0' }), '0.5.0')).toBe(true)
  })
})

describe('texto y version', () => {
  it('normaliza la v inicial', () => {
    expect(normVersion('v0.5.0')).toBe('0.5.0')
    expect(normVersion(null)).toBe('')
  })
  it('arma el texto del globo', () => {
    expect(balloonText({ latest: '0.5.0' })).toBe('Hay una versión nueva (v0.5.0) con cambios nuevos.')
    expect(balloonText({ latest: 'v0.5.0' })).toBe('Hay una versión nueva (v0.5.0) con cambios nuevos.')
  })
})

describe('localStorage', () => {
  it('guarda y lee la version descartada', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    })
    expect(loadDismissed()).toBeNull()
    expect(saveDismissed('0.5.0')).toBe(true)
    expect(loadDismissed()).toBe('0.5.0')
  })
  it('un almacenamiento que falla no lanza', () => {
    const boom = () => {
      throw new Error('bloqueado')
    }
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom })
    expect(loadDismissed()).toBeNull()
    expect(saveDismissed('0.5.0')).toBe(false)
  })
})
