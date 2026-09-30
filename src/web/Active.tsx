import type { ActiveChat } from './api'
import { compact, pct } from './format'

export function ctxColor(p: number, alertAt = 0.85): string {
  return p >= alertAt ? 'var(--danger)' : p >= 0.6 ? 'var(--warn)' : 'var(--ok)'
}

export function ContextBar({ chat, alertAt = 0.85 }: { chat: ActiveChat; alertAt?: number }) {
  const c = chat.context
  return (
    <div
      className="ctx"
      title={`Contexto en uso: ${c.used.toLocaleString('es-MX')} de ${c.limit.toLocaleString('es-MX')} tokens (${
        c.source === 'statusline' ? 'limite real, de la linea de estado' : c.source === 'config' ? 'limite fijado en Ajustes' : 'limite estimado'
      })`}
    >
      <div className="ctx-track">
        <i style={{ width: `${Math.max(2, c.pct * 100)}%`, background: ctxColor(c.pct, alertAt) }} />
      </div>
      <div className="ctx-label">
        <span>
          {compact(c.used)} / {compact(c.limit)}
          {c.estimated ? '*' : ''}
        </span>
        <span>{pct(c.pct)}</span>
      </div>
    </div>
  )
}

function ago(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return `hace ${s} s`
  if (s < 3600) return `hace ${Math.round(s / 60)} min`
  return `hace ${Math.round(s / 3600)} h`
}

export function ActiveList({ chats, alertAt = 0.85, dense = false }: { chats: ActiveChat[]; alertAt?: number; dense?: boolean }) {
  if (!chats.length) return <div className="empty">Sin chats activos en los ultimos minutos</div>
  return (
    <ul className={`active ${dense ? 'dense' : ''}`}>
      {chats.map((c) => (
        <li key={c.session}>
          <div className="active-head">
            <i className={`live-dot ${c.working ? 'on' : ''}`} title={c.working ? 'Trabajando ahora' : 'En pausa'} />
            <span className="active-title" title={c.title}>
              {c.title}
            </span>
          </div>
          <div className="active-meta">
            {c.project} · {c.model} · {ago(c.lastTs)}
            {c.activeSubagents > 0 && <b> · {c.activeSubagents} subagente{c.activeSubagents > 1 ? 's' : ''}</b>}
          </div>
          <ContextBar chat={c} alertAt={alertAt} />
          {!dense && (
            <div className="active-meta">
              Sesion: {compact(c.tokens.total)} tokens (orquestador {compact(c.tokens.orchestrator)}, subagentes {compact(c.tokens.subagents)})
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
