import { pickMascotState } from './mascotState'
import { useEffect, useMemo, useState } from 'react'
import { AgentesView } from './Agentes'
import {
  useApi,
  useLiveStatus,
  type ActiveReport,
  type ConfigInfo,
  type Live,
  type ModelsReport,
  type ProjectRow,
  type RolesReport,
  type SessionRow,
  type SourceId,
  type SourcesReport,
  type Summary,
} from './api'
import { Heatmap, PALETTE, SplitBar, StackedBars, fillDays } from './charts'
import { compact, dateLabel, hourLabel, int, pct } from './format'
import { Mascot, type MascotState } from './Mascot'
import { SettingsView } from './Settings'
import { useSort } from './sort'

type Tab = 'agentes' | 'resumen' | 'modelos' | 'sesiones' | 'proyectos' | 'ajustes'
type RangeId = 'all' | '30d' | '7d' | 'custom'

const TABS: { id: Tab; label: string }[] = [
  { id: 'agentes', label: 'Agentes' },
  { id: 'resumen', label: 'Resumen' },
  { id: 'modelos', label: 'Modelos' },
  { id: 'sesiones', label: 'Sesiones' },
  { id: 'proyectos', label: 'Proyectos' },
  { id: 'ajustes', label: 'Ajustes' },
]

const RANGES: { id: RangeId; label: string }[] = [
  { id: 'all', label: 'Todo' },
  { id: '30d', label: '30d' },
  { id: '7d', label: '7d' },
  { id: 'custom', label: 'Fechas' },
]

type SourceFilter = 'all' | SourceId

const SOURCES: { id: SourceFilter; label: string; color: string }[] = [
  { id: 'all', label: 'Todas', color: 'var(--muted)' },
  { id: 'claude', label: 'Claude', color: 'var(--accent)' },
  { id: 'codex', label: 'Codex', color: 'var(--blue)' },
  { id: 'gemini', label: 'Gemini', color: 'var(--violet)' },
  { id: 'omniroute', label: 'OmniRoute', color: 'var(--ok)' },
]

const SOURCE_KEY = 'source'

function loadSource(): SourceFilter {
  try {
    const v = localStorage.getItem(SOURCE_KEY)
    return SOURCES.find((s) => s.id === v)?.id ?? 'all'
  } catch {
    return 'all'
  }
}

function saveSource(id: SourceFilter) {
  try {
    localStorage.setItem(SOURCE_KEY, id)
  } catch {
    /* sin almacenamiento */
  }
}

/** Texto del atributo title de un chip de fuente; vacio si la fuente esta sana. */
function sourceHint(info: SourcesReport[SourceId] | undefined): string | undefined {
  if (!info) return undefined
  if (info.reason) return info.reason
  if (!info.enabled) return 'Fuente desactivada'
  if (!info.ok) return 'La fuente no se pudo leer'
  return undefined
}

