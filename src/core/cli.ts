import { scan } from './scan'
import { summary, rolesReport, modelsReport, activeReport, sessionsReport } from './aggregate'

const t0 = Date.now()
const { recs, sessions } = scan()
const s = summary(recs, 'all')
console.log(`registros: ${recs.length}  (${Date.now() - t0} ms)`)
console.log('sesiones:', s.sessions, ' mensajes:', s.messages, ' dias activos:', s.activeDays)
console.log('tokens:', s.tokens, ' pico:', s.peakHour, ' favorito:', s.favoriteModel)
const r = rolesReport(recs, 'all')
console.log('orquestador:', r.orchestrator.total, (r.orchestrator.share * 100).toFixed(1) + '%')
console.log('subagentes:', r.subagent.total, (r.subagent.share * 100).toFixed(1) + '%')
console.table(modelsReport(recs, 'all').models.map((m) => ({ ...m, share: (m.share * 100).toFixed(1) + '%' })))
console.table(r.agents.slice(0, 8))

console.log('chats activos (20 min):')
console.table(activeReport(recs, sessions).map((a) => ({ titulo: a.title, modelo: a.model, ctx: a.context.used, limite: a.context.limit, pct: (a.context.pct * 100).toFixed(0) + '%', subs: a.activeSubagents })))
const all = sessionsReport(recs, sessions, 'all', 1000)
console.log('sesiones sin titulo personalizado:', all.filter((x) => x.title === 'Sin titulo').length, 'de', all.length)
console.table(all.slice(0, 8).map((x) => ({ titulo: x.title, proyecto: x.project, total: x.total })))
