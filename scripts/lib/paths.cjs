// @ts-check
const os = require('node:os')
const path = require('node:path')

/**
 * Carpeta de datos de ClaudeHub. Misma logica que src/core/paths.ts.
 * Windows: %APPDATA%\ClaudeHub. macOS: ~/Library/Application Support/ClaudeHub. Linux: ~/.config/ClaudeHub.
 * CLAUDEHUB_DATA reemplaza la ruta.
 * @returns {string}
 */
function dataDir() {
  if (process.env.CLAUDEHUB_DATA) return process.env.CLAUDEHUB_DATA
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'ClaudeHub')
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'ClaudeHub')
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'ClaudeHub')
}

module.exports = { dataDir }
