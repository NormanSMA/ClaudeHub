import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ResumenView } from '../src/web/views/Resumen'
import { ModelosView } from '../src/web/views/Modelos'
import { useApi, type Summary } from '../src/web/api'
import { compact, fmtUsd, int } from '../src/web/format'

vi.mock('../src/web/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/web/api')>(),
  useApi: vi.fn(),
}))

// Datos de /api/summary?range=7d en modo demo, capturados el 22 de octubre de 2026.
const demoSummary: Summary = {
  sessions: 11,
  messages: 1659,
  tokens: {
    input: 978987,
    cacheWrite: 3812212,
    cacheRead: 117387333,
    output: 1954394,
    reasoning: 0,
    total: 124132926,
    fresh: 6745593,
    costUsd: 80.36174094999994,
    costUnpriced: 2563042,
    cacheSavingsUsd: 358.22524505000064,
    freeSavingsUsd: 0,
  },
  activeDays: 7,
  peakHour: 9,
  favoriteModel: 'Opus 5',
  heatmap: [
    { day: '2026-10-16', tokens: 17773231 },
    { day: '2026-10-17', tokens: 22616180 },
    { day: '2026-10-18', tokens: 20467022 },
    { day: '2026-10-19', tokens: 17553984 },
    { day: '2026-10-20', tokens: 13440718 },
    { day: '2026-10-21', tokens: 9743423 },
    { day: '2026-10-22', tokens: 22538368 },
  ],
}

function renderSummary(summary = demoSummary, billing: 'subscription' | 'api' = 'subscription') {
  vi.mocked(useApi).mockImplementation((path) => ({
    data: path?.startsWith('/api/summary?') ? summary : null,
    error: null,
  }) as ReturnType<typeof useApi>)
  return renderToStaticMarkup(createElement(ResumenView, {
    q: 'range=7d', qClaude: 'range=7d', billing,
  }))
}

describe('Jerarquía del dashboard', () => {
  beforeEach(() => vi.mocked(useApi).mockReset())

  it('renderiza tres tarjetas principales, tres secundarias y después el heatmap', () => {
    const html = renderSummary()
    const sections = [...html.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/g)]
    expect(sections).toHaveLength(2)
    expect(sections[0][0]).toContain('aria-label="Métricas principales"')
    expect(sections[1][0]).toContain('aria-label="Métricas secundarias"')
    for (const section of sections) {
      expect(section[1].match(/class="stat"/g)).toHaveLength(3)
    }
    for (const label of ['Valor API del rango', 'Tokens nuevos frente a lectura de caché', 'Sesiones y mensajes']) {
      expect(sections[0][1]).toContain(label)
    }
    for (const label of ['Días activos', 'Hora pico', 'Modelo favorito']) {
      expect(sections[1][1]).toContain(label)
    }
    expect(html.indexOf('class="heatmap"')).toBeGreaterThan(html.indexOf(sections[1][0]))
  })

  it('conserva costo, ahorro, tokens, sesiones, mensajes y desgloses del demo', () => {
    const html = renderSummary()
    for (const value of [
      fmtUsd(demoSummary.tokens.costUsd!),
      `Ahorro por caché ${fmtUsd(demoSummary.tokens.cacheSavingsUsd!)}`,
      `${compact(demoSummary.tokens.costUnpriced!)} tokens sin precio`,
      compact(demoSummary.tokens.fresh!),
      compact(demoSummary.tokens.cacheRead),
      `${compact(demoSummary.tokens.total)} tokens totales`,
      `${int(demoSummary.sessions)} sesiones`,
      `${int(demoSummary.messages)} mensajes`,
      'Eficiencia de cache',
      'Salida visible',
    ]) expect(html).toContain(value)
  })

  it('muestra el modelo favorito con su nombre visible', () => {
    const html = renderSummary({ ...demoSummary, favoriteModel: 'Opus 4.1' })
    expect(html).toContain('>Opus 4.1</div>')
  })

  it('conserva la etiqueta de costo cuando la facturación usa API', () => {
    expect(renderSummary(demoSummary, 'api')).toContain('Costo del rango')
  })

  it('calcula tokens nuevos cuando falta fresh y admite rangos vacíos', () => {
    const { fresh: _fresh, ...tokens } = demoSummary.tokens
    expect(renderSummary({ ...demoSummary, tokens })).toContain(compact(demoSummary.tokens.fresh!))
    const html = renderSummary({
      sessions: 0, messages: 0, activeDays: 0, peakHour: null, favoriteModel: null, heatmap: [],
      tokens: { input: 0, cacheWrite: 0, cacheRead: 0, output: 0, total: 0 },
    })
    expect(html).toContain('0 sesiones')
    expect(html).toContain('0 mensajes')
    expect(html).not.toMatch(/NaN|Infinity/)
  })

  it('Modelos muestra el nombre visible y los ids tecnicos en title', () => {
    vi.mocked(useApi).mockReturnValue({
      data: {
        daily: [],
        models: [{
          model: 'Opus 4.1', ids: ['claude-opus-4-1', 'claude-opus-4-1-20250805'],
          input: 1, output: 1, cacheRead: 0, cacheWrite: 0, total: 2, share: 1,
        }],
      },
      error: null,
    })
    const html = renderToStaticMarkup(createElement(ModelosView, { q: 'range=7d' }))
    expect(html).toContain('title="claude-opus-4-1, claude-opus-4-1-20250805">Opus 4.1')
  })
})
