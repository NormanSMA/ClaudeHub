// Lanza la bandeja de ClaudeHub si no esta corriendo. No imprime nada:
// la salida de un hook SessionStart se agrega al contexto de Claude.
// @ts-check
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { dataDir } = require('./lib/paths.cjs')

const ROOT = path.resolve(__dirname, '..')

const PID_FILE = path.join(dataDir(), 'tray.pid')

function running() {
  try {
    const pid = Number(fs.readFileSync(PID_FILE, 'utf8'))
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

if (require.main === module && !running()) {
  try {
    const packaged = packagedApp(process.platform, process.env, fs.existsSync)
    if (packaged) {
      spawn(packaged, ['--background'], { detached: true, stdio: 'ignore' }).unref()
      process.exit(0)
    }
    const electron = require(path.join(ROOT, 'node_modules', 'electron'))
    // Sin windowsHide: esa opcion le pide a Windows ocultar la PRIMERA ventana que la app muestre,
    // y esa es el dashboard. Electron es una app grafica: no abre ninguna consola que haya que ocultar.
    spawn(electron, [ROOT, '--background'], { detached: true, stdio: 'ignore' }).unref()
  } catch {
    /* sin electron instalado: no hacer nada */
  }
}

module.exports = { packagedApp }
