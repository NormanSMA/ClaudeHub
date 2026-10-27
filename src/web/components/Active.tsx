import { useEffect, useState } from 'react'
import type { ActiveChat, ActiveReport, PlanReport, PlanWindow } from '../api'
import { compact, pct } from '../format'

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

/** Arbol del chat: orquestador y subagentes. Sin subagentes no se dibuja. */
export function SubagentTree({ chat }: { chat: ActiveChat }) {
  const subs = chat.subagents
  if (!subs?.length) return null
  const total = chat.tokens.total || 1
  const row = (key: string, name: string, tokens: number, color: string, working?: boolean) => (
    <li key={key}>
      <i className={`live-dot ${working ? 'on' : ''}`} aria-hidden="true" />
      <span className="tree-name" title={name}>
        {name}
      </span>
      <span className="tree-bar">
        <i style={{ width: `${Math.min(100, (tokens / total) * 100)}%`, background: color }} />
      </span>
      <span className="tree-val">{compact(tokens)}</span>
    </li>
  )
  return (
    <details className="tree">
      <summary>
        {subs.length} subagente{subs.length > 1 ? 's' : ''} · {compact(chat.tokens.subagents)} tokens
      </summary>
      <p className="active-meta">Tokens delegados (fuera del contexto del orquestador)</p>
      <ul>
        {row('orchestrator', 'Orquestador', chat.tokens.orchestrator, 'var(--accent)')}
        {subs.map((s) => row(s.file, s.agent ?? 'subagente', s.tokens, 'var(--blue)', s.working))}
      </ul>
    </details>
  )
}

function CompactAction({ chat }: { chat: ActiveChat }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2_000)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText('/compact')
      setError(false)
      setCopied(true)
    } catch {
      setError(true)
    }
  }

  return (
    <div className="compact-action">
      <button type="button" className="compact-btn" onClick={copy} disabled={copied} aria-live="polite">
        {copied ? 'Copiado' : 'Copiar /compact'}
      </button>
      <span className="active-meta" role="status">
        {error ? 'No se pudo copiar' : ''}
      </span>
      {chat.cacheReadPerM != null && (
        <div className="active-meta">~${((chat.context.used * chat.cacheReadPerM) / 1_000_000).toFixed(2)} por turno</div>
      )}
    </div>
  )
}

export function ActiveList({ chats, agents = [], alertAt = 0.85, dense = false }: {
  chats: ActiveChat[]
  agents?: ActiveReport['agents']
  alertAt?: number
  dense?: boolean
}) {
  if (!chats.length) return <div className="empty">Sin chats activos en los ultimos minutos</div>
  return (
    <ul className={`active ${dense ? 'dense' : ''}`}>
      {chats.map((c) => {
        const waiting = agents.some((a) => a.session === c.session && a.state === 'waiting')
        const state = waiting ? 'waiting' : c.working ? 'on' : 'paused'
        return (
          <li key={c.session}>
            <div className="active-head">
              <i className={`live-dot ${state}`} title={waiting ? 'Esperando permiso o respuesta' : c.working ? 'Trabajando ahora' : 'En pausa'} />
              <span className="active-title" title={c.title}>
                {c.title}
              </span>
            </div>
            <div className="active-meta">
              {c.project} · {c.model} · {ago(c.lastTs)}
              {c.activeSubagents > 0 && <b> · {c.activeSubagents} subagente{c.activeSubagents > 1 ? 's' : ''}</b>}
            </div>
            <ContextBar chat={c} alertAt={alertAt} />
            {c.context.pct >= 0.8 && <CompactAction chat={c} />}
            {!dense && (
              <div className="active-meta">
                Sesion: {compact(c.tokens.total)} tokens (orquestador {compact(c.tokens.orchestrator)}, subagentes {compact(c.tokens.subagents)})
              </div>
            )}
            {!dense && <SubagentTree chat={c} />}
          </li>
        )
      })}
    </ul>
  )
}

/** "3 h 54 min", "2 d 20 h", "45 min". */
export function untilText(resetsAt: number, now = Date.now()): string {
  const min = Math.max(0, Math.round((resetsAt - now) / 60_000))
  if (min < 1) return 'menos de 1 min'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h ${min % 60} min`
  return `${Math.floor(h / 24)} d ${h % 24} h`
}

function PlanRow({ label, w, alertAt, dense }: { label: string; w: PlanWindow; alertAt: number; dense: boolean }) {
  const p = w.pct / 100
  return (
    <div className="plan-row" title={`${compact(w.tokens)} tokens de Claude Code en este equipo dentro de la ventana`}>
      <div className="plan-head">
        <span className="plan-label">{label}</span>
        <span className="plan-pct" style={{ color: ctxColor(p, alertAt) }}>
          {Math.round(w.pct)}%
        </span>
      </div>
      <div className="ctx-track">
        <i style={{ width: `${Math.max(2, w.pct)}%`, background: ctxColor(p, alertAt) }} />
      </div>
      <div className="active-meta">
        Se restablece en {untilText(w.resetsAt)}
        {!dense && w.tokens > 0 && <> · {compact(w.tokens)} tokens de Claude Code en la ventana</>}
      </div>
    </div>
  )
}

const limitName = (type: string) => (type === 'five_hour' ? 'de 5 horas' : type === 'seven_day' ? 'semanal' : 'del plan')

/** Limites de uso del plan (5 horas y semanal). Sin datos, invita a activar la linea de estado. */
export function PlanLimits({ plan, alertAt = 0.85, dense = false, hint = false }: { plan: PlanReport | null; alertAt?: number; dense?: boolean; hint?: boolean }) {
  if (!plan) {
    return hint ? (
      <p className="plan-hint">
        Limites del plan: solo se leen cuando usas claude en una terminal con la linea de estado de ClaudeHub activa y la sesion iniciada (planes Pro y Max). La app de escritorio de Claude no la ejecuta. Si llegas a un limite, ClaudeHub te avisa igual.
      </p>
    ) : null
  }
  const ageMin = plan.updatedAt ? Math.round((Date.now() - plan.updatedAt) / 60_000) : 0
  return (
    <section className={`plan ${dense ? 'dense' : ''}`} aria-label="Limites de uso del plan">
      {plan.blocked && (
        <div className="plan-blocked" role="alert">
          <strong>Limite {limitName(plan.blocked.type)} alcanzado.</strong> Se restablece en {untilText(plan.blocked.resetsAt)}.
        </div>
      )}
      {plan.fiveHour && <PlanRow label="Limite de 5 horas" w={plan.fiveHour} alertAt={alertAt} dense={dense} />}
      {plan.sevenDay && <PlanRow label="Semanal" w={plan.sevenDay} alertAt={alertAt} dense={dense} />}
      {ageMin >= 15 && <div className="active-meta">Dato de hace {ageMin < 60 ? `${ageMin} min` : `${Math.round(ageMin / 60)} h`}: se actualiza al enviar un mensaje en Claude Code.</div>}
    </section>
  )
}
