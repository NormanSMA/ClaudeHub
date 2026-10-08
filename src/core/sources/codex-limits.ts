import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { codexSessionsDir } from '../paths'
import { codexRateLimits, type CodexRateLimits } from './codex'

/** Cantidad maxima de rollouts que se leen para buscar los limites. */
const MAX_FILES = 5

function rolloutFiles(dir: string): { file: string; mtime: number }[] {
  const out: { file: string; mtime: number }[] = []
  const walk = (d: string) => {
    let entries
    try {
      entries = readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.isFile() && e.name.startsWith('rollout-') && e.name.endsWith('.jsonl')) {
        try {
          out.push({ file: p, mtime: statSync(p).mtimeMs })
        } catch {
          /* el archivo desaparecio entre el listado y el stat */
        }
      }
    }
  }
  walk(dir)
  return out
}

/**
 * Limites del plan de Codex: el `rate_limits` mas reciente de los 5 rollouts modificados ultimo.
 * Devuelve null si no hay rollouts o ninguno trae limites validos.
 */
export function latestCodexLimits(dir: string = codexSessionsDir()): CodexRateLimits | null {
  const files = rolloutFiles(dir)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, MAX_FILES)
  let best: CodexRateLimits | null = null
  for (const { file } of files) {
    let text: string
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const found = codexRateLimits(text)
    if (found && (!best || found.ts > best.ts)) best = found
  }
  return best
}