function SourceChips({
  source,
  onChange,
  report,
}: {
  source: SourceFilter
  onChange: (id: SourceFilter) => void
  report: SourcesReport | null
}) {
  return (
    <div className="sources" role="group" aria-label="Fuente">
      {SOURCES.map((s) => {
        const info = s.id === 'all' ? undefined : report?.[s.id]
        const dim = info ? !info.enabled || !info.ok : false
        return (
          <button
            key={s.id}
            type="button"
            className={`chip${source === s.id ? ' on' : ''}${dim ? ' dim' : ''}`}
            aria-pressed={source === s.id}
            title={sourceHint(info)}
            onClick={() => onChange(s.id)}
          >
            <i className="dot" style={{ background: s.color }} />
            {s.label}
            {info && <span className="chip-count">{int(info.records)}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ~38.9k tokens, la longitud aproximada de "Rebelion en la granja"
const BOOK_TOKENS = 38_918

function Loading({ error }: { error: string | null }) {
  return <div className="empty">{error ? `No se pudo cargar (${error}). Esta corriendo el servidor?` : 'Leyendo tus logs...'}</div>
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat" title={hint}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  )
}

function ResumenView({ q, qClaude }: { q: string; qClaude: string }) {
  const { data, error } = useApi<Summary>(`/api/summary?${q}`)
  if (!data) return <Loading error={error} />
  const t = data.tokens
  return (
    <>
      <div className="stats">
        <Stat label="Sesiones" value={int(data.sessions)} />
        <Stat label="Mensajes" value={int(data.messages)} hint="Respuestas del modelo, sin duplicados" />
        <Stat label="Tokens totales" value={compact(t.total)} hint="Entrada + cache + salida" />
        <Stat label="Dias activos" value={int(data.activeDays)} />
        <Stat label="Hora pico" value={hourLabel(data.peakHour)} />
        <Stat label="Modelo favorito" value={data.favoriteModel ?? '-'} />
      </div>
      <Heatmap days={data.heatmap} />
      <p className="note">Usaste ~{int(Math.round(t.total / BOOK_TOKENS))}x mas tokens que Rebelion en la granja.</p>
      <div className="stats small">
        <Stat label="Entrada" value={compact(t.input)} />
        <Stat label="Escritura de cache" value={compact(t.cacheWrite)} />
        <Stat label="Lectura de cache" value={compact(t.cacheRead)} />
        <Stat label="Salida" value={compact(t.output)} />
        <Stat
          label="Aciertos de cache"
          value={pct(t.cacheRead / Math.max(1, t.input + t.cacheWrite + t.cacheRead))}
          hint="Parte de la entrada que se leyo desde cache"
        />
      </div>
      <h3 className="section-title">Orquestador vs subagentes (solo Claude)</h3>
      <RolesView q={qClaude} />
    </>
  )
}

type ModelRow = ModelsReport['models'][number]

const MODEL_SORTS: { id: string; label: string; get: (m: ModelRow) => string | number }[] = [
  { id: 'total', label: 'Tokens', get: (m) => m.total },
  { id: 'input', label: 'Entrada', get: (m) => m.input },
  { id: 'output', label: 'Salida', get: (m) => m.output },
  { id: 'model', label: 'Nombre', get: (m) => m.model },
]

function ModelosView({ q }: { q: string }) {
  const { data, error } = useApi<ModelsReport>(`/api/models?${q}`)
  const [more, setMore] = useState(false)
  const [sortId, setSortId] = useState('total')
  const [desc, setDesc] = useState(true)
  const ordered = useMemo(() => {
    const get = MODEL_SORTS.find((s) => s.id === sortId)!.get
    const m = desc ? -1 : 1
    return [...(data?.models ?? [])].sort((a, b) => {
      const x = get(a)
      const y = get(b)
      return (typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y, 'es') : Number(x) - Number(y)) * m
    })
  }, [data, sortId, desc])
  if (!data) return <Loading error={error} />
  const names = data.models.map((m) => m.model)
  const color = (m: string) => PALETTE[names.indexOf(m) % PALETTE.length]
  const series = names.map((k) => ({ key: k, color: color(k) })).reverse()
  const rows = fillDays(
    data.daily.map((d) => ({ day: d.day, values: d.byModel })),
    (day) => ({ day, values: {} }),
  )
  const shown = more ? ordered : ordered.slice(0, 6)
  return (
    <>
      <StackedBars data={rows} series={series} />
      <div className="legend-tools">
        <label htmlFor="model-sort">Ordenar por</label>
        <select
          id="model-sort"
          value={sortId}
          onChange={(e) => {
            setSortId(e.target.value)
            setDesc(e.target.value !== 'model')
          }}
        >
          {MODEL_SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button className="link" onClick={() => setDesc(!desc)} title="Invertir orden">
          {desc ? 'Mayor a menor' : 'Menor a mayor'}
        </button>
      </div>
      <ul className="legend">
        {shown.map((m) => (
          <li key={m.model}>
            <i style={{ background: color(m.model) }} />
            <span className="name">{m.model}</span>
            <span className="detail">
              {compact(m.input)} entrada · {compact(m.output)} salida
            </span>
            <span className="share">{pct(m.share)}</span>
          </li>
        ))}
      </ul>
      {ordered.length > 6 && (
        <button className="link" onClick={() => setMore(!more)}>
          {more ? 'Mostrar menos' : `Mostrar ${ordered.length - 6} mas`}
        </button>
      )}
    </>
  )
}

type AgentRow = RolesReport['agents'][number]

function RolesView({ q }: { q: string }) {
  const { data, error } = useApi<RolesReport>(`/api/roles?${q}`)
  const agents = useMemo(() => data?.agents ?? [], [data])
  const { sorted, th } = useSort<AgentRow>(
    agents,
    { agent: (a) => a.agent, messages: (a) => a.messages, output: (a) => a.output, total: (a) => a.total },
    'total',
  )
  if (!data) return <Loading error={error} />
  const rows = fillDays(
    data.daily.map((d) => ({ day: d.day, values: { Orquestador: d.orchestrator, Subagentes: d.subagent } })),
    (day) => ({ day, values: {} as Record<string, number> }),
  )
  const o = data.orchestrator
  const s = data.subagent
  return (
    <>
      <div className="stats two">
        <div className="stat role">
          <div className="stat-label">
            <i className="dot" style={{ background: 'var(--accent)' }} /> Orquestador
          </div>
          <div className="stat-value">{compact(o.total)}</div>
          <div className="stat-sub">
            {pct(o.share)} · {int(o.messages)} mensajes · salida {compact(o.output)}
          </div>
        </div>
        <div className="stat role">
          <div className="stat-label">
            <i className="dot" style={{ background: 'var(--blue)' }} /> Subagentes
          </div>
          <div className="stat-value">{compact(s.total)}</div>
          <div className="stat-sub">
            {pct(s.share)} · {int(s.messages)} mensajes · salida {compact(s.output)}
          </div>
        </div>
      </div>
      <StackedBars
        data={rows}
        series={[
          { key: 'Orquestador', color: 'var(--accent)' },
          { key: 'Subagentes', color: 'var(--blue)' },
        ]}
      />
      <h3>Subagentes por tipo</h3>
      {sorted.length === 0 ? (
        <div className="empty">No hubo subagentes en este rango</div>
      ) : (
        <table>
          <thead>
            <tr>
              {th('agent', 'Tipo')}
              {th('messages', 'Mensajes', true)}
              {th('output', 'Salida', true)}
              {th('total', 'Tokens', true)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => (
              <tr key={a.agent}>
                <td>{a.agent}</td>
                <td className="num">{int(a.messages)}</td>
                <td className="num">{compact(a.output)}</td>
                <td className="num">{compact(a.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

function SesionesView({ q }: { q: string }) {
  const { data, error } = useApi<SessionRow[]>(`/api/sessions?${q}`)
  const [text, setText] = useState('')
  const [project, setProject] = useState('')
  const all = useMemo(() => data ?? [], [data])
  const projects = useMemo(() => [...new Set(all.map((s) => s.project))].sort((a, b) => a.localeCompare(b, 'es')), [all])
  const rows = useMemo(() => {
    const needle = text.trim().toLowerCase()
    return all.filter(
      (s) => (!project || s.project === project) && (!needle || (s.title + ' ' + s.project).toLowerCase().includes(needle)),
    )
  }, [all, text, project])
  const { sorted, th } = useSort<SessionRow>(
    rows,
    {
      title: (s) => s.title,
      last: (s) => s.last,
      split: (s) => s.sub / (s.total || 1),
      messages: (s) => s.messages,
      total: (s) => s.total,
    },
    'total',
  )
  if (!data) return <Loading error={error} />
  return (
    <>
      <div className="filters">
        <input
          className="search"
          type="search"
          placeholder="Buscar por titulo o proyecto"
          aria-label="Buscar sesiones"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <select aria-label="Filtrar por proyecto" value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="">Todos los proyectos</option>
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <table>
        <thead>
          <tr>
            {th('title', 'Chat')}
            {th('last', 'Ultimo uso')}
            {th('split', 'Reparto')}
            {th('messages', 'Mensajes', true)}
            {th('total', 'Tokens', true)}
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr key={s.session}>
              <td className="title" title={`${s.title} - ${s.project} (${s.session.slice(0, 8)})`}>
                {s.title}
                <div className="active-meta">{s.project}</div>
              </td>
              <td>{dateLabel(s.last)}</td>
              <td>
                <SplitBar a={s.orch} b={s.sub} />
              </td>
              <td className="num">{int(s.messages)}</td>
              <td className="num">{compact(s.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && <div className="empty">Ningun chat coincide con los filtros</div>}
    </>
  )
}

function ProyectosView({ q }: { q: string }) {
  const { data, error } = useApi<ProjectRow[]>(`/api/projects?${q}`)
  const all = useMemo(() => data ?? [], [data])
  const { sorted, th } = useSort<ProjectRow>(
    all,
    { project: (p) => p.project, split: (p) => p.sub / (p.total || 1), sessions: (p) => p.sessions, total: (p) => p.total },
    'total',
  )
  if (!data) return <Loading error={error} />
  return (
    <table>
      <thead>
        <tr>
          {th('project', 'Proyecto')}
          {th('split', 'Reparto')}
          {th('sessions', 'Sesiones', true)}
          {th('total', 'Tokens', true)}
        </tr>
      </thead>
      <tbody>
        {sorted.map((p) => (
          <tr key={p.project}>
            <td>{p.project}</td>
            <td>
              <SplitBar a={p.orch} b={p.sub} />
            </td>
            <td className="num">{int(p.sessions)}</td>
            <td className="num">{compact(p.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState<string>(() => {
    const forced = new URLSearchParams(location.search).get('theme')
    if (forced === 'dark' || forced === 'light') return forced
    try {
      return localStorage.getItem('theme') ?? 'auto'
    } catch {
      return 'auto'
    }
  })
  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* sin almacenamiento */
    }
  }, [theme])
  const next = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto'
  return [theme, () => setTheme(next)]
}

/** Arma la query del API: ?range=... o ?from=...&to=... (fechas locales, ambas incluidas). */
function rangeQuery(range: RangeId, from: string, to: string): string {
  if (range !== 'custom') return `range=${range}`
  const [a, b] = from && to && from > to ? [to, from] : [from, to]
  const p = new URLSearchParams()
  if (a) p.set('from', a)
  if (b) p.set('to', b)
  return p.toString() || 'range=all'
}

/** Agrega `source=<valor>` a la query; con 'all' se omite. */
function withSource(q: string, source: SourceFilter): string {
  return source === 'all' ? q : `${q}&source=${source}`
}

/** La pestana vive en el hash (#/modelos) para poder compartir o enlazar una vista. */
function tabFromHash(): Tab {
  const id = location.hash.replace(/^#\/?/, '')
  if (id === 'roles') return 'resumen'
  if (id === 'activos') return 'agentes'
  return TABS.find((t) => t.id === id)?.id ?? 'agentes'
}

export function App() {
  const [tab, setTabState] = useState<Tab>(tabFromHash)
  const setTab = (t: Tab) => {
    setTabState(t)
    history.replaceState(null, '', `#/${t}`)
  }
  const { data: cfg } = useApi<ConfigInfo>('/api/config', 600_000)
  const [range, setRange] = useState<RangeId>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [source, setSourceState] = useState<SourceFilter>(loadSource)
  const setSource = (id: SourceFilter) => {
    setSourceState(id)
    saveSource(id)
  }
  const { data: sources } = useApi<SourcesReport>('/api/sources')
  const [theme, cycleTheme] = useTheme()
  const liveStatus = useLiveStatus()
  const { data: live } = useApi<Live>('/api/live', 5_000)
  const { data: act } = useApi<ActiveReport>('/api/active', 5_000)
  const mood: MascotState = pickMascotState(act)
  const q = rangeQuery(range, from, to)
  const qs = withSource(q, source)
  const claudeOnly = tab === 'agentes'
  return (
    <main>
      <header className="greeting">
        <Mascot state={mood} size={56} />
        <h1>Que sigue{cfg?.name ? `, ${cfg.name}` : ''}?</h1>
        <span className="today" title="Tokens de hoy">
          {live ? `Hoy ${compact(live.todayTokens)}` : ''}
        </span>
        <span
          className={`live-state ${liveStatus}`}
          title={
            liveStatus === 'live'
              ? 'En vivo: el servidor avisa al instante cuando hay datos nuevos.'
              : 'Sondeo: la pantalla consulta los datos cada pocos segundos.'
          }
        >
          <span className="live-dot" aria-hidden="true" />
          {liveStatus === 'live' ? 'En vivo' : 'Sondeo'}
        </span>
        <button className="link" onClick={cycleTheme} title="Cambiar tema">
          Tema: {theme === 'auto' ? 'auto' : theme === 'light' ? 'claro' : 'oscuro'}
        </button>
      </header>
      {cfg?.demo && <p className="demo-banner">Modo demo: todos los datos son ficticios.</p>}
      <section className="card">
        <div className="bar">
          <nav className="tabs" aria-label="Secciones">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </nav>
          {tab !== 'agentes' && tab !== 'ajustes' && (
            <div className="tabs ranges" aria-label="Rango">
              {RANGES.map((r) => (
                <button key={r.id} className={range === r.id ? 'on' : ''} onClick={() => setRange(r.id)}>
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {tab !== 'ajustes' &&
          (claudeOnly ? null : (
            <SourceChips source={source} onChange={setSource} report={sources} />
          ))}
        {tab !== 'agentes' && tab !== 'ajustes' && range === 'custom' && (
          <div className="dates">
            <label htmlFor="d-from">Desde</label>
            <input id="d-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            <label htmlFor="d-to">Hasta</label>
            <input id="d-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            {(from || to) && (
              <button
                className="link"
                onClick={() => {
                  setFrom('')
                  setTo('')
                }}
              >
                Limpiar
              </button>
            )}
          </div>
        )}
        {tab === 'agentes' && <AgentesView />}
        {tab === 'resumen' && <ResumenView q={qs} qClaude={q} />}
        {tab === 'modelos' && <ModelosView q={qs} />}
        {tab === 'sesiones' && <SesionesView q={qs} />}
        {tab === 'proyectos' && <ProyectosView q={qs} />}
        {tab === 'ajustes' && <SettingsView />}
      </section>
    </main>
  )
}
