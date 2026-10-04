const $ = (id) => document.getElementById(id)

function el(tag, cls, text) {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text !== undefined) n.textContent = text
  return n
}

function fmt(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`
  return String(n)
}

function ago(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return `hace ${s} s`
  if (s < 3600) return `hace ${Math.round(s / 60)} min`
  return `hace ${Math.round(s / 3600)} h`
}

function reset(ts) {
  const m = Math.max(0, Math.round((ts - Date.now()) / 60000))
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  return d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${m % 60} min` : `${m} min`
}

function bar(frac, lvl) {
  const b = el('div', 'bar')
  const i = el('i', lvl)
  i.style.width = `${Math.min(100, Math.max(0, frac * 100))}%`
  b.append(i)
  return b
}

function planCard(d) {
  const card = el('div', 'card')
  for (const [label, w] of [['Limite de 5 horas', d.plan.fiveHour], ['Semanal', d.plan.sevenDay]]) {
    if (!w) continue
    const lvl = level(w.pct, d.alertAt)
    const row = el('div', 'row')
    row.append(el('b', '', label), el('b', lvl, `${Math.round(w.pct)}%`))
    card.append(row, bar(w.pct / 100, lvl), el('div', 'sub', `Se restablece en ${reset(w.resetsAt)}`))
  }
  return card
}

function chatCard(c, alertAt) {
  const card = el('div', 'card')
  const lvl = level(c.context.pct, alertAt)
  card.append(el('b', '', c.title))
  const sub = el('div', 'sub', `${c.project} · ${c.model} · ${ago(c.lastTs)}`)
  if (c.activeSubagents > 0) sub.append(' · ', el('span', 'sa', `${c.activeSubagents} subagente${c.activeSubagents > 1 ? 's' : ''}`))
  card.append(sub, bar(c.context.pct, lvl))
  const row = el('div', 'row')
  const star = c.context.estimated ? '*' : ''
  row.append(el('span', 'sub', `${fmt(c.context.used)} / ${fmt(c.context.limit)}${star}`), el('span', `sub ${lvl}`, `${(c.context.pct * 100).toFixed(1)}%`))
  card.append(row)
  return card
}

async function render() {
  const root = $('root')
  try {
    const d = await fetchActive()
    $('today').textContent = `Hoy ${fmt(d.todayTokens)}`
    root.replaceChildren(planCard(d), ...d.chats.map((c) => chatCard(c, d.alertAt)))
    if (d.chats.length === 0) root.append(el('p', 'muted err', 'No hay chats activos.'))
  } catch {
    $('today').textContent = ''
    root.replaceChildren(el('p', 'muted err', 'No hay conexion con ClaudeHub. Abre la bandeja o ejecuta pnpm start.'))
  }
}

render()
setInterval(render, 5000)
