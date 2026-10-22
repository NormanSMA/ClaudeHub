import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptySpeechMemory, loadSpeechMemory, pickLine, saveSpeechMemory, type SpeechInput } from '../src/web/mascotSpeech'

const NOW = new Date(2026, 9, 22, 12).getTime()
const COOLDOWN = 10 * 60_000
const input = (extra: Partial<SpeechInput> = {}): SpeechInput => ({
  mascot: { talk: true, talkCooldownMin: 10 }, chats: [], ...extra,
})
const chat = (session = 'chat-1', pct = 0.85) => ({ session, title: 'Mi chat', context: { pct } })
const level = (n: number) => ({ level: n, label: n === 5 ? 'Límite' : 'Crítico' })

afterEach(() => vi.unstubAllGlobals())

describe('diálogos de Chispa', () => {
  it('avisa al alcanzar el 85 % con el título y porcentaje', () => {
    expect(pickLine(input({ chats: [chat('a', 0.849)] }), emptySpeechMemory(), NOW).line).toBeNull()
    expect(pickLine(input({ chats: [chat()] }), emptySpeechMemory(), NOW).line).toEqual({
      id: 'context:chat-1', text: '"Mi chat" va al 85 % de contexto. Un /compact le daría aire.',
    })
  })

  it('avisa una vez por chat aunque baje y vuelva a subir', () => {
    const first = pickLine(input({ chats: [chat()] }), emptySpeechMemory(), NOW)
    const low = pickLine(input({ chats: [chat('chat-1', 0.3)] }), first.memory, NOW + COOLDOWN)
    const high = pickLine(input({ chats: [chat()] }), low.memory, NOW + 2 * COOLDOWN)
    expect(high.line).toBeNull()
    expect(pickLine(input({ chats: [chat('otro')] }), high.memory, NOW + 2 * COOLDOWN).line?.id).toBe('context:otro')
  })

  it('avisa una vez por subida a N4 y N5', () => {
    const low = pickLine(input({ level: level(3) }), emptySpeechMemory(), NOW)
    expect(low.line).toBeNull()
    const four = pickLine(input({ level: level(4) }), low.memory, NOW)
    expect(four.line?.text).toBe('Subimos a N4: Crítico. Toca bajar el ritmo.')
    const same = pickLine(input({ level: level(4) }), four.memory, NOW + COOLDOWN)
    expect(same.line).toBeNull()
    const five = pickLine(input({ level: level(5) }), same.memory, NOW + COOLDOWN)
    expect(five.line?.text).toBe('Subimos a N5: Límite. Toca bajar el ritmo.')
    const down = pickLine(input({ level: level(3) }), five.memory, NOW + 2 * COOLDOWN)
    expect(down.line).toBeNull()
    expect(pickLine(input({ level: level(4) }), down.memory, NOW + 2 * COOLDOWN).line).not.toBeNull()
  })

  it('toma una referencia de OmniRoute y anuncia solamente fallos nuevos', () => {
    const base = pickLine(input({ omniFailures: 20 }), emptySpeechMemory(), NOW)
    expect(base.line).toBeNull()
    const more = pickLine(input({ omniFailures: 23 }), base.memory, NOW)
    expect(more.line?.text).toBe('OmniRoute sumó 3 fallos nuevos. Revisa Modelos.')
    const same = pickLine(input({ omniFailures: 23 }), more.memory, NOW + COOLDOWN)
    expect(same.line).toBeNull()
    const less = pickLine(input({ omniFailures: 10 }), same.memory, NOW + COOLDOWN)
    expect(less.line).toBeNull()
    expect(pickLine(input({ omniFailures: 11 }), less.memory, NOW + COOLDOWN).line?.text).toContain('1 fallos nuevos')
  })

  it('saluda una vez por día local cuando existen datos', () => {
    const empty = pickLine(input({ todayFresh: 0 }), emptySpeechMemory(), NOW)
    expect(empty.line).toBeNull()
    const data = input({ todayFresh: 1200, todayCostUsd: 1.25 })
    const first = pickLine(data, empty.memory, NOW)
    expect(first.line?.text).toBe('Hoy llevamos 1.20k tokens nuevos y ~$1.25 de valor API.')
    expect(pickLine(data, first.memory, NOW + COOLDOWN).line).toBeNull()
    expect(pickLine(data, first.memory, new Date(2026, 9, 23, 0, 1).getTime()).line).not.toBeNull()
  })

  it('cambia de día a medianoche local', () => {
    const late = new Date(2026, 9, 22, 23, 50).getTime()
    const first = pickLine(input({ todayFresh: 1 }), emptySpeechMemory(), late)
    expect(first.memory.greetedDay).toBe('2026-10-22')
    const next = pickLine(input({ todayFresh: 1 }), first.memory, new Date(2026, 9, 23, 0, 0).getTime())
    expect(next.line?.id).toBe('day:2026-10-23')
  })

  it('prioriza contexto, nivel, fallos y resumen diario sin perder avisos', () => {
    const base = pickLine(input({ omniFailures: 0, level: level(3) }), emptySpeechMemory(), NOW).memory
    const all = input({ chats: [chat()], level: level(4), omniFailures: 2, todayFresh: 100 })
    const context = pickLine(all, base, NOW)
    expect(context.line?.id).toBe('context:chat-1')
    const high = pickLine(all, context.memory, NOW + COOLDOWN)
    expect(high.line?.id).toContain('level:4:')
    const failures = pickLine(all, high.memory, NOW + 2 * COOLDOWN)
    expect(failures.line?.text).toContain('2 fallos nuevos')
    const daily = pickLine(all, failures.memory, NOW + 3 * COOLDOWN)
    expect(daily.line?.id).toBe('day:2026-10-22')
  })

  it('el primer nivel observado no cuenta como subida', () => {
    const first = pickLine(input({ level: level(4) }), emptySpeechMemory(), NOW)
    expect(first.line).toBeNull()
    expect(first.memory.lastLevel).toBe(4)
  })

  it('respeta el cooldown global y su límite exacto', () => {
    const first = pickLine(input({ todayFresh: 1 }), emptySpeechMemory(), NOW)
    const data = input({ chats: [chat()], mascot: { talk: true, talkCooldownMin: 1 } })
    const waiting = pickLine(data, first.memory, NOW + 59_999)
    expect(waiting.line).toBeNull()
    expect(waiting.memory.warnedChats).toEqual([])
    expect(pickLine(data, waiting.memory, NOW + 60_000).line?.id).toBe('context:chat-1')
  })

  it('observa subidas durante el cooldown y descarta niveles que ya bajaron', () => {
    const first = pickLine(input({ todayFresh: 1, level: level(3) }), emptySpeechMemory(), NOW)
    const high = pickLine(input({ level: level(4) }), first.memory, NOW + 1)
    expect(high.line).toBeNull()
    expect(pickLine(input({ level: level(4) }), high.memory, NOW + COOLDOWN).line?.text).toContain('N4')
    const down = pickLine(input({ level: level(3) }), high.memory, NOW + 2)
    expect(pickLine(input({ level: level(3) }), down.memory, NOW + COOLDOWN).line).toBeNull()
  })

  it('acumula fallos durante el cooldown y descarta avisos al apagar OmniRoute', () => {
    const first = pickLine(input({ todayFresh: 1, omniFailures: 10 }), emptySpeechMemory(), NOW)
    const waiting = pickLine(input({ omniFailures: 12 }), first.memory, NOW + 1)
    const more = pickLine(input({ omniFailures: 15 }), waiting.memory, NOW + COOLDOWN)
    expect(more.line?.text).toContain('5 fallos nuevos')
    const off = pickLine(input({ omniFailures: null }), waiting.memory, NOW + COOLDOWN)
    expect(off.line).toBeNull()
    expect(pickLine(input({ omniFailures: 20 }), off.memory, NOW + COOLDOWN).line).toBeNull()
  })

  it('no habla silenciada ni modifica la memoria recibida', () => {
    const memory = emptySpeechMemory()
    const snapshot = structuredClone(memory)
    const muted = input({ mascot: { talk: false, talkCooldownMin: 10 }, chats: [chat()], level: level(5), todayFresh: 2, omniFailures: 5 })
    expect(pickLine(muted, memory, NOW)).toEqual({ line: null, memory: snapshot })
    pickLine(input({ chats: [chat()] }), memory, NOW)
    expect(memory).toEqual(snapshot)
  })

  it('conserva la referencia de OmniRoute mientras espera una lectura', () => {
    const first = pickLine(input({ omniFailures: 5 }), emptySpeechMemory(), NOW)
    const loading = pickLine(input(), first.memory, NOW + 1)
    expect(loading.memory.omniFailures).toBe(5)
    expect(pickLine(input({ omniFailures: 7 }), loading.memory, NOW + 2).line?.text).toContain('2 fallos nuevos')
  })
})

