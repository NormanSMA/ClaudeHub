import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface HubConfig {
  /** Limite de contexto por nombre de modelo, p. ej. { "Opus 5": 1000000 } */
  contextLimits: Record<string, number>
  /** Minutos sin actividad para dejar de considerar activo un chat */
  activeMinutes: number
  /** Porcentaje de contexto que dispara la alerta */
  alertAt: number
  /** Nombre para el saludo de la interfaz. Vacio: saludo sin nombre */
  name: string
}

const DEFAULTS: HubConfig = { contextLimits: {}, activeMinutes: 20, alertAt: 0.85, name: '' }
const FILE = process.env.CLAUDEHUB_CONFIG ?? join(process.env.APPDATA ?? homedir(), 'ClaudeHub', 'config.json')

let memo: { at: number; cfg: HubConfig } | null = null

/** Lee config.json (opcional). Se relee cada 10 s. */
export function config(): HubConfig {
  if (memo && Date.now() - memo.at < 10_000) return memo.cfg
  let cfg = DEFAULTS
  try {
    cfg = { ...DEFAULTS, ...JSON.parse(readFileSync(FILE, 'utf8')) }
  } catch {
    /* sin archivo: valores por defecto */
  }
  memo = { at: Date.now(), cfg }
  return cfg
}
