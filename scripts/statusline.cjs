#!/usr/bin/env node
// Linea de estado de Claude Code para ClaudeHub (opcional).
// Hace dos cosas:
//   1. Guarda el tamano REAL de la ventana de contexto de cada sesion en context-windows.json,
//      para que ClaudeHub deje de estimarlo.
//   2. Imprime una linea corta para la barra de estado: [Modelo] ctx 43% (86k/200k)
//
// Claude Code envia un JSON por stdin con session_id, model y context_window.
// Uso en ~/.claude/settings.json:
//   "statusLine": { "type": "command", "command": "node \"<ruta>/scripts/statusline.cjs\"" }

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

// Misma logica que src/core/paths.ts
function dataDir() {
  if (process.env.CLAUDEHUB_DATA) return process.env.CLAUDEHUB_DATA
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'ClaudeHub')
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'ClaudeHub')
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'ClaudeHub')
}

const FILE = process.env.CLAUDEHUB_WINDOWS || path.join(dataDir(), 'context-windows.json')
const MAX_ENTRIES = 500
const MAX_AGE_MS = 30 * 86_400_000
const REFRESH_MS = 10 * 60_000

function record(sessionId, size, model) {
  let data = {}
  try {
    data = JSON.parse(fs.readFileSync(FILE, 'utf8')) || {}
  } catch {
    data = {}
  }
  const now = Date.now()
  const prev = data[sessionId]
  // evita escribir en cada refresco: solo si cambia el tamano o pasaron 10 minutos
  if (prev && prev.size === size && now - prev.ts < REFRESH_MS) return
  data[sessionId] = { size, model, ts: now }
  const entries = Object.entries(data)
    .filter(([, v]) => v && now - v.ts < MAX_AGE_MS)
    .sort((a, b) => b[1].ts - a[1].ts)
    .slice(0, MAX_ENTRIES)
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  const tmp = FILE + '.' + process.pid + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(entries)))
  fs.renameSync(tmp, FILE)
}

function compact(n) {
  return n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n)
}

let input = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (d) => (input += d))
process.stdin.on('end', () => {
  let j = {}
  try {
    j = JSON.parse(input)
  } catch {
    return
  }
  const cw = j.context_window || {}
  const size = Number(cw.context_window_size)
  try {
    if (j.session_id && Number.isFinite(size) && size > 0) record(j.session_id, size, j.model && j.model.id)
  } catch {
    // la linea de estado nunca debe fallar por no poder guardar
  }
  const u = cw.current_usage
  const used = u ? (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0) : null
  const pct = typeof cw.used_percentage === 'number' ? cw.used_percentage : used !== null && size > 0 ? (used / size) * 100 : null
  const name = (j.model && (j.model.display_name || j.model.id)) || 'Claude'
  if (pct === null) return void process.stdout.write(`[${name}]\n`)
  const color = pct >= 85 ? '31' : pct >= 60 ? '33' : '32'
  const detail = used !== null && size > 0 ? ` (${compact(used)}/${compact(size)})` : ''
  process.stdout.write(`[${name}] \x1b[${color}mctx ${Math.round(pct)}%\x1b[0m${detail}\n`)
})
