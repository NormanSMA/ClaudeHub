// Lanza la bandeja de ClaudeHub si no esta corriendo. No imprime nada:
// la salida de un hook SessionStart se agrega al contexto de Claude.
// @ts-check
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')

function running() {
  // se carga aqui y no arriba: si falta el archivo, el error cae en el try del arranque y el hook sale sin ruido
  const pidFile = path.join(require('./lib/paths.cjs').dataDir(), 'tray.pid')
  try {
    const pid = Number(fs.readFileSync(pidFile, 'utf8'))
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * Ejecutable de Windows a lanzar, o null para usar Electron desde el codigo.
 * Primero la app instalada: release\win-unpacked es una copia de prueba que deja `pnpm dist`
 * y puede quedar con una version vieja.
 * @param {string} platform
 * @param {NodeJS.ProcessEnv} env
 * @param {(file: string) => boolean} exists
 * @returns {string | null}
 */
function packagedApp(platform, env, exists) {
  if (platform !== 'win32') return null
  const candidates = [
    env.LOCALAPPDATA ? path.win32.join(env.LOCALAPPDATA, 'Programs', 'claudehub', 'ClaudeHub.exe') : '',
    path.win32.join(ROOT, 'release', 'win-unpacked', 'ClaudeHub.exe'),
  ]
  return candidates.find((file) => file !== '' && exists(file)) ?? null
}

// Un fallo asincrono de spawn (ejecutable borrado, sin permiso) emitiria 'error' sin manejador y saldria con 1.
const quietSpawn = (/** @type {string} */ file, /** @type {string[]} */ args) =>
  spawn(file, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref()

if (require.main === module) {
  try {
    if (running()) process.exit(0)
    const packaged = packagedApp(process.platform, process.env, fs.existsSync)
    if (packaged) {
      quietSpawn(packaged, ['--background'])
      process.exit(0)
    }
    const electron = require(path.join(ROOT, 'node_modules', 'electron'))
    // Sin windowsHide: esa opcion le pide a Windows ocultar la PRIMERA ventana que la app muestre,
    // y esa es el dashboard. Electron es una app grafica: no abre ninguna consola que haya que ocultar.
    quietSpawn(electron, [ROOT, '--background'])
  } catch {
    /* sin electron instalado: no hacer nada */
  }
}

module.exports = { packagedApp }
