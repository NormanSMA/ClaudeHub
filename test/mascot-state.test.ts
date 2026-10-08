import { describe, expect, it } from 'vitest'
import { codexBusy, pickMascotState, type MascotInput } from '../src/web/mascotState'

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