describe('memoria de diálogos', () => {
  it('persiste usando la clave mascot-speech y conserva avisos entre cargas', () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    })
    const first = pickLine(input({ chats: [chat()] }), loadSpeechMemory(), NOW)
    saveSpeechMemory(first.memory)
    expect(storage.has('mascot-speech')).toBe(true)
    expect(loadSpeechMemory()).toEqual(first.memory)
    expect(pickLine(input({ chats: [chat()] }), loadSpeechMemory(), NOW + COOLDOWN).line).toBeNull()
  })

  it.each(['{', 'null', '{"warnedChats":3}', '{"lastLevel":99}'])('descarta memoria inválida: %s', (value) => {
    vi.stubGlobal('localStorage', { getItem: () => value })
    expect(loadSpeechMemory()).toEqual(emptySpeechMemory())
  })

  it.each([undefined, {
    getItem: () => { throw new Error('bloqueado') },
    setItem: () => { throw new Error('cuota') },
  }])('funciona en memoria sin almacenamiento: %s', (storage) => {
    vi.stubGlobal('localStorage', storage)
    const first = pickLine(input({ todayFresh: 1 }), loadSpeechMemory(), NOW)
    expect(first.line).not.toBeNull()
    expect(() => saveSpeechMemory(first.memory)).not.toThrow()
    expect(pickLine(input({ todayFresh: 1 }), first.memory, NOW + COOLDOWN).line).toBeNull()
    expect(pickLine(input({ chats: [chat()] }), first.memory, NOW + COOLDOWN).line).not.toBeNull()
  })
})
