// ClaudeHub (Windows, macOS y Linux): bandeja, mascota flotante y alertas de contexto.
// Arranca el servidor local si no esta activo.
// @ts-check
const { app, Tray, Menu, BrowserWindow, Notification, nativeImage, shell, screen, ipcMain, utilityProcess } = require('electron')
const { spawn, execFile } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const IS_MAC = process.platform === 'darwin'
const IS_LINUX = process.platform === 'linux'
const SMOKE = process.env.CLAUDEHUB_SMOKE === '1'

const ROOT = path.resolve(__dirname, '../..')
const URL = 'http://127.0.0.1:4317'
// app.getPath('appData') es %APPDATA% en Windows, ~/Library/Application Support en macOS y ~/.config en Linux
const DATA_DIR = process.env.CLAUDEHUB_DATA || path.join(app.getPath('appData'), 'ClaudeHub')
const PID_FILE = path.join(DATA_DIR, 'tray.pid')
const SETUP_FILE = path.join(DATA_DIR, 'setup.json')
const POS_FILE = path.join(DATA_DIR, 'overlay-pos.json')

app.setPath('userData', path.join(DATA_DIR, 'electron'))

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
/** @type {Record<string, number[]>} */
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
  // en macOS la barra de menu usa iconos de 16 puntos: 32 px a escala 2
  return nativeImage.createFromBitmap(buf, { width: size, height: size, scaleFactor: IS_MAC ? 2 : 1 })
}

/**
 * El llamador fija la forma de la respuesta con una conversion de tipo.
 * @param {string} p
 * @returns {Promise<unknown>}
 */
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

// instalado: el ejecutable ya sabe donde esta la app; desde el codigo fuente hay que pasar la carpeta del proyecto
const loginArgs = () => (app.isPackaged ? [] : [ROOT])

const AUTOSTART_FILE = path.join(os.homedir(), '.config', 'autostart', 'claudehub.desktop')

/** Inicio automatico. Windows y macOS usan el del sistema; Linux no lo tiene y usa un .desktop de autostart. */
function autostartEnabled() {
  return IS_LINUX ? fs.existsSync(AUTOSTART_FILE) : app.getLoginItemSettings().openAtLogin
}

/**
 * Windows: si el inicio automatico de 'ClaudeHub' apunta a otro ejecutable (por ejemplo, el electron.exe de una
 * prueba en desarrollo), lo vuelve a apuntar a la app empaquetada. Si no hay entrada (apagado), no la crea.
 * Se lee el registro directamente: getLoginItemSettings solo lista las entradas del ejecutable actual.
 */
function fixStaleLoginItem() {
  if (!app.isPackaged || process.platform !== 'win32') return
  const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
  execFile('reg', ['query', key, '/v', 'ClaudeHub'], { windowsHide: true, timeout: 5000 }, (err, stdout) => {
    if (err || !/ClaudeHub\s+REG_SZ/i.test(stdout)) return // sin entrada: el usuario lo apago
    if (!stdout.toLowerCase().includes(process.execPath.toLowerCase())) app.setLoginItemSettings({ openAtLogin: true, args: loginArgs() })
  })
}

/** @param {boolean} on */
function setAutostart(on) {
  if (!IS_LINUX) {
    app.setLoginItemSettings({ openAtLogin: on, args: loginArgs() })
    return
  }
  if (!on) {
    try {
      fs.unlinkSync(AUTOSTART_FILE)
    } catch {
      /* ya no existe */
    }
    return
  }
  /** @param {string} s */
  const quote = (s) => `"${s.replace(/"/g, '\\"')}"`
  const exe = process.env.APPIMAGE || process.execPath
  fs.mkdirSync(path.dirname(AUTOSTART_FILE), { recursive: true })
  fs.writeFileSync(
    AUTOSTART_FILE,
    [
      '[Desktop Entry]',
      'Type=Application',
      'Name=ClaudeHub',
      'Comment=Monitor local de tokens de Claude Code',
      `Exec=${[exe, ...loginArgs(), '--background'].map(quote).join(' ')}`,
      'X-GNOME-Autostart-enabled=true',
      '',
    ].join('\n'),
  )
}

