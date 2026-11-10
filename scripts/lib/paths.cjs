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

/**
 * Carpeta de intercambio con el servidor. Misma logica que exchangeDir en src/core/paths.ts.
 * Queda fuera de AppData porque la app de escritorio de Claude (MSIX) redirige ahi los archivos nuevos.
 * CLAUDEHUB_EXCHANGE reemplaza la ruta; sin ella, CLAUDEHUB_DATA; sin ninguna, ~/.claudehub.
 * @returns {string}
 */
function exchangeDir() {
  return process.env.CLAUDEHUB_EXCHANGE || process.env.CLAUDEHUB_DATA || path.join(os.homedir(), '.claudehub')
}

module.exports = { dataDir, exchangeDir }
