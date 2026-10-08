#!/usr/bin/env node
// Guarda los limites del plan de Claude (5 horas y semanal) en rate-limits.json.
// Lo usa el comando /uso de Claude Code despues de llamar a get_usage.
//
// Uso:
//   node write-limits.cjs --five 51 --five-reset 2026-10-07T18:00:00Z --seven 33 --seven-reset 2026-10-12T09:00:00Z
//
// Cada reset acepta una fecha ISO o milisegundos desde 1970.
// Una ventana ausente conserva la guardada mientras no haya expirado (igual que statusline.cjs).

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

const PLAN_FILE = process.env.CLAUDEHUB_PLAN || path.join(dataDir(), 'rate-limits.json')

function fail(message) {
  process.stderr.write('write-limits: ' + message + '\n')
  process.exit(1)
}

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

const FLAGS = new Set(['--five', '--five-reset', '--seven', '--seven-reset'])

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i]
    if (!FLAGS.has(flag)) fail('argumento desconocido: ' + flag)
    if (argv[i + 1] === undefined) fail('falta el valor de ' + flag)
    out[flag.slice(2)] = argv[i + 1]
  }
  return out
}

function parsePct(text, name) {
  if (typeof text !== 'string' || text.trim() === '') fail(name + ' vacio')
  const n = Number(text)
  if (!Number.isFinite(n) || n < 0 || n > 100) fail(name + ' debe estar entre 0 y 100: ' + text)
  return n
}

function parseReset(text, name) {
  if (typeof text !== 'string' || text.trim() === '') fail(name + ' vacio')
  const raw = text.trim()
  const ms = /^\d+(\.\d+)?$/.test(raw) ? Math.round(Number(raw)) : Date.parse(raw)
  if (!Number.isFinite(ms) || ms <= 0) fail(name + ' no es una fecha ISO ni milisegundos: ' + text)
  return ms
}

/** Convierte un par de argumentos a { pct, resetsAt en ms }, o null si la ventana no se indico. */
function windowFrom(args, key) {
  const pct = args[key]
  const reset = args[key + '-reset']
  if (pct === undefined && reset === undefined) return null
  if (pct === undefined || reset === undefined) fail('--' + key + ' y --' + key + '-reset van juntos')
  return { pct: parsePct(pct, '--' + key), resetsAt: parseReset(reset, '--' + key + '-reset') }
}

const args = parseArgs(process.argv.slice(2))
const now = Date.now()
const prev = readJson(PLAN_FILE)
const next = { fiveHour: windowFrom(args, 'five'), sevenDay: windowFrom(args, 'seven'), updatedAt: now }
// una ventana ausente conserva la anterior mientras no haya expirado
for (const k of ['fiveHour', 'sevenDay']) {
  if (!next[k] && prev[k] && prev[k].resetsAt > now) next[k] = prev[k]
}
if (!next.fiveHour && !next.sevenDay) fail('indica al menos una ventana (--five/--five-reset o --seven/--seven-reset)')

try {
  writeJson(PLAN_FILE, next)
} catch (err) {
  fail('no se pudo escribir ' + PLAN_FILE + ': ' + (err && err.message))
}

const show = (w) => (w ? Math.round(w.pct) + '% (reinicia ' + new Date(w.resetsAt).toISOString() + ')' : 'sin datos')
process.stdout.write('Limites guardados. 5h: ' + show(next.fiveHour) + ' | 7d: ' + show(next.sevenDay) + '\n')
