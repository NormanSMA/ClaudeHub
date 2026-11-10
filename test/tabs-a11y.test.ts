import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AnimatedTabs, nextTabIndex } from '../src/web/components/AnimatedTabs'
import { RangeGroup } from '../src/web/components/RangeGroup'

describe('navegación de pestañas', () => {
  it('avanza y retrocede con vuelta al extremo', () => {
    expect(nextTabIndex('ArrowRight', 0, 6)).toBe(1)
    expect(nextTabIndex('ArrowRight', 5, 6)).toBe(0)
    expect(nextTabIndex('ArrowLeft', 0, 6)).toBe(5)
    expect(nextTabIndex('ArrowLeft', 3, 6)).toBe(2)
  })

  it('Inicio y Fin saltan a los extremos', () => {
    expect(nextTabIndex('Home', 4, 6)).toBe(0)
    expect(nextTabIndex('End', 1, 6)).toBe(5)
  })

  it('ignora otras teclas y listas vacías', () => {
    expect(nextTabIndex('Tab', 1, 6)).toBeNull()
    expect(nextTabIndex('Enter', 1, 6)).toBeNull()
    expect(nextTabIndex('ArrowRight', 0, 0)).toBeNull()
  })
})

describe('marcado accesible', () => {
  const items = [{ id: 'a', label: 'Uno' }, { id: 'b', label: 'Dos' }, { id: 'c', label: 'Tres' }]

  it('las pestañas usan tablist, tab, aria-selected y tabIndex itinerante', () => {
    const html = renderToStaticMarkup(createElement(AnimatedTabs, { items, active: 'b', onSelect: vi.fn() }))
    expect(html).toContain('role="tablist"')
    expect(html.match(/role="tab"/g)).toHaveLength(3)
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1)
    expect(html.match(/tabindex="0"/g)).toHaveLength(1)
    expect(html.match(/tabindex="-1"/g)).toHaveLength(2)
    expect(html).toMatch(/id="tab-b"[^>]*aria-selected="true"/)
  })

  it('el rango es un grupo con aria-pressed', () => {
    const html = renderToStaticMarkup(createElement(RangeGroup, { range: '7d', onChange: vi.fn() }))
    expect(html).toContain('role="group"')
    expect(html).toContain('aria-label="Rango"')
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(3)
  })
})
