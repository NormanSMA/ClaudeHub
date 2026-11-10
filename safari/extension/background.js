// El service worker de Chromium no carga shared.js desde el manifiesto; Safari y Firefox si.
if (typeof importScripts === 'function') importScripts('shared.js')

// Safari y Firefox exponen "browser"; Chromium solo "chrome". Ambos devuelven promesas en MV3.
const api = globalThis.browser ?? globalThis.chrome
const COLORS = { ok: '#6fa58a', warn: '#e3a64b', danger: '#e0584a', off: '#9b978d' }

async function show(text, color, title) {
  await api.action.setBadgeText({ text })
  await api.action.setBadgeBackgroundColor({ color })
  await api.action.setTitle({ title })
}

async function refresh() {
  let d
  try {
    d = await fetchActive()
  } catch {
    return show('--', COLORS.off, 'ClaudeHub: sin conexion con el servidor local')
  }
  const plan = planOf(d)
  if (plan && plan.fiveHour) {
    const pct = Math.round(plan.fiveHour.pct)
    return show(`${pct}`, COLORS[level(pct, d.alertAt)], `ClaudeHub: limite de 5 horas al ${pct}%`)
  }
  // El servidor responde pero no hay plan: la insignia muestra los chats activos.
  const n = Array.isArray(d.chats) ? d.chats.length : 0
  return show(n > 0 ? `${n}` : '', COLORS.off, `ClaudeHub: sin datos del plan${n > 0 ? ` (${n} chats activos)` : ''}`)
}

api.alarms.create('refresh', { periodInMinutes: 1 })
api.alarms.onAlarm.addListener((a) => a.name === 'refresh' && refresh())
api.runtime.onInstalled.addListener(refresh)
api.runtime.onStartup.addListener(refresh)
refresh()
