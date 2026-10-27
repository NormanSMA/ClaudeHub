import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { msText } from '../src/web/format'
import { OmniBadge, viaDetail } from '../src/web/components/OmniBadge'
import { OmniLogo } from '../src/web/components/OmniLogo'
import type { ModelVia } from '../src/web/api'

// Datos sinteticos
const via = (over: Partial<ModelVia> = {}): ModelVia => ({
  calls: 20,
  ok: 18,
  successRate: 0.9,
  e429: 0,
  e403: 0,
  e5xx: 0,
  p95Ms: 5100,
  tokens: 5575,
  providers: ['prov-a', 'prov-b'],
  ...over,
})

describe('msText', () => {
  it('formatea milisegundos y segundos, y el guion si no hay dato', () => {
    expect(msText(850)).toBe('850 ms')
    expect(msText(4200)).toBe('4,2 s')
    expect(msText(null)).toBe('-')
  })
})

describe('viaDetail', () => {
  it('resume llamadas, exito, p95, tokens y proveedores', () => {
    expect(viaDetail(via())).toBe('Via OmniRoute: 20 llamadas, 90.0% de exito, p95 5,1 s, 5.58k tokens. Proveedores: prov-a, prov-b.')
  })

  it('lista solo los errores que ocurrieron', () => {
    const text = viaDetail(via({ e429: 12, e5xx: 1 }))
    expect(text).toContain('Errores: 12 con 429, 1 con 5xx.')
    expect(text).not.toContain('403')
  })
})

describe('OmniBadge', () => {
  it('muestra solo el logo y lleva el detalle en title y aria-label', () => {
    const html = renderToStaticMarkup(createElement(OmniBadge, { via: via() }))
    expect(html).toContain('role="img"')
    expect(html).toContain(`aria-label="${viaDetail(via())}"`)
    expect(html).toContain(`title="${viaDetail(via())}"`)
    expect(html).toContain('<svg')
    expect(html).not.toContain('>OmniRoute<')
  })
})

describe('OmniLogo', () => {
  it('dibuja el glifo con el degradado de OmniRoute y se oculta a los lectores de pantalla', () => {
    const html = renderToStaticMarkup(createElement(OmniLogo, { size: 20 }))
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('width="20"')
    expect(html).toContain('#E54D5E')
    expect(html).toContain('#C93D4E')
  })

  it('cada instancia usa su propio id de degradado', () => {
    const html = renderToStaticMarkup(createElement('div', null, createElement(OmniLogo), createElement(OmniLogo)))
    const ids = [...html.matchAll(/<linearGradient id="([^"]+)"/g)].map((m) => m[1])
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })
})
