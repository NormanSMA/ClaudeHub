import type { MascotConfig } from './api'
import { compact, fmtUsd } from './format'

export interface SpeechInput {
  mascot: MascotConfig
  chats: { session: string; title: string; context: { pct: number } }[]
  level?: { level: number; label: string } | null
  todayFresh?: number
  todayCostUsd?: number
  /** null si OmniRoute está apagada; ausente mientras todavía no respondió. */
  omniFailures?: number | null
}

export interface SpeechLine {
  id: string
  text: string
}

export interface SpeechMemory {
  lastSpokeAt: number | null
  warnedChats: string[]
  lastLevel: number
  pendingLevel: { level: number; label: string } | null
  omniFailures: number | null
  pendingFailures: number
  greetedDay: string | null
}

export function emptySpeechMemory(): SpeechMemory {
  return {
    lastSpokeAt: null, warnedChats: [], lastLevel: 0, pendingLevel: null,
    omniFailures: null, pendingFailures: 0, greetedDay: null,
  }
}

/** Evalúa datos sin modificar la entrada ni acceder al almacenamiento. */
export function pickLine(input: SpeechInput, memory: SpeechMemory, now: number): {
  line: SpeechLine | null; memory: SpeechMemory
} {
  if (!input.mascot.talk) return { line: null, memory }
  const next = { ...memory, warnedChats: [...memory.warnedChats] }
  const level = input.level
  if (level) {
    // con lastLevel 0 aun no se conoce el nivel previo: no es una subida
    if (level.level >= 4 && next.lastLevel > 0 && level.level > next.lastLevel) next.pendingLevel = { ...level }
    else if (level.level < next.lastLevel) next.pendingLevel = null
    next.lastLevel = level.level
  }
  if (typeof input.omniFailures === 'number') {
    if (next.omniFailures !== null) next.pendingFailures += Math.max(0, input.omniFailures - next.omniFailures)
    next.omniFailures = input.omniFailures
  } else if (input.omniFailures === null) {
    // Una fuente apagada no conserva avisos de fallos pendientes.
    next.omniFailures = null
    next.pendingFailures = 0
  }
  if (next.lastSpokeAt !== null && now - next.lastSpokeAt < input.mascot.talkCooldownMin * 60_000) {
    return { line: null, memory: next }
  }

  let line: SpeechLine | null = null
  const chat = input.chats.find((c) => c.context.pct >= 0.85 && !next.warnedChats.includes(c.session))
  const date = new Date(now)
  const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  if (chat) {
    line = { id: `context:${chat.session}`, text: `"${chat.title}" va al ${Math.round(chat.context.pct * 100)} % de contexto. Un /compact le daría aire.` }
    // solo los ultimos 50: la memoria vive en localStorage
    next.warnedChats = [...next.warnedChats, chat.session].slice(-50)
  } else if (next.pendingLevel) {
    const { level: n, label } = next.pendingLevel
    line = { id: `level:${n}:${now}`, text: `Subimos a N${n}: ${label}. Toca bajar el ritmo.` }
    next.pendingLevel = null
  } else if (next.pendingFailures > 0 && typeof input.omniFailures === 'number') {
    line = { id: `omniroute:${now}`, text: `OmniRoute sumó ${next.pendingFailures} fallos nuevos. Revisa Modelos.` }
    next.pendingFailures = 0
  } else if ((input.todayFresh ?? 0) > 0 && next.greetedDay !== day) {
    line = { id: `day:${day}`, text: `Hoy llevamos ${compact(input.todayFresh!)} tokens nuevos y ~${fmtUsd(input.todayCostUsd ?? 0)} de valor API.` }
    next.greetedDay = day
  }
  if (line) next.lastSpokeAt = now
  return { line, memory: next }
}

const STORAGE_KEY = 'mascot-speech'
const nonnegative = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0

export function loadSpeechMemory(): SpeechMemory {
  try {
    const m = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (m && (m.lastSpokeAt === null || nonnegative(m.lastSpokeAt)) &&
      Array.isArray(m.warnedChats) && m.warnedChats.every((s: unknown) => typeof s === 'string') &&
      Number.isInteger(m.lastLevel) && m.lastLevel >= 0 && m.lastLevel <= 5 &&
      (m.pendingLevel === null || (m.pendingLevel && Number.isInteger(m.pendingLevel.level) &&
        m.pendingLevel.level >= 4 && m.pendingLevel.level <= 5 && typeof m.pendingLevel.label === 'string')) &&
      (m.omniFailures === null || nonnegative(m.omniFailures)) && nonnegative(m.pendingFailures) &&
      (m.greetedDay === null || typeof m.greetedDay === 'string')) return m
  } catch {
    /* sin almacenamiento o memoria inválida */
  }
  return emptySpeechMemory()
}

export function saveSpeechMemory(memory: SpeechMemory): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory))
  } catch {
    /* la cabecera conserva la memoria durante esta sesión */
  }
}
