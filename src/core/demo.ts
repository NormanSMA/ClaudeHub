import type { ScanResult } from './scan'
import type { Rec, SessionMeta } from './types'

// Datos ficticios para probar ClaudeHub sin leer tus logs: pnpm demo
// Son deterministas: mismos numeros en cada arranque. Los chats activos se calculan respecto a "ahora".

const DAY_MS = 86_400_000

function rng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Spec {
  id: string
  title: string
  project: string
  from: number // dias atras donde empieza
  to: number // dias atras donde termina (0 = hoy)
  model: string
  subagents?: boolean
  heavy?: number
}

const SONNET_5 = 'claude-sonnet-5'
const SONNET_55 = 'claude-sonnet-5-5'
const OPUS_5 = 'claude-opus-5'
const OPUS_55 = 'claude-opus-5-5'
const HAIKU = 'claude-haiku-4-5-20251001'

const SPECS: Spec[] = [
  { id: 'cafe-landing', title: 'Landing page para cafeteria', project: 'cafe-web', from: 70, to: 62, model: SONNET_5 },
  { id: 'inv-api', title: 'API de inventario con FastAPI', project: 'inventario-api', from: 61, to: 50, model: OPUS_5, subagents: true },
  { id: 'gym-app', title: 'App de rutinas de gimnasio', project: 'gym-app', from: 55, to: 40, model: SONNET_55, subagents: true, heavy: 1.4 },
  { id: 'portfolio', title: 'Portafolio personal con Astro', project: 'portafolio', from: 44, to: 36, model: SONNET_5 },
  { id: 'discord-bot', title: 'Bot de Discord para torneos', project: 'torneos-bot', from: 35, to: 0, model: SONNET_55, heavy: 1.2 },
  { id: 'sales-dash', title: 'Dashboard de ventas con graficos', project: 'ventas-dashboard', from: 30, to: 18, model: OPUS_55, subagents: true },
  { id: 'backup', title: 'Scripts de respaldo automatico', project: 'scripts-utils', from: 22, to: 15, model: HAIKU, heavy: 0.6 },
  { id: 'pay-refactor', title: 'Refactor del modulo de pagos', project: 'inventario-api', from: 14, to: 0, model: OPUS_55, subagents: true, heavy: 1.3 },
  { id: 'pg-migration', title: 'Migracion a PostgreSQL', project: 'ventas-dashboard', from: 12, to: 0, model: OPUS_5, subagents: true },
  { id: 'e2e', title: 'Tests end-to-end con Playwright', project: 'cafe-web', from: 9, to: 3, model: SONNET_55 },
  { id: 'docs', title: 'Documentacion tecnica del proyecto', project: 'portafolio', from: 6, to: 2, model: HAIKU, heavy: 0.5 },
]

const AGENTS = ['Explore', 'general-purpose', 'Plan']

// Uso de contexto de los chats activos (ultimo mensaje del orquestador)
const ACTIVE: Record<string, { ctx: number; agoMs: number; subagent?: boolean }> = {
  'pay-refactor': { ctx: 131_000, agoMs: 8_000 }, // ambar
  'discord-bot': { ctx: 188_000, agoMs: 3 * 60_000 }, // rojo, dispara alerta
  'pg-migration': { ctx: 310_000, agoMs: 40_000, subagent: true }, // verde, ventana de 1M
}

/** Limites del plan ficticios: 51% de la ventana de 5 h (se restablece en 3 h 54 min) y 33% de la semanal. */
export function demoPlanRaw(now = Date.now()) {
  return {
    fiveHour: { pct: 51, resetsAt: now + (3 * 60 + 54) * 60_000 },
    sevenDay: { pct: 33, resetsAt: now + (2 * 24 + 20) * 3_600_000 },
    updatedAt: now - 30_000,
  }
}

export function demoData(now = Date.now()): ScanResult {
  const rand = rng(20260930)
  const recs: Rec[] = []
  const sessions = new Map<string, SessionMeta>()
  let n = 0

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  for (const s of SPECS) {
    const sid = `demo-${s.id}`
    sessions.set(sid, { title: s.title, cwd: `C:\\dev\\${s.project}` })
    for (let d = s.from; d >= s.to; d--) {
      if (rand() > 0.78 && d !== s.to) continue
      const dayStart = today.getTime() - d * DAY_MS
      const count = Math.round((14 + rand() * 70) * (s.heavy ?? 1))
      for (let i = 0; i < count; i++) {
        const hour = Math.min(23, Math.max(7, 14 + (rand() + rand() + rand() - 1.5) * 5))
        const ts = Math.min(now - 10 * 60_000, dayStart + hour * 3_600_000)
        const ctx = 20_000 + Math.round(rand() * 150_000)
        recs.push({
          id: `demo-${n++}`,
          ts,
          model: s.model,
          input: 2 + Math.round(rand() * 40),
          cacheWrite: 400 + Math.round(rand() * 6_000),
          cacheRead: ctx,
          output: 150 + Math.round(rand() * 2_400),
          session: sid,
          project: s.project,
          role: 'orchestrator',
        })
      }
      if (s.subagents) {
        const subs = Math.round(rand() * 26)
        for (let i = 0; i < subs; i++) {
          const agent = AGENTS[Math.floor(rand() * rand() * AGENTS.length)]
          recs.push({
            id: `demo-${n++}`,
            ts: Math.min(now - 10 * 60_000, dayStart + (9 + rand() * 9) * 3_600_000),
            model: s.model,
            input: 2 + Math.round(rand() * 30),
            cacheWrite: 300 + Math.round(rand() * 3_000),
            cacheRead: 15_000 + Math.round(rand() * 70_000),
            output: 100 + Math.round(rand() * 1_800),
            session: sid,
            project: s.project,
            role: 'subagent',
            agent,
            agentFile: `agent-${s.id}-${d}-${Math.floor(i / 6)}`,
          })
        }
      }
    }
  }

  // chats activos: mensajes recientes con el contexto indicado
  for (const s of SPECS) {
    const a = ACTIVE[s.id]
    if (!a) continue
    const sid = `demo-${s.id}`
    const steps = 6
    for (let i = 0; i < steps; i++) {
      const ctx = Math.round(a.ctx * (0.9 + (0.1 * i) / (steps - 1)))
      recs.push({
        id: `demo-${n++}`,
        ts: now - a.agoMs - (steps - 1 - i) * 25_000,
        model: s.model,
        input: 6,
        cacheWrite: 1_200,
        cacheRead: Math.max(0, ctx - 1_206),
        output: 600 + Math.round(rand() * 900),
        session: sid,
        project: s.project,
        role: 'orchestrator',
      })
    }
    if (a.subagent) {
      recs.push({
        id: `demo-${n++}`,
        ts: now - 20_000,
        model: s.model,
        input: 4,
        cacheWrite: 900,
        cacheRead: 42_000,
        output: 700,
        session: sid,
        project: s.project,
        role: 'subagent',
        agent: 'Explore',
        agentFile: 'agent-live-1',
      })
    }
  }

  const other = demoOtherSources(now)
  const omni = demoOmniroute(now)
  recs.push(...other.recs, ...omni)
  const sources = {
    claude: { enabled: true, files: SPECS.length, records: recs.length - other.recs.length - omni.length, ok: true },
    codex: { enabled: true, files: other.codexFiles, records: other.codex, ok: true },
    gemini: { enabled: true, files: other.geminiFiles, records: other.gemini, ok: true },
    omniroute: { enabled: true, files: 1, records: omni.length, ok: true },
  }
  return { recs, sessions, limitHit: null, sources }
}

