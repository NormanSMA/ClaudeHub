import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { exchangeReadDirs } from './paths'

/**
 * Ventanas de contexto reales por sesion, registradas por scripts/statusline.cjs
 * (la linea de estado de Claude Code recibe context_window.context_window_size).
 */
export interface RecordedWindow {
  size: number
  model?: string
  ts: number
}

let memo: { at: number; data: Record<string, RecordedWindow> } | null = null

function readFile(file: string): Record<string, RecordedWindow> {
  const data: Record<string, RecordedWindow> = {}
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    if (raw && typeof raw === 'object') {
      for (const [sid, v] of Object.entries(raw as Record<string, RecordedWindow>)) {
        if (v && typeof v.size === 'number' && v.size >= 10_000 && v.size <= 10_000_000) data[sid] = v
      }
    }
  } catch {
    return {}
  }
  return data
}

/** Fusiona context-windows.json de cada carpeta. Por sesion gana el ts mayor. */
export function mergeWindows(dirs: string[]): Record<string, RecordedWindow> {
  const out: Record<string, RecordedWindow> = {}
  for (const dir of dirs) {
    for (const [sid, v] of Object.entries(readFile(join(dir, 'context-windows.json')))) {
      const prev = out[sid]
      if (!prev || (typeof v.ts === 'number' ? v.ts : 0) > (typeof prev.ts === 'number' ? prev.ts : 0)) out[sid] = v
    }
  }
  return out
}

export function recordedWindows(): Record<string, RecordedWindow> {
  if (memo && Date.now() - memo.at < 5_000) return memo.data
  const override = process.env.CLAUDEHUB_WINDOWS
  const data = override ? readFile(override) : mergeWindows(exchangeReadDirs())
  memo = { at: Date.now(), data }
  return data
}
