import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dataDir } from './paths'

/**
 * Ventanas de contexto reales por sesion, registradas por scripts/statusline.cjs
 * (la linea de estado de Claude Code recibe context_window.context_window_size).
 */
export interface RecordedWindow {
  size: number
  model?: string
  ts: number
}

const FILE = () => process.env.CLAUDEHUB_WINDOWS ?? join(dataDir(), 'context-windows.json')

let memo: { at: number; data: Record<string, RecordedWindow> } | null = null

export function recordedWindows(): Record<string, RecordedWindow> {
  if (memo && Date.now() - memo.at < 5_000) return memo.data
  let data: Record<string, RecordedWindow> = {}
  try {
    const raw = JSON.parse(readFileSync(FILE(), 'utf8'))
    if (raw && typeof raw === 'object') {
      for (const [sid, v] of Object.entries(raw as Record<string, RecordedWindow>)) {
        if (v && typeof v.size === 'number' && v.size >= 10_000 && v.size <= 10_000_000) data[sid] = v
      }
    }
  } catch {
    data = {}
  }
  memo = { at: Date.now(), data }
  return data
}
