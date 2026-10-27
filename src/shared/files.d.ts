/** Formas de los archivos que escriben scripts/*.cjs en la carpeta de datos de ClaudeHub. */

/** Ventana del plan en rate-limits.json. */
export interface RateWindow {
  /** porcentaje usado, de 0 a 100 */
  pct: number
  /** instante de reinicio, en milisegundos desde 1970 */
  resetsAt: number
}

/** rate-limits.json, escrito por statusline.cjs y write-limits.cjs. */
export interface RateLimitsFile {
  fiveHour: RateWindow | null
  sevenDay: RateWindow | null
  /** milisegundos desde 1970 */
  updatedAt: number
}

/** Entrada de context-windows.json, indexada por id de sesion. */
export interface ContextWindowEntry {
  /** tamano real de la ventana, en tokens */
  size: number
  model: string | undefined
  /** milisegundos desde 1970 */
  ts: number
}

/** context-windows.json, escrito por statusline.cjs. */
export type ContextWindowsFile = Record<string, ContextWindowEntry>

/** Ventana de Claude Code en el JSON de stdin de la linea de estado. */
export interface ClaudeRateWindow {
  used_percentage?: number
  /** segundos desde 1970 */
  resets_at?: number
}

/** JSON que Claude Code envia por stdin a statusline.cjs. */
export interface StatusLineInput {
  session_id?: string
  model?: { id?: string; display_name?: string }
  context_window?: {
    context_window_size?: number
    used_percentage?: number
    current_usage?: {
      input_tokens?: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
  }
  rate_limits?: { five_hour?: ClaudeRateWindow; seven_day?: ClaudeRateWindow }
}

export type HookSource = 'claude' | 'codex'

export type HookStateName = 'idle' | 'starting' | 'thinking' | 'tool' | 'waiting' | 'done' | 'error'

/** Linea de events.jsonl, escrita por hook.cjs (512 bytes como maximo). */
export interface EventLine {
  v: 1
  /** milisegundos desde 1970 */
  ts: number
  source: HookSource
  session: string
  event: string
  state: HookStateName
  tool: string
  cwd: string
}

/** JSON del evento que llega por stdin a hook.cjs. Solo los campos que se leen. */
export interface HookInput {
  hook_event_name?: unknown
  session_id?: unknown
  tool_name?: unknown
  cwd?: unknown
}
