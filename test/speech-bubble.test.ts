import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Mascot } from '../src/web/mascot/Mascot'
import { SpeechBubble, typedText } from '../src/web/mascot/SpeechBubble'

afterEach(() => vi.unstubAllGlobals())

describe('typedText', () => {
  it('avanza una letra cada 30 ms', () => {
    expect(typedText('Hola', 0)).toBe('')
    expect(typedText('Hola', 29)).toBe('')
    expect(typedText('Hola', 30)).toBe('H')
    expect(typedText('Hola', 90)).toBe('Hol')
  })

  it('termina con el texto completo', () => {
    expect(typedText('Hola', 120)).toBe('Hola')
    expect(typedText('Hola', 6000)).toBe('Hola')
    expect(typedText('', 30)).toBe('')
    expect(typedText('Hola', -30)).toBe('')
  })

  it('conserva las letras fuera del plano básico', () => {
    expect(typedText('𐐀á', 30)).toBe('𐐀')
    expect(typedText('𐐀á', 60)).toBe('𐐀á')
  })
})

describe('SpeechBubble', () => {
  it('muestra el texto completo con movimiento reducido', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) })
    const html = renderToStaticMarkup(createElement(SpeechBubble, { text: 'Hola, soy Chispa', onDone: vi.fn() }))
    expect(html).toContain('<span aria-hidden="true">Hola, soy Chispa</span>')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('aria-atomic="true">Hola, soy Chispa</span>')
  })

  it('reserva el texto completo para lectores durante la escritura', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    const html = renderToStaticMarkup(createElement(SpeechBubble, { text: 'Hola', onDone: vi.fn() }))
    expect(html).toContain('<span aria-hidden="true"></span>')
    expect(html).toContain('aria-atomic="true">Hola</span>')
  })
})

describe('Mascot', () => {
  it('activa la clase de habla y conserva el estado', () => {
    const html = renderToStaticMarkup(createElement(Mascot, { state: 'thinking', talking: true }))
    expect(html).toContain('mascot-thinking mascot-working mascot-talking')
    expect(html).toContain('m-mouth-1')
    expect(html).toContain('m-mouth-2')
    expect(html).toContain('m-mouth-3')
  })

  it('conserva la mascota sin habla por defecto', () => {
    const html = renderToStaticMarkup(createElement(Mascot))
    expect(html).not.toContain('mascot-talking')
    expect(html).not.toContain('m-mouth')
  })
})
