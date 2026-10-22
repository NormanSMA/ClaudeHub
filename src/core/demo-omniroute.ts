import { rng } from './demo'
import type { OmniCall } from './sources/omniroute'

const DAY_MS = 86_400_000

interface Route {
  provider: string
  model: string
  calls: number
  ms: number
  fail: number
}

// Los mismos proveedores y modelos de los registros ficticios de demo.ts
const ROUTES: Route[] = [
  { provider: 'antigravity', model: 'gemini-3-pro-preview', calls: 90, ms: 4200, fail: 0.2 },
  { provider: 'groq', model: 'llama-4-70b', calls: 70, ms: 700, fail: 0.02 },
  { provider: 'gemini', model: 'gemini-3-flash-preview', calls: 40, ms: 1400, fail: 0.07 },
]

function demoCall(route: Route, rand: () => number, now: number): OmniCall {
  const failed = rand() < route.fail
  const status = failed ? (rand() < 0.8 ? 429 : 502) : 200
  return {
    ts: now - Math.round(rand() * rand() * 14 * DAY_MS) - 60_000,
    provider: route.provider,
    model: route.model,
    status,
    ok: !failed,
    latencyMs: Math.round(route.ms * (0.5 + rand())),
    tokens: failed ? 0 : 200 + Math.round(rand() * 6_000),
  }
}

/** Llamadas ficticias de OmniRoute para el modo demo. Determinista: mismos numeros en cada arranque. */
export function demoOmniroute(now = Date.now()): OmniCall[] {
  const rand = rng(20261021)
  return ROUTES.flatMap((route) => Array.from({ length: route.calls }, () => demoCall(route, rand, now)))
}
