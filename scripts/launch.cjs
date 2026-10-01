// Lanza la bandeja de ClaudeHub si no esta corriendo. No imprime nada:
// la salida de un hook SessionStart se agrega al contexto de Claude.
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const PID_FILE = path.join(process.env.APPDATA || '', 'ClaudeHub', 'tray.pid')

function running() {
  try {
    const pid = Number(fs.readFileSync(PID_FILE, 'utf8'))
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

if (!running()) {
  try {
    const electron = require(path.join(ROOT, 'node_modules', 'electron'))
    // Sin windowsHide: esa opcion le pide a Windows ocultar la PRIMERA ventana que la app muestre,
    // y esa es el dashboard. Electron es una app grafica: no abre ninguna consola que haya que ocultar.
    spawn(electron, [ROOT, '--background'], { detached: true, stdio: 'ignore' }).unref()
  } catch {
    /* sin electron instalado: no hacer nada */
  }
}
