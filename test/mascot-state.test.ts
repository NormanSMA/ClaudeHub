import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GeminiBadge, GRIDS, Mascot } from '../src/web/mascot/Mascot'
import {
  codexBusy,
  exhaustText,
  familyOfModel,
  geminiBusy,
  levelClass,
  levelFrom,
  levelText,
  pickMascotFamily,
  pickMascotState,
  type MascotInput,
} from '../src/web/mascot/mascotState'

const chat = (pct: number, working = false) => ({ working, context: { pct } })
const claude = { source: 'claude', state: 'tool' }

describe('pickMascotState', () => {
  it('servidor viejo sin mascot conserva la regla antigua', () => {
    expect(pickMascotState(null)).toBe('sleeping')
    expect(pickMascotState({ chats: [] })).toBe('sleeping')
    expect(pickMascotState({ chats: [chat(0.2)] })).toBe('happy')
    expect(pickMascotState({ chats: [chat(0.2, true)] })).toBe('working')
    expect(pickMascotState({ chats: [chat(0.9, true)], alertAt: 0.85 })).toBe('alert')
    expect(pickMascotState({ chats: [chat(0.1)], plan: { fiveHour: { pct: 90 } } })).toBe('alert')
    expect(pickMascotState({ chats: [chat(0.1)], plan: { blocked: {} } })).toBe('alert')
  })

  it('agents vacio ignora mascot', () => {
    expect(pickMascotState({ chats: [], mascot: 'tool', agents: [] })).toBe('sleeping')
    expect(pickMascotState({ chats: [chat(0.2)], mascot: 'waiting', agents: [] })).toBe('happy')
  })

  it('waiting y error ganan a la alerta de contexto', () => {
    const base: MascotInput = { chats: [chat(0.99)], alertAt: 0.85, agents: [claude] }
    expect(pickMascotState({ ...base, mascot: 'waiting' })).toBe('waiting')
    expect(pickMascotState({ ...base, mascot: 'error' })).toBe('error')
  })

  it('alerta de contexto gana a tool y thinking', () => {
    const base: MascotInput = { chats: [chat(0.9)], alertAt: 0.85, agents: [claude] }
    expect(pickMascotState({ ...base, mascot: 'tool' })).toBe('alert')
    expect(pickMascotState({ ...base, mascot: 'thinking' })).toBe('alert')
  })

  it('sin alerta usa el estado por hooks', () => {
    const base: MascotInput = { chats: [chat(0.2)], agents: [claude] }
    expect(pickMascotState({ ...base, mascot: 'tool' })).toBe('tool')
    expect(pickMascotState({ ...base, mascot: 'thinking' })).toBe('thinking')
    expect(pickMascotState({ ...base, mascot: 'happy' })).toBe('happy')
    expect(pickMascotState({ chats: [], mascot: 'tool', agents: [{ source: 'codex', state: 'tool' }] })).toBe('tool')
    expect(pickMascotState({ chats: [{ working: true, context: { pct: 0.2 } }], mascot: 'sleeping', agents: [claude] })).toBe('working')
  })
})

describe('nivel de la mascota', () => {
  const lv = { level: 3, label: 'Ritmo Alto', pct: 51.2, minutesLeft: 12.4, exhaustsBeforeReset: true }

  it('levelFrom acepta niveles de 1 a 5 y descarta el resto', () => {
    expect(levelFrom({ level: lv })).toBe(lv)
    for (const bad of [null, undefined, { ...lv, level: 0 }, { ...lv, level: 6 }, { ...lv, level: 2.5 }, { ...lv, pct: NaN }]) {
      expect(levelFrom({ level: bad })).toBeNull()
    }
    expect(levelFrom({})).toBeNull()
    expect(levelFrom(null)).toBeNull()
  })

  it('levelClass da una clase por nivel o nada', () => {
    for (const n of [1, 2, 3, 4, 5]) expect(levelClass({ ...lv, level: n })).toBe(`mascot-lv${n}`)
    expect(levelClass(null)).toBe('')
  })

  it('levelText redondea el porcentaje', () => {
    expect(levelText(lv)).toBe('N3 · 51%')
    expect(levelText({ ...lv, level: 5, pct: 100 })).toBe('N5 · 100%')
  })

  it('exhaustText solo aparece si se agota antes del reinicio', () => {
    expect(exhaustText(lv)).toBe('Se agota en ~12 min')
    expect(exhaustText({ ...lv, minutesLeft: 0.2 })).toBe('Se agota en ~1 min')
    expect(exhaustText({ ...lv, exhaustsBeforeReset: false })).toBeNull()
    expect(exhaustText({ ...lv, exhaustsBeforeReset: null })).toBeNull()
    expect(exhaustText({ ...lv, minutesLeft: null })).toBeNull()
    expect(exhaustText(null)).toBeNull()
  })
})

