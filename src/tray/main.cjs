// ClaudeHub en Windows: bandeja, mascota flotante y alertas de contexto.
// Arranca el servidor local si no esta activo.
const { app, Tray, Menu, BrowserWindow, Notification, nativeImage, shell, screen, ipcMain } = require('electron')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '../..')
const URL = 'http://127.0.0.1:4317'
const DATA_DIR = path.join(process.env.APPDATA || app.getPath('appData'), 'ClaudeHub')
const PID_FILE = path.join(DATA_DIR, 'tray.pid')
const SETUP_FILE = path.join(DATA_DIR, 'setup.json')
const POS_FILE = path.join(DATA_DIR, 'overlay-pos.json')

app.setPath('userData', path.join(DATA_DIR, 'electron'))
// un proceso menos: la interfaz es liviana y no necesita un proceso de GPU aparte
app.commandLine.appendSwitch('in-process-gpu')

// Misma cuadricula del personaje (14 x 12). o cuerpo, l mejilla, s chispa, e ojo.
const GRID = [
  '......ss......',
  '.....ssss.....',
  '......ss......',
  '.......o......',
  '...oooooooo...',
  '..oooooooooo..',
  '..ooeooooeoo..',
  '..ooeooooeoo..',
  '..oloooooolo..',
  '..oooooooooo..',
  '.ooo.oooo.ooo.',
  '.oo..o..o..oo.',
]
const RGB = { o: [217, 119, 87], l: [240, 164, 136], s: [243, 195, 168], e: [31, 30, 29] }

function trayIcon() {
  const cell = 2
  const size = 32
  const buf = Buffer.alloc(size * size * 4)
  const ox = Math.floor((size - 14 * cell) / 2)
  const oy = Math.floor((size - 12 * cell) / 2) + 1
  GRID.forEach((row, y) =>
    [...row].forEach((c, x) => {
      const rgb = RGB[c]
      if (!rgb) return
      for (let dy = 0; dy < cell; dy++)
        for (let dx = 0; dx < cell; dx++) {
          const i = ((oy + y * cell + dy) * size + ox + x * cell + dx) * 4
          buf[i] = rgb[2] // BGRA
          buf[i + 1] = rgb[1]
          buf[i + 2] = rgb[0]
          buf[i + 3] = 255
        }
    }),
  )
  return nativeImage.createFromBitmap(buf, { width: size, height: size })
}

async function getJson(p) {
  const r = await fetch(`${URL}${p}`)
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}

async function serverUp() {
  try {
    await getJson('/api/live')
    return true
  } catch {
    return false
  }
}

let server = null
async function ensureServer() {
  if (await serverUp()) return
  server = spawn('node', ['--import', 'tsx', 'src/server/index.ts'], { cwd: ROOT, stdio: 'ignore', windowsHide: true })
  for (let i = 0; i < 40 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 250))
}

let tray = null
let win = null
let overlay = null

/* ---------- ventana del dashboard ---------- */
let overlayBeforeDashboard = false

function showDashboard() {
  if (!win) overlayBeforeDashboard = !!overlay && overlay.isVisible()
  if (overlay) overlay.hide()
  refreshMenu()
  if (!win) {
    win = new BrowserWindow({
      width: 780,
      height: 660,
      show: false,
      autoHideMenuBar: true,
      title: 'ClaudeHub',
      backgroundColor: '#1a1918',
      icon: trayIcon(),
    })
    win.loadURL(URL)
    // se muestra al terminar el primer pintado: show() antes deja la ventana invisible
    win.once('ready-to-show', placeDashboard)
    win.on('closed', () => {
      win = null
      // la mascota vuelve solo si estaba visible antes de abrir el dashboard
      if (overlayBeforeDashboard) showOverlay()
    })
    return
  }
  placeDashboard()
}

function placeDashboard() {
  if (!win) return
  const { workArea } = screen.getPrimaryDisplay()
  const [w, h] = win.getSize()
  win.setPosition(workArea.x + Math.round((workArea.width - w) / 2), workArea.y + Math.round((workArea.height - h) / 2))
  win.show()
  win.focus()
}

/* ---------- mascota flotante ---------- */
function savedPos() {
  try {
    return JSON.parse(fs.readFileSync(POS_FILE, 'utf8'))
  } catch {
    return null
  }
}

function clampToScreen(b) {
  const wa = screen.getDisplayMatching(b).workArea
  return {
    ...b,
    x: Math.min(Math.max(b.x, wa.x), wa.x + wa.width - b.width),
    y: Math.min(Math.max(b.y, wa.y), wa.y + wa.height - b.height),
  }
}

function savePos() {
  if (!overlay) return
  const b = overlay.getBounds()
  try {
    fs.writeFileSync(POS_FILE, JSON.stringify({ right: b.x + b.width, bottom: b.y + b.height }))
  } catch {
    /* posicion opcional */
  }
}

