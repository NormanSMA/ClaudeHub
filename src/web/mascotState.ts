export type MascotState = 'sleeping' | 'working' | 'happy' | 'alert' | 'tool' | 'thinking' | 'waiting' | 'error'

// Forma minima de /api/active que necesita la mascota. Los campos nuevos son opcionales: un servidor viejo no los envia.
export interface MascotInput {
  alertAt?: number
  chats?: { working: boolean; context: { pct: number } }[]
  plan?: { blocked?: unknown; fiveHour?: { pct: number } | null } | null
  mascot?: MascotState | null
  agents?: { source: string; state: string }[] | null
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

export function codexBusy(data: MascotInput | null | undefined): boolean {
  return (data?.agents ?? []).some((a) => a.source === 'codex' && CODEX_BUSY.has(a.state))
}
