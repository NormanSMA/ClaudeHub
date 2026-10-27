import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ActiveList } from '../src/web/components/Active'
import type { ActiveChat, AgentLive } from '../src/web/api'

const chat: ActiveChat & { cacheReadPerM?: number | null } = {
  session: 'sesion-popup',
  title: 'Chat de prueba',
  project: 'ClaudeHub',
  cwd: null,
  model: 'Sonnet 4.6',
  lastTs: Date.now(),
  working: false,
  context: { used: 160_000, limit: 200_000, estimated: false, source: 'config', pct: 0.8 },
  tokens: { orchestrator: 160_000, subagents: 0, total: 160_000 },
  activeSubagents: 0,
  cacheReadPerM: 0.3,
}

const agent: AgentLive = {
  source: 'claude',
  session: chat.session,
  project: chat.project,
  state: 'waiting',
  since: chat.lastTs,
  tool: null,
  stuck: false,
}

const render = (changes: Partial<typeof chat> = {}, agents: AgentLive[] = [], dense = true) =>
  renderToStaticMarkup(createElement(ActiveList, { chats: [{ ...chat, ...changes }], agents, dense }))

describe('Popup de chats activos', () => {
  it('muestra la acción y el costo al alcanzar 80 %', () => {
    const html = render()
    expect(html).toContain('Copiar /compact</button>')
    expect(html).toContain('~$0.05 por turno')
  })

  it('oculta la acción y el costo con 79 %', () => {
    const html = render({ context: { ...chat.context, used: 158_000, pct: 0.79 } })
    expect(html).not.toContain('Copiar /compact')
    expect(html).not.toContain('por turno')
  })

  it('mantiene la acción por encima de 80 %', () => {
    expect(render({ context: { ...chat.context, used: 180_000, pct: 0.9 } })).toContain('Copiar /compact')
  })

  it.each([null, undefined])('omite el costo sin tarifa: %s', (cacheReadPerM) => {
    const html = render({ cacheReadPerM })
    expect(html).toContain('Copiar /compact')
    expect(html).not.toContain('por turno')
  })

  it('muestra costo cero con tarifa cero', () => {
    expect(render({ cacheReadPerM: 0 })).toContain('~$0.00 por turno')
  })

  it('muestra el punto activo al trabajar', () => {
    expect(render({ working: true })).toContain('class="live-dot on" title="Trabajando ahora"')
  })

  it.each([false, true])('muestra espera en la misma sesión con working=%s', (working) => {
    expect(render({ working }, [agent])).toContain('class="live-dot waiting" title="Esperando permiso o respuesta"')
  })

  it('muestra pausa sin actividad', () => {
    expect(render()).toContain('class="live-dot paused" title="En pausa"')
  })

  it('ignora la espera de otra sesión', () => {
    expect(render({}, [{ ...agent, session: 'otra-sesion' }])).toContain('class="live-dot paused"')
  })

  it('ignora otros estados del agente', () => {
    expect(render({ working: true }, [{ ...agent, state: 'done' }])).toContain('class="live-dot on"')
  })

  it('conserva el render del dashboard', () => {
    expect(render({}, [], false)).toContain('Copiar /compact')
  })
})
