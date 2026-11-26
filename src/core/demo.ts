import type { ScanResult } from './scan'
import type { Rec, SessionMeta } from './types'
import type { HookEvent } from './agents'
import type { CodexRateLimits } from './sources/codex'
import type { AntigravityQuotas } from './sources/antigravity'
import { VERSION, RELEASES_PREFIX, type UpdateInfo } from './update'

// Datos ficticios para probar ClaudeHub sin leer tus logs: pnpm demo
// Son deterministas: mismos numeros en cada arranque. Los chats activos se calculan respecto a "ahora".

const DAY_MS = 86_400_000

export function rng(seed: number) {
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

/** Eventos de hooks ficticios: una sesion de Claude usando una herramienta y una de Codex pensando. */
export function demoEvents(now = Date.now()): HookEvent[] {
  return [
    { v: 1, ts: now - 40_000, source: 'claude', session: 'demo0001-pay-refactor', event: 'UserPromptSubmit', state: 'thinking', tool: '', cwd: 'C:\\dev\\inventario-api' },
    { v: 1, ts: now - 6_000, source: 'claude', session: 'demo0001-pay-refactor', event: 'PreToolUse', state: 'tool', tool: 'Edit', cwd: 'C:\\dev\\inventario-api' },
    { v: 1, ts: now - 25_000, source: 'codex', session: 'demo0002-codex-web', event: 'UserPromptSubmit', state: 'thinking', tool: '', cwd: 'C:\\dev\\cafe-web' },
  ]
}

/** Limites ficticios de Codex: 30% de la ventana de 5 h y 12% de la semanal. resetsAt en segundos. */
export function demoCodexLimits(now = Date.now()): CodexRateLimits {
  return {
    ts: now - 20_000,
    planType: 'plus',
    primary: { usedPercent: 30, windowMinutes: 300, resetsAt: Math.floor((now + (2 * 60 + 10) * 60_000) / 1000) },
    secondary: { usedPercent: 12, windowMinutes: 10080, resetsAt: Math.floor((now + 5 * 86_400_000) / 1000) },
  }
}

/** Cuotas ficticias de Antigravity con tres grupos de modelos. */
export function demoAntigravityQuotas(now = Date.now()): AntigravityQuotas {
  return {
    updatedAt: now - 15_000,
    groups: [
      {
        id: 'claude-5.5',
        label: 'Claude 5.5',
        usedPct: 0,
        remainingPct: 100,
        resetsAt: now + (4 * 60 + 30) * 60_000,
        models: ['Opus 5.5', 'Sonnet 5.5'],
      },
      {
        id: 'gemini-4-hydrogen-3.8',
        label: 'Gemini 4 Hydrogen / 3.8',
        usedPct: 12,
        remainingPct: 88,
        resetsAt: now + (3 * 60 + 15) * 60_000,
        models: ['Gemini 4 Hydrogen', 'Gemini 3.8 Flash'],
      },
      {
        id: 'gemini-4-argon',
        label: 'Gemini 4 Argon',
        usedPct: 0,
        remainingPct: 100,
        resetsAt: now + (4 * 60 + 45) * 60_000,
        models: ['Gemini 4 Argon'],
      },
    ],
  }
}

/** Aviso ficticio de version nueva: la actual con el menor subido. Sin red. */
export function demoUpdate(now = Date.now()): UpdateInfo {
  const [major, minor] = VERSION.split('.').map(Number)
  const latest = `${major}.${minor + 1}.0`
  return {
    enabled: true,
    current: VERSION,
    latest,
    available: true,
    url: `${RELEASES_PREFIX}tag/v${latest}`,
    name: `ClaudeHub ${latest}`,
    notes: ['Mascota con animacion de anuncio', 'Aviso cuando hay una version nueva', 'Interruptor para buscar versiones en Ajustes'],
    checkedAt: now,
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
  const opencode = demoOpencode(now)
  const loom = demoLoom(now)
  recs.push(...other.recs, ...omni, ...opencode, ...loom)
  const claudeCount = recs.length - other.recs.length - omni.length - opencode.length - loom.length
  const sources = {
    claude: { enabled: true, files: SPECS.length, records: claudeCount, ok: true },
    codex: { enabled: true, files: other.codexFiles, records: other.codex, ok: true },
    gemini: { enabled: true, files: other.geminiFiles, records: other.gemini, ok: true },
    omniroute: { enabled: true, files: 1, records: omni.length, ok: true },
    antigravity: { enabled: true, files: other.antigravityFiles, records: other.antigravity, ok: true },
    opencode: { enabled: true, files: 1, records: opencode.length, ok: true },
    loom: { enabled: true, files: 1, records: loom.length, ok: true },
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

const ANTIGRAVITY_SPECS: OtherSpec[] = [
  { id: 'agy-api', project: 'inventario-api', from: 15, to: 2, model: 'gemini-4-hydrogen' },
  { id: 'agy-web', project: 'cafe-web', from: 8, to: 0, model: 'gemini-4-argon' },
]

const OMNI_PROVIDERS = [
  { provider: 'antigravity', model: 'gemini-3-pro-preview', from: 14, to: 0 },
  { provider: 'groq', model: 'llama-4-70b', from: 9, to: 0 },
  { provider: 'gemini', model: 'gemini-3-flash-preview', from: 6, to: 0 },
]

/** Registros ficticios de OmniRoute (proveedores antigravity, groq y gemini). Generador propio. */
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
          model: p.model,
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

/** Registros ficticios de Codex, Gemini y Antigravity. Usa su propio generador: los datos de Claude no cambian. */
function demoOtherSources(now: number) {
  const rand = rng(20261007)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const recs: Rec[] = []
  let codex = 0
  let gemini = 0
  let antigravity = 0
  const make = (specs: OtherSpec[], source: 'antigravity' | 'codex' | 'gemini') => {
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
          else if (source === 'gemini') gemini++
          else antigravity++
        }
      }
    }
  }
  make(CODEX_SPECS, 'codex')
  make(GEMINI_SPECS, 'gemini')
  make(ANTIGRAVITY_SPECS, 'antigravity')
  const live = (source: 'codex' | 'antigravity', session: string, project: string, model: string, cacheRead: number) => {
    for (let i = 0; i < 3; i++) {
      recs.push({
        id: `demo-${source}-live-${i}-${session}`,
        ts: now - 45_000 - (2 - i) * 20_000,
        model,
        input: 400,
        cacheWrite: 0,
        cacheRead: cacheRead - (2 - i) * 2_000,
        output: 500,
        session,
        project,
        role: 'orchestrator',
        source,
      })
      if (source === 'codex') codex++
      else antigravity++
    }
  }
  live('codex', 'demo-codex-web', 'cafe-web', 'gpt-6.1-sol', 84_000)
  live('antigravity', 'demo-agy-web', 'cafe-web', 'gemini-4-hydrogen', 112_000)
  return {
    recs,
    codex,
    gemini,
    antigravity,
    codexFiles: CODEX_SPECS.length,
    geminiFiles: GEMINI_SPECS.length,
    antigravityFiles: ANTIGRAVITY_SPECS.length,
  }
}

/** Registros ficticios de OpenCode (incluye subagentes). Generador propio. */
function demoOpencode(now: number): Rec[] {
  const rand = rng(20261125)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const recs: Rec[] = []
  for (let d = 7; d >= 0; d--) {
    const dayStart = today.getTime() - d * DAY_MS
    const count = 4 + Math.round(rand() * 8)
    for (let i = 0; i < count; i++) {
      const sub = rand() > 0.65
      recs.push({
        id: `opencode:demo-${recs.length}`,
        ts: Math.min(now - 10 * 60_000, dayStart + (9 + rand() * 10) * 3_600_000),
        model: sub ? 'gemini-3.8-flash' : 'deepseek-v4-pro',
        input: 400 + Math.round(rand() * 2_000),
        cacheWrite: 0,
        cacheRead: 2_000 + Math.round(rand() * 12_000),
        output: 120 + Math.round(rand() * 600),
        session: `oc-demo-${d}`,
        project: 'inventario-api',
        role: sub ? 'subagent' : 'orchestrator',
        ...(sub ? { agent: 'explore', agentFile: `oc-sub-${d}` } : {}),
        source: 'opencode',
      })
    }
  }
  return recs
}

/** Registros ficticios de Loom (orquestador y subagentes). Generador propio. */
function demoLoom(now: number): Rec[] {
  const rand = rng(20261126)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const recs: Rec[] = []
  for (let d = 5; d >= 0; d--) {
    const dayStart = today.getTime() - d * DAY_MS
    const count = 3 + Math.round(rand() * 6)
    for (let i = 0; i < count; i++) {
      const sub = rand() > 0.45
      recs.push({
        id: `loom:demo-${recs.length}`,
        ts: Math.min(now - 10 * 60_000, dayStart + (10 + rand() * 9) * 3_600_000),
        model: sub ? 'gpt-6.1-sol' : 'claude-sonnet-5-5',
        input: 350 + Math.round(rand() * 1_800),
        cacheWrite: 150,
        cacheRead: 1_500 + Math.round(rand() * 10_000),
        output: 180 + Math.round(rand() * 800),
        session: `msn-demo-${d}`,
        project: 'Loom',
        role: sub ? 'subagent' : 'orchestrator',
        ...(sub ? { agent: 'implementer', agentFile: `msn-demo-${d}-sub` } : {}),
        source: 'loom',
      })
    }
  }
  return recs
}
