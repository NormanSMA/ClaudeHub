import { describe, expect, it } from 'vitest'
import { codexBusy, exhaustText, levelClass, levelFrom, levelText, pickMascotState, type MascotInput } from '../src/web/mascotState'

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
})
