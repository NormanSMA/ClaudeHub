#!/usr/bin/env node
// Hook de estado de ClaudeHub para Claude Code y Codex (opcional).
// Anota cada evento en events.jsonl (carpeta de datos), una linea JSON por evento:
//   {v:1,ts,source,session,event,state,tool,cwd}
// Reglas de seguridad: sale siempre con codigo 0, no escribe en stdout ni stderr
// y termina en menos de 1 s. Una salida o el codigo 2 podrian bloquear al agente.
// Nunca guarda el prompt, tool_input ni la salida de las herramientas.
//
// Uso: node hook.cjs [claude|codex]   (el JSON del evento llega por stdin)

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const MAX_LINE = 512
const MAX_FILE = 256 * 1024
const MAX_WAIT_MS = 800

// Mapa evento a estado. Un evento desconocido no se anota.
const STATES = {
  SessionStart: 'starting',
  UserPromptSubmit: 'thinking',
  PreToolUse: 'tool',
  PostToolUse: 'thinking',
  PermissionRequest: 'waiting',
  PermissionDenied: 'thinking',
  PostToolUseFailure: 'error',
  StopFailure: 'error',
  Stop: 'done',
  SessionEnd: 'idle',
}

// Misma logica que src/core/paths.ts
function dataDir() {
  if (process.env.CLAUDEHUB_DATA) return process.env.CLAUDEHUB_DATA
  if (process.platform === 'win32') return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'ClaudeHub')
  if (process.platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'ClaudeHub')
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'ClaudeHub')
}

/** Devuelve el texto recortado a n caracteres, o '' si no es texto. */
function clip(value, n) {
  return typeof value === 'string' ? value.slice(0, n) : ''
}

/** Arma la linea de evento y la acorta hasta que no pase de 512 bytes. */
function buildLine(source, j) {
  const event = clip(j.hook_event_name, 40)
  const state = Object.prototype.hasOwnProperty.call(STATES, event) ? STATES[event] : null
  if (!state) return null
  const rec = {
    v: 1,
    ts: Date.now(),
    source,
    session: clip(j.session_id, 64),
    event,
    state,
    tool: clip(j.tool_name, 64),
    cwd: clip(j.cwd, 260),
  }
  let line = JSON.stringify(rec)
  // recorta cwd y tool hasta cumplir el limite de bytes
  while (Buffer.byteLength(line) + 1 > MAX_LINE && (rec.cwd.length > 0 || rec.tool.length > 0)) {
    if (rec.cwd.length > 0) rec.cwd = rec.cwd.slice(0, Math.max(0, rec.cwd.length - 20))
    else rec.tool = rec.tool.slice(0, Math.max(0, rec.tool.length - 10))
    line = JSON.stringify(rec)
  }
  return Buffer.byteLength(line) + 1 > MAX_LINE ? null : line + '\n'
}

function record(source, input) {
  const j = JSON.parse(input)
  if (!j || typeof j !== 'object') return
  const line = buildLine(source, j)
  if (!line) return
  const dir = dataDir()
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 'events.jsonl')
  try {
    // rota a events.1.jsonl al pasar de 256 KB
    if (fs.statSync(file).size > MAX_FILE) fs.renameSync(file, path.join(dir, 'events.1.jsonl'))
  } catch {
    // el archivo aun no existe o otro proceso ya lo roto
  }
  fs.appendFileSync(file, line)
}

function main() {
  // pase lo que pase, el proceso termina con codigo 0 y sin salida
  const done = () => process.exit(0)
  process.on('uncaughtException', done)
  process.on('unhandledRejection', done)
  // tope de tiempo aun con stdin abierto, vacio o roto
  setTimeout(done, MAX_WAIT_MS)

  const source = process.argv[2] === 'codex' ? 'codex' : 'claude'
  let input = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (d) => {
    // ignora entradas desmesuradas
    if (input.length < 1_000_000) input += d
  })
  process.stdin.on('error', done)
  process.stdin.on('end', () => {
    try {
      record(source, input)
    } catch {
      // un hook nunca debe fallar ni molestar al agente
    }
    done()
  })
}

try {
  main()
} catch {
  process.exit(0)
}
