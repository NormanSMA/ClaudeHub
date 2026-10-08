import { agentStates, collisions, mascotState, type EventSource, type HookEvent, type HookState, type MascotState } from './agents'
import { codexPlanReport, type PlanReport } from './plan'
import type { CodexRateLimits } from './sources/codex'
import type { Rec } from './types'

/** Estado de una sesion en la forma publica de la API: sin huella de carpeta ni rutas. */
export interface PublicAgent {
  source: EventSource
  /** Primeros 8 caracteres del id de sesion. */
  session: string
  project: string
  state: HookState
  since: number
  tool: string
  stuck: boolean
}

export interface PublicCollision {
  project: string
  sessions: { source: EventSource; session: string }[]
  since: number
}

export interface ActiveExtras {
  plans: { claude: PlanReport | null; codex: PlanReport | null }
  agents: PublicAgent[]
  collisions: PublicCollision[]
  mascot: MascotState
}

export interface ActiveExtrasInput {
  claudePlan: PlanReport | null
  recs: Rec[]
  codexLimits: CodexRateLimits | null
  events: HookEvent[]
  now: number
}

const SESSION_CHARS = 8
const shortId = (session: string): string => session.slice(0, SESSION_CHARS)

/** Campos extra de /api/active: planes por fuente, agentes, choques y estado de la mascota. */
export function activeExtras({ claudePlan, recs, codexLimits, events, now }: ActiveExtrasInput): ActiveExtras {
  const states = agentStates(events, now)
  const clashes = collisions(states, now)
  return {
    plans: { claude: claudePlan, codex: codexPlanReport(codexLimits, recs, now) },
    agents: states.map((s) => ({
      source: s.source,
      session: shortId(s.session),
      project: s.project,
      state: s.state,
      since: s.since,
      tool: s.tool,
      stuck: s.stuck,
    })),
    collisions: clashes.map((c) => ({
      project: c.project,
      sessions: c.sessions.map((s) => ({ source: s.source, session: shortId(s.session) })),
      since: c.since,
    })),
    mascot: mascotState(states, clashes, now),
  }
}
