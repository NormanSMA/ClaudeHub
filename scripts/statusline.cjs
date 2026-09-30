#!/usr/bin/env node
// Linea de estado de Claude Code para ClaudeHub (opcional).
// Hace tres cosas:
//   1. Guarda el tamano REAL de la ventana de contexto de cada sesion (context-windows.json),
//      para que ClaudeHub deje de estimarlo.
//   2. Guarda los limites de uso de tu plan, el de 5 horas y el semanal (rate-limits.json).
//      Claude Code solo los envia a suscriptores Pro y Max.
//   3. Imprime una linea corta para la barra de estado: [Modelo] ctx 43% (86k/200k) | 5h 51% | 7d 33%
//
// Claude Code envia un JSON por stdin con session_id, model, context_window y rate_limits.
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
const PLAN_FILE = process.env.CLAUDEHUB_PLAN || path.join(dataDir(), 'rate-limits.json')
const MAX_ENTRIES = 500
const MAX_AGE_MS = 30 * 86_400_000
const REFRESH_MS = 10 * 60_000
const PLAN_REFRESH_MS = 60_000

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = file + '.' + process.pid + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data))
  fs.renameSync(tmp, file)
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) || {}
  } catch {
    return {}
  }
}

function record(sessionId, size, model) {
  const data = readJson(FILE)
  const now = Date.now()
  const prev = data[sessionId]
  // evita escribir en cada refresco: solo si cambia el tamano o pasaron 10 minutos
  if (prev && prev.size === size && now - prev.ts < REFRESH_MS) return
  data[sessionId] = { size, model, ts: now }
  const entries = Object.entries(data)
    .filter(([, v]) => v && now - v.ts < MAX_AGE_MS)
    .sort((a, b) => b[1].ts - a[1].ts)
    .slice(0, MAX_ENTRIES)
  writeJson(FILE, Object.fromEntries(entries))
}

/** Convierte una ventana de Claude Code ({ used_percentage, resets_at en segundos }) a { pct, resetsAt en ms }. */
function planWindow(w) {
  if (!w || typeof w.used_percentage !== 'number' || typeof w.resets_at !== 'number') return null
  if (!Number.isFinite(w.used_percentage) || !Number.isFinite(w.resets_at)) return null
  return { pct: Math.min(100, Math.max(0, w.used_percentage)), resetsAt: Math.round(w.resets_at * 1000) }
}

function recordPlan(limits) {
  const now = Date.now()
  const prev = readJson(PLAN_FILE)
  const next = { fiveHour: planWindow(limits.five_hour), sevenDay: planWindow(limits.seven_day), updatedAt: now }
  // una ventana ausente en esta llamada conserva la anterior mientras no haya expirado
  for (const k of ['fiveHour', 'sevenDay']) {
    if (!next[k] && prev[k] && prev[k].resetsAt > now) next[k] = prev[k]
  }
  if (!next.fiveHour && !next.sevenDay) return
  const same = (a, b) => (!a && !b) || (a && b && a.pct === b.pct && a.resetsAt === b.resetsAt)
  // evita escribir en cada refresco: solo si cambia algo o pasaron 60 segundos
  if (same(next.fiveHour, prev.fiveHour) && same(next.sevenDay, prev.sevenDay) && now - (prev.updatedAt || 0) < PLAN_REFRESH_MS) return
  writeJson(PLAN_FILE, next)
}

function compact(n) {
  return n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n)
}

const color = (pct) => (pct >= 85 ? '31' : pct >= 60 ? '33' : '32')

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
    if (j.rate_limits && typeof j.rate_limits === 'object') recordPlan(j.rate_limits)
  } catch {
    // la linea de estado nunca debe fallar por no poder guardar
  }

  const u = cw.current_usage
  const used = u ? (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0) : null
  const pct = typeof cw.used_percentage === 'number' ? cw.used_percentage : used !== null && size > 0 ? (used / size) * 100 : null
  const name = (j.model && (j.model.display_name || j.model.id)) || 'Claude'

  const parts = [`[${name}]`]
  if (pct !== null) {
    const detail = used !== null && size > 0 ? ` (${compact(used)}/${compact(size)})` : ''
    parts.push(`\x1b[${color(pct)}mctx ${Math.round(pct)}%\x1b[0m${detail}`)
  }
  const rl = j.rate_limits || {}
  const five = planWindow(rl.five_hour)
  const seven = planWindow(rl.seven_day)
  const plan = []
  if (five) plan.push(`\x1b[${color(five.pct)}m5h ${Math.round(five.pct)}%\x1b[0m`)
  if (seven) plan.push(`\x1b[${color(seven.pct)}m7d ${Math.round(seven.pct)}%\x1b[0m`)
  process.stdout.write(parts.join(' ') + (plan.length ? ' | ' + plan.join(' | ') : '') + '\n')
})
