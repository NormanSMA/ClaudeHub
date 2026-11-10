import { closeSync, fstatSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs'
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

// /api/active se recalcula cada pocos segundos; el recorrido del arbol y la lectura no deben repetirse a ese ritmo.
const MEMO_MS = 30_000
let memo: { dir: string; at: number; value: CodexRateLimits | null } | null = null

/** Vacia el memo. Lo usan las pruebas. */
export function clearCodexLimitsCache(): void {
  memo = null
}

// El rate_limits mas reciente esta al final del rollout. Si el final no trae ninguno se lee el archivo entero,
// asi el resultado es el mismo que leyendo todo.
const TAIL_BYTES = 256 * 1024

function limitsOf(file: string): CodexRateLimits | null {
  const fd = openSync(file, 'r')
  try {
    const size = fstatSync(fd).size
    const len = Math.min(size, TAIL_BYTES)
    const buf = Buffer.alloc(len)
    readSync(fd, buf, 0, len, size - len)
    // la primera linea del tramo puede venir cortada: no es JSON valido y se descarta sola
    const found = codexRateLimits(buf.toString('utf8'))
    if (found || size <= TAIL_BYTES) return found
  } finally {
    closeSync(fd)
  }
  return codexRateLimits(readFileSync(file, 'utf8'))
}

/**
 * Limites del plan de Codex: el `rate_limits` mas reciente de los 5 rollouts modificados ultimo.
 * Devuelve null si no hay rollouts o ninguno trae limites validos. El resultado se conserva 30 s.
 */
export function latestCodexLimits(dir: string = codexSessionsDir()): CodexRateLimits | null {
  if (memo && memo.dir === dir && Date.now() - memo.at < MEMO_MS) return memo.value
  const files = rolloutFiles(dir)
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, MAX_FILES)
  let best: CodexRateLimits | null = null
  for (const { file } of files) {
    let found: CodexRateLimits | null
    try {
      found = limitsOf(file)
    } catch {
      continue
    }
    if (found && (!best || found.ts > best.ts)) best = found
  }
  memo = { dir, at: Date.now(), value: best }
  return best
}
