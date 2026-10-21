export type MascotState = 'sleeping' | 'working' | 'happy' | 'alert' | 'tool' | 'thinking' | 'waiting' | 'error'

// Forma minima de /api/active que necesita la mascota. Los campos nuevos son opcionales: un servidor viejo no los envia.
export interface MascotInput {
  alertAt?: number
  chats?: { working: boolean; context: { pct: number } }[]
  plan?: { blocked?: unknown; fiveHour?: { pct: number } | null } | null
  mascot?: MascotState | null
  agents?: { source: string; state: string }[] | null
  level?: LevelInput | null
}

// Parte de TokenLevel (api.ts) que usa la interfaz de la mascota.
export interface LevelInput {
  level: number
  label?: string
  pct: number
  minutesLeft?: number | null
  exhaustsBeforeReset?: boolean | null
}

const CODEX_BUSY = new Set(['starting', 'thinking', 'tool', 'waiting'])

// Prioridad: waiting y error del hook > alerta de contexto o plan > estado por hooks > regla antigua.
export function pickMascotState(data: MascotInput | null | undefined): MascotState {
  const chats = data?.chats ?? []
  const alertAt = data?.alertAt ?? 0.85
  const worst = Math.max(
    chats.reduce((m, c) => Math.max(m, c.context.pct), 0),
    data?.plan?.blocked ? 1 : (data?.plan?.fiveHour?.pct ?? 0) / 100,
  )
  const hooked = data?.mascot != null && (data.agents?.length ?? 0) > 0
  if (hooked && (data!.mascot === 'waiting' || data!.mascot === 'error')) return data!.mascot!
  if ((chats.length > 0 || hooked) && worst >= alertAt) return 'alert'
  if (hooked) return data!.mascot!
  if (!chats.length) return 'sleeping'
  return chats.some((c) => c.working) ? 'working' : 'happy'
}

// Nivel valido (entero de 1 a 5) o null. Un servidor viejo no envia `level`.
export function levelFrom(data: MascotInput | null | undefined): LevelInput | null {
  const l = data?.level
  if (!l || !Number.isInteger(l.level) || l.level < 1 || l.level > 5 || !Number.isFinite(l.pct)) return null
  return l
}

export function levelClass(level: LevelInput | null | undefined): string {
  return level ? `mascot-lv${level.level}` : ''
}

// "N3 · 51%"
export function levelText(level: LevelInput): string {
  return `N${level.level} · ${Math.round(level.pct)}%`
}

// "Se agota en ~12 min" solo si el limite llega antes del reinicio y hay proyeccion.
export function exhaustText(level: LevelInput | null | undefined): string | null {
  const m = level?.minutesLeft
  if (!level?.exhaustsBeforeReset || m == null || !Number.isFinite(m) || m < 0) return null
  return `Se agota en ~${Math.max(1, Math.round(m))} min`
}

export function codexBusy(data: MascotInput | null | undefined): boolean {
  return (data?.agents ?? []).some((a) => a.source === 'codex' && CODEX_BUSY.has(a.state))
}
