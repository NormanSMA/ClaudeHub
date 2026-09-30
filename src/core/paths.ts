import { homedir } from 'node:os'
import { join } from 'node:path'

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
