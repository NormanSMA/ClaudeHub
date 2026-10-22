import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ManualCheck, UpdateInfo } from '../src/web/api'
import { balloonText, checkState, loadDismissed, normVersion, saveDismissed, shouldShow } from '../src/web/update'

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

describe('checkState', () => {
  const result = (value: ManualCheck['result'], over: Partial<UpdateInfo> = {}): ManualCheck => ({
    result: value,
    info: info(over),
  })

  it('espera antes de la comprobación manual', () => {
    expect(checkState(null, false, false)).toBe('idle')
  })
  it('prioriza la comprobación en curso sobre errores y resultados anteriores', () => {
    expect(checkState(null, true, false)).toBe('checking')
    expect(checkState(result('checked'), true, true)).toBe('checking')
  })
  it('indica que la versión está actualizada', () => {
    expect(checkState(result('checked', { available: false }), false, false)).toBe('up-to-date')
  })
  it('indica una actualización disponible', () => {
    expect(checkState(result('checked'), false, false)).toBe('update-available')
  })
  it('indica errores del servidor y de red', () => {
    expect(checkState(result('failed'), false, false)).toBe('error')
    expect(checkState(null, false, true)).toBe('error')
    expect(checkState(result('checked'), false, true)).toBe('error')
  })
  it('indica que la búsqueda está desactivada aunque exista una versión guardada', () => {
    expect(checkState(result('disabled', { enabled: false }), false, false)).toBe('disabled')
  })
  it('indica la espera aunque exista una actualización guardada', () => {
    expect(checkState({ ...result('throttled'), retryInMs: 30_000 }, false, false)).toBe('throttled')
  })
})

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
