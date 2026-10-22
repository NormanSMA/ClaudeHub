import { levelFrom, pickMascotState } from './mascotState'
import { useEffect, useMemo, useState } from 'react'
import { AgentesView } from './Agentes'
import { Loading } from './Loading'
import { ModelosView } from './Modelos'
import {
  useApi,
  useLiveStatus,
  type ActiveReport,
  type ConfigInfo,
  type Live,
  type ProjectRow,
  type RolesReport,
  type SessionRow,
  type SourcesReport,
  type Summary,
} from './api'
import { CategoryBar, Heatmap, SplitBar, StackedBars, fillDays } from './charts'
import { compact, dateLabel, hourLabel, int, pct } from './format'
import { Mascot, type MascotState } from './Mascot'
import { SettingsView } from './Settings'
import { SourceChips, loadSource, saveSource, type SourceFilter } from './SourceChips'
import { useSort } from './sort'
import { balloonText, useUpdateNotice } from './update'

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

// ~38.9k tokens, la longitud aproximada de "Rebelion en la granja"
const BOOK_TOKENS = 38_918

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
      <div className="stats two">
        <Stat
          label="Eficiencia de cache"
          value={pct(t.cacheRead / Math.max(1, t.input + t.cacheWrite + t.cacheRead))}
          hint="Parte de la entrada que se leyo desde cache"
        />
        <Stat label="Salida visible" value={compact(Math.max(0, t.output - (t.reasoning ?? 0)))} hint="Salida sin pensamiento" />
      </div>
      <CategoryBar tokens={t} />
      <h3 className="section-title">Orquestador vs subagentes (solo Claude)</h3>
      <RolesView q={qClaude} />
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
  const { info: update, dismiss: dismissUpdate } = useUpdateNotice()
  const q =rangeQuery(range, from, to)
  const qs = withSource(q, source)
  const claudeOnly = tab === 'agentes'
  return (
    <main>
      <header className="greeting">
        <Mascot state={mood} size={56} level={levelFrom(act)?.level} />
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
      {update?.url && (
        <section className="update-banner" role="status" aria-label="Versión nueva">
          <Mascot state={mood} size={40} announce />
          <div className="update-body">
            <p>{balloonText(update)}</p>
            {update.notes.length > 0 && (
              <ul>
                {update.notes.slice(0, 3).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="update-actions">
            <a className="update-btn" href={update.url} target="_blank" rel="noopener noreferrer">
              Descargar
            </a>
            <button className="link" onClick={dismissUpdate}>
              Luego
            </button>
          </div>
        </section>
      )}
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