describe('codexBusy', () => {
  it('detecta Codex activo', () => {
    for (const state of ['starting', 'thinking', 'tool', 'waiting']) {
      expect(codexBusy({ agents: [{ source: 'codex', state }] })).toBe(true)
    }
  })
  it('ignora Codex inactivo, otras fuentes y datos ausentes', () => {
    expect(codexBusy({ agents: [{ source: 'codex', state: 'idle' }] })).toBe(false)
    expect(codexBusy({ agents: [{ source: 'codex', state: 'done' }] })).toBe(false)
    expect(codexBusy({ agents: [{ source: 'claude', state: 'tool' }] })).toBe(false)
    expect(codexBusy({})).toBe(false)
    expect(codexBusy(null)).toBe(false)
  })
  it('detecta chats activos de Codex o modelos GPT trabajando', () => {
    expect(codexBusy({ chats: [{ working: true, context: { pct: 0.2 }, source: 'codex' }] })).toBe(true)
    expect(codexBusy({ chats: [{ working: true, context: { pct: 0.2 }, model: 'GPT-5.4' }] })).toBe(true)
    expect(codexBusy({ chats: [{ working: false, context: { pct: 0.2 }, source: 'codex' }] })).toBe(false)
  })
})

describe('familias de mascota (Claude, Codex, Gemini)', () => {
  it('familyOfModel clasifica modelos y fuentes correctamente', () => {
    expect(familyOfModel('Sonnet 4.6')).toBe('claude')
    expect(familyOfModel('Opus 4.7', 'claude')).toBe('claude')
    expect(familyOfModel('Claude Sonnet 4.6', 'antigravity')).toBe('claude')
    expect(familyOfModel('Fable 5.2', 'antigravity')).toBe('claude')
    expect(familyOfModel('Mythos 5.1', 'antigravity')).toBe('claude')
    expect(familyOfModel('gpt-5.4')).toBe('codex')
    expect(familyOfModel('o3-mini')).toBe('codex')
    expect(familyOfModel('codex-mini')).toBe('codex')
    expect(familyOfModel('Sonnet', 'codex')).toBe('codex')
    expect(familyOfModel('Gemini 2.5 Pro')).toBe('gemini')
    expect(familyOfModel('argon-v1', 'antigravity')).toBe('gemini')
    expect(familyOfModel(undefined, 'antigravity')).toBe('gemini')
    expect(familyOfModel(undefined, 'gemini')).toBe('gemini')
    expect(familyOfModel()).toBe('claude')
  })

  it('pickMascotFamily prioriza chat trabajando, luego codexBusy y luego primer chat', () => {
    expect(pickMascotFamily(null)).toBe('claude')
    expect(pickMascotFamily({ chats: [] })).toBe('claude')
    expect(pickMascotFamily({
      chats: [
        { working: false, context: { pct: 0.2 }, model: 'Sonnet 4.6', source: 'claude' },
        { working: true, context: { pct: 0.3 }, model: 'Gemini 2.5 Pro', source: 'antigravity' },
      ],
    })).toBe('gemini')
    expect(pickMascotFamily({
      chats: [{ working: false, context: { pct: 0.2 }, model: 'Sonnet 4.6' }],
      agents: [{ source: 'codex', state: 'tool' }],
    })).toBe('codex')
    expect(pickMascotFamily({
      chats: [{ working: false, context: { pct: 0.2 }, model: 'GPT-5.4', source: 'codex' }],
      agents: [{ source: 'claude', state: 'tool' }],
    })).toBe('claude')
    expect(pickMascotFamily({
      chats: [{ working: false, context: { pct: 0.2 }, model: 'GPT-5.4', source: 'codex' }],
    })).toBe('codex')
  })

  it('geminiBusy detecta chats de Gemini trabajando', () => {
    expect(geminiBusy(null)).toBe(false)
    expect(geminiBusy({ chats: [{ working: false, context: { pct: 0.1 }, model: 'Gemini 2.5 Pro' }] })).toBe(false)
    expect(geminiBusy({ chats: [{ working: true, context: { pct: 0.1 }, model: 'Gemini 2.5 Pro' }] })).toBe(true)
    expect(geminiBusy({ chats: [{ working: true, context: { pct: 0.1 }, source: 'antigravity', model: 'Gemini 2.5' }] })).toBe(true)
  })

  it('renderiza Mascot por familia y GeminiBadge con cuadriculas 14x12', () => {
    for (const fam of ['claude', 'codex', 'gemini'] as const) {
      expect(GRIDS[fam]).toHaveLength(12)
      for (const row of GRIDS[fam]) expect(row).toHaveLength(14)
    }
    const codexHtml = renderToStaticMarkup(createElement(Mascot, { family: 'codex', state: 'working' }))
    expect(codexHtml).toContain('mascot-family-codex')
    expect(codexHtml).toContain('aria-label="Codex está trabajando"')

    const geminiHtml = renderToStaticMarkup(createElement(Mascot, { family: 'gemini', state: 'thinking' }))
    expect(geminiHtml).toContain('mascot-family-gemini')
    expect(geminiHtml).toContain('aria-label="Gemini está pensando"')

    const badgeHtml = renderToStaticMarkup(createElement(GeminiBadge))
    expect(badgeHtml).toContain('gemini-badge')
    expect(badgeHtml).toContain('aria-label="Gemini trabajando"')
  })
})