interface OtherSpec {
  id: string
  project: string
  from: number
  to: number
  model: string
}

const CODEX_SPECS: OtherSpec[] = [
  { id: 'codex-api', project: 'inventario-api', from: 26, to: 12, model: 'gpt-6.1-sol' },
  { id: 'codex-bot', project: 'torneos-bot', from: 10, to: 1, model: 'gpt-6-luna' },
  { id: 'codex-web', project: 'cafe-web', from: 5, to: 0, model: 'gpt-6.1-sol' },
]

const GEMINI_SPECS: OtherSpec[] = [
  { id: 'gemini-docs', project: 'portafolio', from: 20, to: 8, model: 'gemini-3-flash-preview' },
  { id: 'gemini-dash', project: 'ventas-dashboard', from: 7, to: 0, model: 'gemini-3-flash-preview' },
]

const OMNI_PROVIDERS = [
  { provider: 'antigravity', model: 'gemini-3-pro-preview', from: 14, to: 0 },
  { provider: 'groq', model: 'llama-4-70b', from: 9, to: 0 },
]

/** Registros ficticios de OmniRoute (proveedores antigravity y groq). Generador propio. */
function demoOmniroute(now: number): Rec[] {
  const rand = rng(20261008)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const recs: Rec[] = []
  for (const p of OMNI_PROVIDERS) {
    for (let d = p.from; d >= p.to; d--) {
      if (rand() > 0.7 && d !== p.to) continue
      const dayStart = today.getTime() - d * DAY_MS
      const count = Math.round(4 + rand() * 16)
      for (let i = 0; i < count; i++) {
        const hour = Math.min(23, Math.max(8, 14 + (rand() + rand() + rand() - 1.5) * 5))
        recs.push({
          id: `omniroute:demo-${recs.length}`,
          ts: Math.min(now - 10 * 60_000, dayStart + hour * 3_600_000),
          model: `${p.provider}/${p.model}`,
          input: 200 + Math.round(rand() * 3_000),
          cacheWrite: 0,
          cacheRead: Math.round(rand() * 8_000),
          output: 80 + Math.round(rand() * 1_200),
          session: `omniroute:${p.provider}`,
          project: p.provider,
          role: 'orchestrator',
          source: 'omniroute',
        })
      }
    }
  }
  return recs
}

/** Registros ficticios de Codex y Gemini. Usa su propio generador: los datos de Claude no cambian. */
function demoOtherSources(now: number) {
  const rand = rng(20261007)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const recs: Rec[] = []
  let codex = 0
  let gemini = 0
  const make = (specs: OtherSpec[], source: 'codex' | 'gemini') => {
    for (const s of specs) {
      const session = `demo-${s.id}`
      for (let d = s.from; d >= s.to; d--) {
        if (rand() > 0.7 && d !== s.to) continue
        const dayStart = today.getTime() - d * DAY_MS
        const count = Math.round(6 + rand() * 24)
        for (let i = 0; i < count; i++) {
          const hour = Math.min(23, Math.max(8, 15 + (rand() + rand() + rand() - 1.5) * 5))
          recs.push({
            id: `demo-${source}-${recs.length}`,
            ts: Math.min(now - 10 * 60_000, dayStart + hour * 3_600_000),
            model: s.model,
            input: 300 + Math.round(rand() * 5_000),
            cacheWrite: 0,
            cacheRead: 2_000 + Math.round(rand() * 40_000),
            output: 100 + Math.round(rand() * 1_800),
            session,
            project: s.project,
            role: 'orchestrator',
            source,
          })
          if (source === 'codex') codex++
          else gemini++
        }
      }
    }
  }
  make(CODEX_SPECS, 'codex')
  make(GEMINI_SPECS, 'gemini')
  return { recs, codex, gemini, codexFiles: CODEX_SPECS.length, geminiFiles: GEMINI_SPECS.length }
}
