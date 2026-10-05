const COLORS = { ok: '#6fa58a', warn: '#e3a64b', danger: '#e0584a', off: '#9b978d' }

async function refresh() {
  try {
    const d = await fetchActive()
    const pct = d.plan && d.plan.fiveHour ? Math.round(d.plan.fiveHour.pct) : null
    if (pct === null) throw new Error('sin datos del plan')
    await browser.action.setBadgeText({ text: `${pct}` })
    await browser.action.setBadgeBackgroundColor({ color: COLORS[level(pct, d.alertAt)] })
    await browser.action.setTitle({ title: `ClaudeHub: limite de 5 horas al ${pct}%` })
  } catch {
    await browser.action.setBadgeText({ text: '--' })
    await browser.action.setBadgeBackgroundColor({ color: COLORS.off })
    await browser.action.setTitle({ title: 'ClaudeHub: sin conexion con el servidor local' })
  }
}

browser.alarms.create('refresh', { periodInMinutes: 1 })
browser.alarms.onAlarm.addListener((a) => a.name === 'refresh' && refresh())
browser.runtime.onInstalled.addListener(refresh)
browser.runtime.onStartup.addListener(refresh)
refresh()
