import { ActiveList, PlanLimits, ctxColor, untilText } from '../components/Active'
import { useApi, type ActiveReport, type AgentLive, type AgentState, type PlanReport, type SourceId, type TokenLevel } from '../api'
import { compact, minutesText, pct } from '../format'
import { ArcGauge } from '../components/charts'

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

/** Cuatro tarjetas: nivel, ritmo, proyeccion y eficiencia de cache. Sin `level`, no se dibuja. */
function LevelCards({ level }: { level: TokenLevel }) {
  const basis = level.basis === 'plan5h' ? 'del limite de 5 horas' : 'del contexto'
  const burn = level.burnPerMin > 0
  return (
    <>
      <div className="level-cards">
        <div className={`level-card lv-${level.level}`}>
          <div className="stat-label">Nivel {level.level}</div>
          <div className="stat-value">{level.label}</div>
          <div className="stat-sub">
            {Math.round(level.pct)}% {basis}
          </div>
          <ArcGauge pct={level.pct} color="var(--lv)" />
          <div className="level-meter" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((n) => (
              <i key={n} className={n <= level.level ? 'on' : ''} />
            ))}
          </div>
        </div>
        <div className="level-card">
          <div className="stat-label">Ritmo</div>
          <div className="stat-value">{burn ? `${compact(level.burnPerMin)}/min` : '-'}</div>
          <div className="stat-sub">tokens por minuto</div>
        </div>
        <div className="level-card">
          <div className="stat-label">Proyeccion</div>
          <div className="stat-value">{level.minutesLeft === null ? '-' : minutesText(level.minutesLeft)}</div>
          <div className="stat-sub">
            {level.exhaustsBeforeReset === null
              ? 'sin estimacion'
              : level.exhaustsBeforeReset
                ? 'se agota antes del reinicio'
                : 'alcanza hasta el reinicio'}
          </div>
        </div>
        <div className="level-card">
          <div className="stat-label">Eficiencia de cache</div>
          <div className="stat-value">{pct(level.cacheEfficiency / 100)}</div>
          <div className="stat-sub">entrada leida desde cache</div>
        </div>
      </div>
      <p className="active-meta delegated">
        Tokens delegados (fuera del contexto del orquestador): <b>{pct(level.delegationShare)}</b>
      </p>
    </>
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
      {data.level && <LevelCards level={data.level} />}
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