function showOverlay() {
  if (overlay) {
    overlay.show()
    return
  }
  const wa = screen.getPrimaryDisplay().workArea
  const pos = savedPos() || { right: wa.x + wa.width - 16, bottom: wa.y + wa.height - 16 }
  const w = 68
  const h = 64
  overlay = new BrowserWindow({
    ...clampToScreen({ x: pos.right - w, y: pos.bottom - h, width: w, height: h }),
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true },
  })
  overlay.setAlwaysOnTop(true, 'screen-saver')
  overlay.loadURL(`${URL}/overlay.html`)
  overlay.on('closed', () => {
    overlay = null
    refreshMenu()
  })
  refreshMenu()
}

ipcMain.on('hub:drag', (e, dx, dy) => {
  if (!overlay) return
  const b = overlay.getBounds()
  overlay.setBounds(clampToScreen({ ...b, x: b.x + Math.round(dx), y: b.y + Math.round(dy) }))
  savePos()
})
ipcMain.on('hub:resize', (e, width, height) => {
  if (!overlay) return
  const b = overlay.getBounds()
  const w = Math.round(width)
  const h = Math.round(height)
  // conserva la esquina inferior derecha, donde esta la mascota
  overlay.setBounds(clampToScreen({ x: b.x + b.width - w, y: b.y + b.height - h, width: w, height: h }))
})
ipcMain.on('hub:dashboard', showDashboard)
ipcMain.on('hub:hide', () => {
  if (overlay) overlay.hide()
  refreshMenu()
})

/* ---------- tooltip y alertas ---------- */
const alerted = new Set()

function tokensText(m) {
  return m >= 1e9 ? (m / 1e9).toFixed(2) + 'B' : m >= 1e6 ? (m / 1e6).toFixed(1) + 'M' : m >= 1e3 ? Math.round(m / 1e3) + 'k' : String(m)
}

async function poll() {
  try {
    const { chats, alertAt, todayTokens } = await getJson('/api/active')
    const working = chats.some((c) => c.working)
    tray.setToolTip(`ClaudeHub - hoy ${tokensText(todayTokens)} tokens, ${chats.length} chats activos${working ? ' (trabajando)' : ''}`)
    const live = new Set(chats.map((c) => c.session))
    for (const s of [...alerted]) if (!live.has(s)) alerted.delete(s)
    for (const c of chats) {
      if (c.context.pct >= alertAt && !alerted.has(c.session)) {
        alerted.add(c.session)
        new Notification({
          title: 'Contexto casi lleno',
          body: `${c.title}: ${Math.round(c.context.pct * 100)}% de la ventana (${tokensText(c.context.used)} de ${tokensText(c.context.limit)}).`,
          silent: true,
        }).show()
      } else if (c.context.pct < alertAt - 0.1) {
        alerted.delete(c.session)
      }
    }
  } catch {
    tray.setToolTip('ClaudeHub - servidor apagado')
  }
}

function refreshMenu() {
  if (!tray) return
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Abrir dashboard', click: showDashboard },
      { label: 'Abrir en el navegador', click: () => shell.openExternal(URL) },
      {
        label: 'Mostrar mascota',
        type: 'checkbox',
        checked: !!overlay && overlay.isVisible(),
        click: (item) => (item.checked ? showOverlay() : overlay && overlay.hide()),
      },
      { type: 'separator' },
      {
        label: 'Iniciar con Windows',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, args: [ROOT] }),
      },
      { type: 'separator' },
      { label: 'Salir', click: () => app.quit() },
    ]),
  )
}

/* ---------- ciclo de vida ---------- */
// segunda instancia: sale de inmediato, sin tocar tray.pid ni crear otra bandeja
if (!app.requestSingleInstanceLock()) app.exit(0)

app.setAppUserModelId('ClaudeHub')
app.on('second-instance', (e, argv) => {
  // el lanzador automatico usa --background: si ya corre, no hace nada
  if (!argv.includes('--background') && !win) showOverlay()
})
app.on('window-all-closed', (e) => e.preventDefault())

app.whenReady().then(async () => {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(PID_FILE, String(process.pid))
  if (!fs.existsSync(SETUP_FILE)) {
    app.setLoginItemSettings({ openAtLogin: true, args: [ROOT] })
    fs.writeFileSync(SETUP_FILE, JSON.stringify({ loginItem: true }))
  }
  await ensureServer()
  tray = new Tray(trayIcon())
  tray.on('click', showOverlay)
  tray.on('double-click', showDashboard)
  refreshMenu()
  if (!win) showOverlay()
  poll()
  setInterval(poll, 8_000)
})

app.on('before-quit', () => {
  if (server) server.kill()
  try {
    fs.unlinkSync(PID_FILE)
  } catch {
    /* ya no existe */
  }
})
