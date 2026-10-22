import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { dataDir } from './paths'
import type { Price } from './pricing'

export interface HubConfig {
  /** Limite de contexto por nombre de modelo, p. ej. { "Opus 5": 1000000 } */
  contextLimits: Record<string, number>
  /** Minutos sin actividad para dejar de considerar activo un chat */
  activeMinutes: number
  /** Fraccion de contexto que dispara la alerta */
  alertAt: number
  /** Nombre para el saludo de la interfaz. Vacio: saludo sin nombre */
  name: string
  /** Fuentes adicionales a Claude que se leen */
  sources: { codex: boolean; gemini: boolean; omniroute: boolean }
  /** Acceso a la base de OmniRoute: nombre del contenedor Docker y ruta opcional de storage.sqlite */
  omniroute: { container: string; dbPath: string }
  /** Consulta GitHub Releases para avisar de versiones nuevas. Con false no hay peticiones de red */
  checkUpdates: boolean
  /** Ajustes de tarifas por nombre visible y proveedores gratuitos. */
  pricing: { overrides: Record<string, Partial<Price>>; freeProviders: string[] }
  /** Modalidad de facturacion. */
  billing: 'subscription' | 'api'
}

export const DEFAULTS: HubConfig = {
  contextLimits: {},
  activeMinutes: 20,
  alertAt: 0.85,
  name: '',
  sources: { codex: true, gemini: true, omniroute: false },
  omniroute: { container: 'omniroute', dbPath: '' },
  checkUpdates: true,
  pricing: { overrides: {}, freeProviders: [] },
  billing: 'subscription',
}
const FILE = process.env.CLAUDEHUB_CONFIG ?? join(dataDir(), 'config.json')

export const configPath = () => FILE

const clamp = (n: unknown, min: number, max: number, fallback: number) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback

/** Deja solo campos conocidos y valores razonables. Nunca lanza. */
export function sanitize(raw: unknown): HubConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const limits: Record<string, number> = {}
  if (r.contextLimits && typeof r.contextLimits === 'object') {
    for (const [model, v] of Object.entries(r.contextLimits as Record<string, unknown>)) {
      if (model.length <= 60 && typeof v === 'number' && Number.isFinite(v) && v >= 10_000 && v <= 10_000_000) {
        limits[model] = Math.round(v)
      }
    }
  }
  const src = (r.sources && typeof r.sources === 'object' ? r.sources : {}) as Record<string, unknown>
  const omni = (r.omniroute && typeof r.omniroute === 'object' ? r.omniroute : {}) as Record<string, unknown>
  const pricing = (r.pricing && typeof r.pricing === 'object' ? r.pricing : {}) as Record<string, unknown>
  const overrides: [string, Partial<Price>][] = []
  const fields: (keyof Price)[] = ['input', 'output', 'cacheWrite', 'cacheWrite1h', 'cacheRead']
  if (pricing.overrides && typeof pricing.overrides === 'object' && !Array.isArray(pricing.overrides)) {
    for (const [model, value] of Object.entries(pricing.overrides)) {
      if (overrides.length >= 50) break
      if (!model.length || model.length > 80 || !value || typeof value !== 'object' || Array.isArray(value)) continue
      const p: Partial<Price> = {}
      for (const field of fields) {
        const v = (value as Record<string, unknown>)[field]
        if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1000) p[field] = v
      }
      if (Object.keys(p).length) overrides.push([model, p])
    }
  }
  const freeProviders = Array.isArray(pricing.freeProviders)
    ? pricing.freeProviders.filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 80).slice(0, 50)
    : []
  const flag = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
  return {
    contextLimits: limits,
    activeMinutes: Math.round(clamp(r.activeMinutes, 1, 240, DEFAULTS.activeMinutes)),
    alertAt: Math.round(clamp(r.alertAt, 0.5, 0.99, DEFAULTS.alertAt) * 100) / 100,
    // eslint-disable-next-line no-control-regex
    name: typeof r.name === 'string' ? r.name.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40) : '',
    sources: {
      codex: flag(src.codex, DEFAULTS.sources.codex),
      gemini: flag(src.gemini, DEFAULTS.sources.gemini),
      omniroute: flag(src.omniroute, DEFAULTS.sources.omniroute),
    },
    omniroute: {
      container:
        typeof omni.container === 'string' && /^[\w.-]{1,64}$/.test(omni.container)
          ? omni.container
          : DEFAULTS.omniroute.container,
      // eslint-disable-next-line no-control-regex
      dbPath: typeof omni.dbPath === 'string' ? omni.dbPath.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 260) : '',
    },
    checkUpdates: flag(r.checkUpdates, DEFAULTS.checkUpdates),
    pricing: { overrides: Object.fromEntries(overrides), freeProviders },
    billing: r.billing === 'api' || r.billing === 'subscription' ? r.billing : DEFAULTS.billing,
  }
}

let memo: { at: number; cfg: HubConfig } | null = null
let defaultsOnly = false

/** Modo demo: ignora por completo el config.json del usuario. */
export function useDefaultsOnly(): void {
  defaultsOnly = true
}

/** Lee config.json (opcional). Se relee cada 10 s. */
export function config(): HubConfig {
  if (defaultsOnly) return DEFAULTS
  if (memo && Date.now() - memo.at < 10_000) return memo.cfg
  let cfg = DEFAULTS
  try {
    cfg = sanitize(JSON.parse(readFileSync(FILE, 'utf8')))
  } catch {
    /* sin archivo o invalido: valores por defecto */
  }
  memo = { at: Date.now(), cfg }
  return cfg
}

/** Valida y guarda la configuracion de forma atomica. Devuelve lo guardado. */
export function saveConfig(raw: unknown): HubConfig {
  const cfg = sanitize(raw)
  mkdirSync(dirname(FILE), { recursive: true })
  const tmp = `${FILE}.tmp`
  writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n')
  renameSync(tmp, FILE)
  memo = { at: Date.now(), cfg }
  return cfg
}