/** @type {import('electron').UtilityProcess | import('node:child_process').ChildProcess | null} */
let server = null
async function ensureServer() {
  if (await serverUp()) return
  const bundled = path.join(ROOT, 'dist-server', 'server.cjs')
  if (fs.existsSync(bundled)) {
    // servidor empaquetado: corre en un proceso aparte con el Node de Electron, sin depender de Node ni pnpm
    server = utilityProcess.fork(bundled, [], {
      env: { ...process.env, CLAUDEHUB_DIST: path.join(ROOT, 'dist') },
      stdio: 'ignore',
      serviceName: 'ClaudeHub servidor',
    })
  } else {
    // desarrollo sin compilar: usa tsx con el Node del sistema
    server = spawn('node', ['--import', 'tsx', 'src/server/index.ts'], { cwd: ROOT, stdio: 'ignore', windowsHide: true })
  }
  for (let i = 0; i < 60 && !(await serverUp()); i++) await new Promise((r) => setTimeout(r, 250))
}

const RELEASES_PREFIX = 'https://github.com/NormanSMA/ClaudeHub/releases/'

/**
 * Solo abre paginas de releases de ClaudeHub. Compara la URL ya normalizada (sin "..", sin otro host).
 * @param {unknown} url
 */
function openRelease(url) {
  if (typeof url !== 'string' || url.length > 300) return false
  let parsed
  try {
    parsed = new globalThis.URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' || !parsed.href.startsWith(RELEASES_PREFIX)) return false
  shell.openExternal(parsed.href)
  return true
}

/** @type {import('electron').Tray | null} */
let tray = null
/** @type {import('electron').BrowserWindow | null} */
let win = null
/** @type {import('electron').BrowserWindow | null} */
let overlay = null
let ghostMode = false
// true mientras la app se cierra: evita reabrir la mascota al cerrarse las ventanas (eso cancelaba la salida)
let quitting = false

/* ---------- ventana del dashboard ---------- */
let overlayBeforeDashboard = false

function showDashboard() {
  if (!win) overlayBeforeDashboard = !!overlay && overlay.isVisible()
  // La mascota NO se oculta aqui. Si se oculta primero, siendo la ventana activa por el clic,
  // Windows deja sin mostrar el dashboard (queda con WS_VISIBLE apagado). Se oculta en placeDashboard, despues de mostrarlo.
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
    // los enlaces con target=_blank salen por la misma validacion; nunca se abre otra ventana
    win.webContents.setWindowOpenHandler(({ url }) => {
      openRelease(url)
      return { action: 'deny' }
    })
    win.loadURL(URL)
    // se muestra al terminar el primer pintado: show() antes deja la ventana invisible
    win.once('ready-to-show', placeDashboard)
    win.on('closed', () => {
      win = null
      // la mascota vuelve solo si estaba visible antes de abrir el dashboard
      if (overlayBeforeDashboard && !quitting) showOverlay()
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
  // Si el proceso nacio con la orden "ocultar ventana" (un hook o lanzador con windowsHide), Windows ignora
  // el primer show() de una ventana normal. Un segundo show() si la muestra.
  if (!win.isVisible()) {
    win.show()
    win.focus()
  }
  // ahora si: con el dashboard ya visible y activo, la mascota se oculta sin quitarle el foco a nadie
  if (overlay) overlay.hide()
  refreshMenu()
}

/* ---------- mascota flotante ---------- */
/** @returns {{ right: number, bottom: number } | null} */
function savedPos() {
  try {
    return JSON.parse(fs.readFileSync(POS_FILE, 'utf8'))
  } catch {
    return null
  }
}

/**
 * @param {import('electron').Rectangle} b
 * @returns {import('electron').Rectangle}
 */
function clampToScreen(b) {
  const wa = screen.getDisplayMatching(b).workArea
  return {
    ...b,
    x: Math.min(Math.max(b.x, wa.x), wa.x + wa.width - b.width),
    y: Math.min(Math.max(b.y, wa.y), wa.y + wa.height - b.height),
  }
}

/** @type {'corner' | 'island'} */
let overlayMode = 'corner'
const ISLAND_COMPACT = { width: 180, height: 38 }
/** @type {ReturnType<typeof setInterval> | null} */
let cursorTimer = null

/**
 * Centro superior del area de trabajo.
 * @param {number} w
 * @param {number} h
 * @returns {import('electron').Rectangle}
 */
function islandBounds(w, h) {
  const wa = screen.getPrimaryDisplay().workArea
  return { x: wa.x + Math.round((wa.width - w) / 2), y: wa.y, width: w, height: h }
}

function stopCursor() {
  if (cursorTimer !== null) clearInterval(cursorTimer)
  cursorTimer = null
}

/** Envia el cursor a la ventana cada 50 ms. Solo en modo isla y con la ventana visible. */
function syncCursor() {
  stopCursor()
  if (overlayMode !== 'island' || !overlay || !overlay.isVisible()) return
  cursorTimer = setInterval(() => {
    if (!overlay || overlay.isDestroyed() || !overlay.isVisible()) return stopCursor()
    const p = screen.getCursorScreenPoint()
    const b = overlay.getBounds()
    overlay.webContents.send('hub:cursor', p.x - b.x, p.y - b.y)
  }, 50)
}

function savePos() {
  if (!overlay || overlayMode === 'island') return
  const b = overlay.getBounds()
  try {
    fs.writeFileSync(POS_FILE, JSON.stringify({ right: b.x + b.width, bottom: b.y + b.height }))
  } catch {
    /* posicion opcional */
  }
}

function applyGhostMode() {
  if (!overlay) return
  overlay.setIgnoreMouseEvents(ghostMode, { forward: true })
  overlay.setOpacity(ghostMode ? 0.35 : 1)
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
  overlay.webContents.setWindowOpenHandler(({ url }) => {
    openRelease(url)
    return { action: 'deny' }
  })
  overlay.setAlwaysOnTop(true, 'screen-saver')
  applyGhostMode()
  overlay.loadURL(`${URL}/overlay.html`)
  overlay.on('show', syncCursor)
  overlay.on('hide', stopCursor)
  overlay.on('closed', () => {
    overlay = null
    stopCursor()
    refreshMenu()
  })
  refreshMenu()
}

ipcMain.on('hub:mode', (e, mode) => {
  if (mode !== 'corner' && mode !== 'island') return
  overlayMode = mode
  if (overlay) {
    if (mode === 'island') overlay.setBounds(islandBounds(ISLAND_COMPACT.width, ISLAND_COMPACT.height))
    else {
      const wa = screen.getPrimaryDisplay().workArea
      const pos = savedPos() || { right: wa.x + wa.width - 16, bottom: wa.y + wa.height - 16 }
      overlay.setBounds(clampToScreen({ x: pos.right - 68, y: pos.bottom - 64, width: 68, height: 64 }))
    }
  }
  syncCursor()
})
ipcMain.on('hub:drag', (e, dx, dy) => {
  if (!overlay || overlayMode === 'island') return
  const b = overlay.getBounds()
  overlay.setBounds(clampToScreen({ ...b, x: b.x + Math.round(dx), y: b.y + Math.round(dy) }))
  savePos()
})
ipcMain.on('hub:resize', (e, width, height) => {
  if (!overlay) return
  const b = overlay.getBounds()
  const w = Math.round(width)
  const h = Math.round(height)
  if (overlayMode === 'island') {
    // conserva el centro superior
    overlay.setBounds(islandBounds(w, h))
    return
  }
  // conserva la esquina inferior derecha, donde esta la mascota
  overlay.setBounds(clampToScreen({ x: b.x + b.width - w, y: b.y + b.height - h, width: w, height: h }))
})
ipcMain.on('hub:dashboard', showDashboard)
ipcMain.on('hub:openExternal', (e, url) => openRelease(url))
ipcMain.on('hub:hide', () => {
  if (overlay) overlay.hide()
  refreshMenu()
})

/* ---------- tooltip y alertas ---------- */
// Campos de /api/active que lee la bandeja
/** @typedef {{ working: boolean, session: string, title: string, context: { pct: number, used: number, limit: number } }} ActiveChat */
/** @typedef {{ chats: ActiveChat[], alertAt: number, todayTokens: number, plan: import('../core/plan').PlanReport | null }} ActiveReply */

/** @type {Set<string>} */
const alerted = new Set()

/** @param {number} m */
function tokensText(m) {
  return m >= 1e9 ? (m / 1e9).toFixed(2) + 'B' : m >= 1e6 ? (m / 1e6).toFixed(1) + 'M' : m >= 1e3 ? Math.round(m / 1e3) + 'k' : String(m)
}

// Una alerta por ventana del plan: la clave incluye la hora de reinicio, asi vuelve a avisar en la siguiente ventana.
/** @type {Set<string>} */
const alertedPlan = new Set()

/** @param {number} resetsAt */
function untilText(resetsAt) {
  const min = Math.max(0, Math.round((resetsAt - Date.now()) / 60000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return h < 24 ? `${h} h ${min % 60} min` : `${Math.floor(h / 24)} d ${h % 24} h`
}

/**
 * @param {import('../core/plan').PlanReport | null} plan
 * @param {number} alertAt
 */
function alertPlan(plan, alertAt) {
  if (!plan) return
  if (plan.blocked) {
    const id = `blocked-${plan.blocked.resetsAt}`
    if (!alertedPlan.has(id)) {
      alertedPlan.add(id)
      const name = plan.blocked.type === 'five_hour' ? 'de 5 horas' : plan.blocked.type === 'seven_day' ? 'semanal' : 'del plan'
      new Notification({ title: `Llegaste a tu limite ${name}`, body: `Se restablece en ${untilText(plan.blocked.resetsAt)}.`, silent: true }).show()
    }
  }
  /** @type {[string, import('../core/plan').PlanWindow | null, string][]} */
  const windows = [
    ['5h', plan.fiveHour, 'limite de 5 horas'],
    ['7d', plan.sevenDay, 'limite semanal'],
  ]
  for (const [key, w, name] of windows) {
    if (!w) continue
    const id = `${key}-${w.resetsAt}`
    if (w.pct / 100 >= alertAt && !alertedPlan.has(id)) {
      alertedPlan.add(id)
      new Notification({
        title: `Tu ${name} va al ${Math.round(w.pct)}%`,
        body: `Se restablece en ${untilText(w.resetsAt)}.`,
        silent: true,
      }).show()
    }
  }
  // evita que el conjunto crezca sin limite
  if (alertedPlan.size > 50) alertedPlan.clear()
}

async function poll() {
  if (!tray) return
  try {
    const { chats, alertAt, todayTokens, plan } = /** @type {ActiveReply} */ (await getJson('/api/active'))
    const working = chats.some((c) => c.working)
    const limit5 = plan && plan.fiveHour ? `, limite de 5 h al ${Math.round(plan.fiveHour.pct)}%` : ''
    tray.setToolTip(`ClaudeHub - hoy ${tokensText(todayTokens)} tokens, ${chats.length} chats activos${limit5}${working ? ' (trabajando)' : ''}`)
    alertPlan(plan, alertAt)
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
      {
        label: 'Modo fantasma',
        type: 'checkbox',
        checked: ghostMode,
        click: (item) => {
          ghostMode = item.checked
          applyGhostMode()
          refreshMenu()
        },
      },
      { type: 'separator' },
      {
        label: 'Iniciar con el sistema',
        type: 'checkbox',
        checked: autostartEnabled(),
        click: (item) => setAutostart(item.checked),
      },
      { type: 'separator' },
      { label: 'Salir', click: () => app.quit() },
    ]),
  )
}

/* ---------- ciclo de vida ---------- */
// segunda instancia: sale de inmediato, sin tocar tray.pid ni crear otra bandeja
if (!app.requestSingleInstanceLock()) app.exit(0)

// En desarrollo (electron.exe) se usa otro identificador. Si compartiera 'ClaudeHub', Windows mezclaria su
// acceso del menu Inicio con el de la app empaquetada y la barra de tareas mostraria el icono de Electron.
// El identificador tambien nombra la entrada de inicio automatico de Windows.
app.setAppUserModelId(app.isPackaged ? 'ClaudeHub' : 'ClaudeHub.Dev')
app.on('second-instance', (e, argv) => {
  // el lanzador automatico usa --background: si ya corre, no hace nada
  if (!argv.includes('--background') && !win) showOverlay()
})
// el tipo de Electron no declara el evento, pero en ejecucion llega con preventDefault
app.on('window-all-closed', /** @param {{ preventDefault: () => void }} [e] */ (e) => e && e.preventDefault())

/**
 * @typedef {{ platform: string, arch: string, electron: string, server?: boolean, sessions?: number,
 *   trayCreated?: boolean, overlayVisible?: boolean, dashboardVisible?: boolean, overlayHiddenAfter?: boolean,
 *   error?: string, ok?: boolean }} SmokeResult
 */

/** Prueba de humo (CI): arranca todo, abre el dashboard y comprueba que las ventanas se ven. Sale con 0 si todo esta bien. */
async function runSmoke() {
  /** @param {number} ms */
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  /** @type {SmokeResult} */
  const result = { platform: process.platform, arch: process.arch, electron: process.versions.electron }
  try {
    result.server = await serverUp()
    result.sessions = /** @type {{ sessions: number }} */ (await getJson('/api/summary?range=all')).sessions
    await wait(2000)
    result.trayCreated = !!tray && !tray.isDestroyed()
    result.overlayVisible = !!overlay && overlay.isVisible()
    showDashboard()
    // el dashboard se muestra en ready-to-show (primer pintado). En Linux del CI, sin GPU, puede tardar
    // mas de 5 s: se espera hasta 20 s y se sigue en cuanto aparece
    for (let i = 0; i < 80 && !(win && win.isVisible()); i++) await wait(250)
    await wait(500)
    result.dashboardVisible = !!win && win.isVisible()
    result.overlayHiddenAfter = !!overlay && !overlay.isVisible()
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e)
  }
  result.ok = !!(result.server && (result.sessions ?? -1) >= 0 && result.trayCreated && result.overlayVisible && result.dashboardVisible && result.overlayHiddenAfter)
  const out = process.env.CLAUDEHUB_SMOKE_OUT || path.join(DATA_DIR, 'smoke.json')
  try {
    fs.writeFileSync(out, JSON.stringify(result, null, 2))
  } catch {
    /* sin carpeta de salida */
  }
  console.log('SMOKE_RESULT ' + JSON.stringify(result))
  if (!result.ok) {
    quitting = true
    app.exit(1)
    return
  }
  // Cierre por la ruta real de "Salir", con el dashboard abierto. Si algo bloquea la salida, termina con codigo 99.
  setTimeout(() => process.exit(99), 10000).unref()
  app.quit()
}

app.whenReady().then(async () => {
  // app de barra de menu: sin icono en el Dock de macOS
  if (IS_MAC && app.dock) app.dock.hide()
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(PID_FILE, String(process.pid))
  if (!SMOKE && !fs.existsSync(SETUP_FILE)) {
    setAutostart(true)
    fs.writeFileSync(SETUP_FILE, JSON.stringify({ loginItem: true }))
  }
  if (!SMOKE) fixStaleLoginItem()
  await ensureServer()
  tray = new Tray(trayIcon())
  tray.on('click', showOverlay)
  tray.on('double-click', showDashboard)
  refreshMenu()
  if (!win) showOverlay()
  poll()
  setInterval(poll, 8_000)
  if (SMOKE) runSmoke()
})

app.on('before-quit', () => {
  quitting = true
  if (server) server.kill()
  try {
    fs.unlinkSync(PID_FILE)
  } catch {
    /* ya no existe */
  }
})
