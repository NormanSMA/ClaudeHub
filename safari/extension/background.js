// El service worker de Chromium no carga shared.js desde el manifiesto; Safari y Firefox si.
if (typeof importScripts === 'function') importScripts('shared.js')

// Safari y Firefox exponen "browser"; Chromium solo "chrome". Ambos devuelven promesas en MV3.
const api = globalThis.browser ?? globalThis.chrome
const COLORS = { ok: '#6fa58a', warn: '#e3a64b', danger: '#e0584a', off: '#9b978d' }

async function refresh() {
  try {
    const d = await fetchActive()
    const pct = d.plan && d.plan.fiveHour ? Math.round(d.plan.fiveHour.pct) : null
    if (pct === null) throw new Error('sin datos del plan')
    await api.action.setBadgeText({ text: `${pct}` })
    await api.action.setBadgeBackgroundColor({ color: COLORS[level(pct, d.alertAt)] })
    await api.action.setTitle({ title: `ClaudeHub: limite de 5 horas al ${pct}%` })
  } catch {
    await api.action.setBadgeText({ text: '--' })
    await api.action.setBadgeBackgroundColor({ color: COLORS.off })
    await api.action.setTitle({ title: 'ClaudeHub: sin conexion con el servidor local' })
  }
}

api.alarms.create('refresh', { periodInMinutes: 1 })
api.alarms.onAlarm.addListener((a) => a.name === 'refresh' && refresh())
api.runtime.onInstalled.addListener(refresh)
api.runtime.onStartup.addListener(refresh)
refresh()
