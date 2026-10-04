// Compartido entre el popup y el fondo. Solo habla con el servidor local de ClaudeHub.
const BASE = 'http://127.0.0.1:4317'

async function fetchActive() {
  const res = await fetch(`${BASE}/api/active`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// Mismos umbrales que el dashboard: verde, ambar desde 70 %, rojo desde alertAt.
function level(pct, alertAt = 0.85) {
  const f = pct > 1 ? pct / 100 : pct
  if (f >= alertAt) return 'danger'
  if (f >= 0.7) return 'warn'
  return 'ok'
}
