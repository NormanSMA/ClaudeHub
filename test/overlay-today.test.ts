import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TodayCount, todayText } from '../src/web/TodayCount'

const real = { todayTokens: 45_150_893, todayFresh: 1_049_557, todayCacheRead: 44_101_336 }

describe('contador de hoy', () => {
  it('muestra nuevos arriba y lectura de cache debajo', () => {
    const t = todayText(real)
    expect(t.main).toBe('Hoy 1.05M nuevos')
    expect(t.cache).toBe('44.1M caché')
    expect(t.title).toContain('Total: 45,150,893')
  })

  it('sin los campos nuevos cae al total', () => {
    expect(todayText({ todayTokens: 11_400_000 })).toMatchObject({ main: 'Hoy 11.4M', cache: null })
  })

  it('renderiza los dos renglones y el desglose en title', () => {
    const html = renderToStaticMarkup(createElement(TodayCount, { data: real }))
    expect(html).toContain('<span>Hoy 1.05M nuevos</span><small>44.1M caché</small>')
    expect(html).toContain('Lectura de caché: 44,101,336')
  })

  it('sin datos no muestra texto', () => {
    expect(renderToStaticMarkup(createElement(TodayCount, { data: null }))).toBe('<span class="today-count "></span>')
  })

  it('agrega el costo aproximado junto a los tokens nuevos', () => {
    const data = { ...real, todayCostUsd: 3.85 }
    expect(todayText(data).main).toBe('Hoy 1.05M nuevos · ~$3.85')
    const html = renderToStaticMarkup(createElement(TodayCount, { data }))
    expect(html).toContain('<span>Hoy 1.05M nuevos · ~$3.85</span><small>44.1M caché</small>')
  })

  it('muestra un costo cero y conserva el respaldo al total', () => {
    expect(todayText({ ...real, todayCostUsd: 0 }).main).toBe('Hoy 1.05M nuevos · ~$0.00')
    expect(todayText({ todayTokens: 11_400_000, todayCostUsd: 0.001 }).main).toBe('Hoy 11.4M · ~<$0.01')
  })
})
