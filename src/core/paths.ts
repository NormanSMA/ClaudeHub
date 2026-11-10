import { readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Sesiones de Codex. CODEX_SESSIONS_DIR reemplaza la ruta. */
export const codexSessionsDir = (): string =>
  process.env.CODEX_SESSIONS_DIR ?? join(homedir(), '.codex', 'sessions')

/** Chats de Gemini CLI. GEMINI_TMP_DIR reemplaza la ruta. */
export const geminiTmpDir = (): string => process.env.GEMINI_TMP_DIR ?? join(homedir(), '.gemini', 'tmp')

/**
 * Carpeta donde ClaudeHub guarda su cache y su configuracion.
 * Windows: %APPDATA%\ClaudeHub. macOS: ~/Library/Application Support/ClaudeHub. Linux: ~/.config/ClaudeHub.
 * CLAUDEHUB_DATA reemplaza la ruta.
 */
export function dataDir(): string {
  if (process.env.CLAUDEHUB_DATA) return process.env.CLAUDEHUB_DATA
  if (process.platform === 'win32') return join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'ClaudeHub')
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'ClaudeHub')
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'ClaudeHub')
}

/**
 * Carpeta donde los scripts y el mod escriben rate-limits.json, context-windows.json y events.jsonl.
 * Queda fuera de AppData: la app de escritorio de Claude (MSIX) redirige ahi los archivos nuevos
 * a una copia privada que el servidor no ve. CLAUDEHUB_EXCHANGE reemplaza la ruta; sin ella,
 * CLAUDEHUB_DATA (pruebas y demo); sin ninguna, ~/.claudehub.
 */
export function exchangeDir(): string {
  return process.env.CLAUDEHUB_EXCHANGE || process.env.CLAUDEHUB_DATA || join(homedir(), '.claudehub')
}

let packagesMemo: { at: number; dirs: string[] } | null = null

const MAX_EXCHANGE_BYTES = 1024 * 1024

/**
 * Lee un archivo de intercambio como texto. Lanza si falta o si supera 1 MiB:
 * son archivos de pocos KB que escriben otros procesos, y uno enorme bloquearia el servidor.
 */
export function readExchangeFile(file: string): string {
  if (statSync(file).size > MAX_EXCHANGE_BYTES) throw new Error('archivo de intercambio demasiado grande')
  return readFileSync(file, 'utf8')
}

/** Copias privadas de ClaudeHub dentro de los paquetes MSIX de Claude (solo Windows). */
function packageDirs(): string[] {
  if (packagesMemo && Date.now() - packagesMemo.at < 60_000) return packagesMemo.dirs
  let dirs: string[] = []
  try {
    const packages = join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'Packages')
    dirs = readdirSync(packages)
      .filter((name) => /^Claude_/.test(name))
      .map((name) => join(packages, name, 'LocalCache', 'Roaming', 'ClaudeHub'))
      .filter((dir) => {
        try {
          readdirSync(dir)
          return true
        } catch {
          return false
        }
      })
  } catch {
    dirs = []
  }
  packagesMemo = { at: Date.now(), dirs }
  return dirs
}

/**
 * Carpetas donde buscar los archivos de intercambio, sin repetir y por prioridad.
 * Incluye la copia redirigida del paquete MSIX para leer lo que escribio una version anterior.
 */
export function exchangeReadDirs(): string[] {
  const dirs = [exchangeDir(), dataDir()]
  if (process.platform === 'win32' && !process.env.CLAUDEHUB_DATA && !process.env.CLAUDEHUB_EXCHANGE) dirs.push(...packageDirs())
  return [...new Set(dirs)]
}
