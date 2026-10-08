import { ActiveList, PlanLimits, ctxColor, untilText } from './Active'
import { useApi, type ActiveReport, type AgentLive, type AgentState, type PlanReport, type SourceId } from './api'
import { compact } from './format'

const SOURCE_NAME: Record<SourceId, string> = {
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini',
  omniroute: 'OmniRoute',
}

const SOURCE_COLOR: Record<SourceId, string> = {
  claude: 'var(--accent)',
  codex: 'var(--blue)',
  gemini: 'var(--violet)',
  omniroute: 'var(--ok)',
}

const STATE_LABEL: Record<AgentState, string> = {
  starting: 'iniciando',
  thinking: 'pensando',
  tool: 'usando herramienta',
  waiting: 'esperando permiso',
  done: 'listo',
  error: 'error',
}

/** "hace 12 s", "hace 5 min", "hace 2 h". */
function since(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 60) return `hace ${s} s`
  if (s < 3600) return `hace ${Math.round(s / 60)} min`
  return `hace ${Math.round(s / 3600)} h`
}

function CodexRow({ label, w, alertAt }: { label: string; w: { pct: number; resetsAt: number; tokens: number }; alertAt: number }) {
  const p = w.pct / 100
  return (
    <div className="plan-row" title={`${compact(w.tokens)} tokens de Codex en este equipo dentro de la ventana`}>
      <div className="plan-head">
        <span className="plan-label">{label}</span>
        <span className="plan-pct" style={{ color: ctxColor(p, alertAt) }}>
          {Math.round(w.pct)}%
        </span>
      </div>
      <div className="ctx-track">
        <i style={{ width: `${Math.max(2, w.pct)}%`, background: ctxColor(p, alertAt) }} />
      </div>
      <div className="active-meta">Se restablece en {untilText(w.resetsAt)}</div>
    </div>
  )
}

function CodexLimits({ plan, alertAt }: { plan: PlanReport | null; alertAt: number }) {
  if (!plan) return <p className="plan-hint">Codex: sin datos vigentes (se actualizan al usar Codex)</p>
  return (
    <section className="plan" aria-label="Limites de uso de Codex">
      {plan.planType && <div className="active-meta">Plan: {plan.planType}</div>}
      {plan.fiveHour && <CodexRow label="Limite de 5 horas" w={plan.fiveHour} alertAt={alertAt} />}
      {plan.sevenDay && <CodexRow label="Semanal" w={plan.sevenDay} alertAt={alertAt} />}
      {!plan.fiveHour && !plan.sevenDay && <div className="active-meta">Sin ventanas de limite vigentes.</div>}
    </section>
  )
}

function AgentsNow({ agents }: { agents: AgentLive[] }) {
  if (!agents.length) {
    return (
      <p className="plan-hint">
        Sin eventos de hooks. Instala el hook para ver estados en vivo. Consulta la seccion de hooks del README.
      </p>
    )
  }
  return (
    <ul className="agents-now">
      {agents.map((a) => (
        <li key={`${a.source}:${a.session}`}>
          <span className="src-tag" style={{ borderColor: SOURCE_COLOR[a.source] }}>
            <i className="dot" style={{ background: SOURCE_COLOR[a.source] }} />
            {SOURCE_NAME[a.source]}
          </span>
          <span className="agent-project" title={a.session}>
            {a.project}
          </span>
          <span className={`agent-state ${a.state}`}>
            {STATE_LABEL[a.state]}
            {a.state === 'tool' && a.tool ? `: ${a.tool}` : ''}
          </span>
          <span className="active-meta">{since(a.since)}</span>
          {a.stuck && (
            <span className="agent-stuck" role="alert">
              Posible bloqueo
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

export function AgentesView() {
  const { data, error } = useApi<ActiveReport>('/api/active', 4_000)
  if (!data) {
    return <div className="empty">{error ? `No se pudo cargar (${error}). Esta corriendo el servidor?` : 'Leyendo tus logs...'}</div>
  }
  const claudePlan = data.plans?.claude ?? data.plan
  const codexPlan = data.plans?.codex ?? null
  const agents = data.agents ?? []
  const collisions = data.collisions ?? []
  return (
    <>
      {collisions.map((c) => (
        <div className="plan-blocked collision" role="alert" key={c.project}>
          Dos agentes trabajan a la vez en <strong>{c.project}</strong>
        </div>
      ))}
      <h3>Limites del plan</h3>
      <div className="plan-sources">
        <div>
          <div className="plan-source-name">Claude</div>
          <PlanLimits plan={claudePlan} alertAt={data.alertAt} hint />
        </div>
        <div>
          <div className="plan-source-name">Codex</div>
          <CodexLimits plan={codexPlan} alertAt={data.alertAt} />
        </div>
      </div>
      <h3>Agentes ahora</h3>
      <AgentsNow agents={agents} />
      <h3>Chats activos de Claude</h3>
      <ActiveList chats={data.chats} alertAt={data.alertAt} />
      <p className="foot">
        * Limite de contexto estimado: los logs no lo declaran. Fijalo en la pestana Ajustes o activa la linea de estado de ClaudeHub para usar el valor real.
      </p>
    </>
  )
}
