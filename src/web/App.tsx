import { levelFrom, pickMascotState } from './mascot/mascotState'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { animationsOn, setAnimations } from './components/AnimatedNumber'
import { AgentesView } from './views/Agentes'
import { ModelosView } from './views/Modelos'
import { ProyectosView } from './views/Proyectos'
import { ResumenView } from './views/Resumen'
import { SesionesView } from './views/Sesiones'
import {
  useApi,
  useLiveStatus,
  type ActiveReport,
  type ConfigInfo,
  type Live,
  type ModelsReport,
  type SourcesReport,
} from './api'
import { Mascot, type MascotState } from './mascot/Mascot'
import { SpeechBubble } from './mascot/SpeechBubble'
import { loadSpeechMemory, pickLine, saveSpeechMemory, type SpeechLine, type SpeechMemory } from './mascot/mascotSpeech'
import { SettingsView } from './views/Ajustes'
import { TodayCount } from './components/TodayCount'
import { SourceChips, loadSource, saveSource, type SourceFilter } from './components/SourceChips'
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

function useTheme(): [string, (origin?: { x: number; y: number }) => void] {
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
  const change = (origin?: { x: number; y: number }) => {
    const root = document.documentElement
    const animate =
      typeof document.startViewTransition === 'function' &&
      animationsOn() &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!animate) {
      setTheme(next)
      return
    }
    root.style.setProperty('--vt-x', `${origin?.x ?? window.innerWidth - 40}px`)
    root.style.setProperty('--vt-y', `${origin?.y ?? 24}px`)
    document.startViewTransition(() => flushSync(() => setTheme(next)))
  }
  return [theme, change]
}

/** Barra de pestañas: la pildora se estira hacia la pestaña nueva y una segunda sigue al puntero. */
function AnimatedTabs<T extends string>({ items, active, onSelect }: { items: { id: T; label: string }[]; active: T; onSelect: (id: T) => void }) {
  const navRef = useRef<HTMLElement | null>(null)
  const [pill, setPill] = useState({ left: 0, right: 0, width: 0, dir: 'right' })
  const [hover, setHover] = useState<{ left: number; width: number } | null>(null)
  const prev = useRef(0)
  useLayoutEffect(() => {
    const measure = () => {
      const btn = navRef.current?.querySelector<HTMLButtonElement>('button.on')
      if (!btn) return
      const moved = btn.offsetLeft - prev.current
      prev.current = btn.offsetLeft
      const nav = navRef.current!
      setPill((o) => ({ left: btn.offsetLeft, right: nav.clientWidth - btn.offsetLeft - btn.offsetWidth, width: btn.offsetWidth, dir: moved > 0 ? 'right' : moved < 0 ? 'left' : o.dir }))
    }
    measure()
    void document.fonts?.ready.then(measure)
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [active])
  return (
    <nav ref={navRef} className="tabs tabs-sliding" aria-label="Secciones" onMouseLeave={() => setHover(null)}>
      <span className="tab-pill-hover" style={{ transform: `translateX(${hover?.left ?? pill.left}px)`, width: hover?.width ?? pill.width, opacity: hover ? 1 : 0 }} aria-hidden="true" />
      <span className={`tab-pill-indicator to-${pill.dir}`} style={{ left: pill.left, right: pill.right }} aria-hidden="true" />
      {items.map((t) => (
        <button
          key={t.id}
          className={active === t.id ? 'on' : ''}
          onClick={() => onSelect(t.id)}
          onMouseEnter={(e) => setHover({ left: e.currentTarget.offsetLeft, width: e.currentTarget.offsetWidth })}
        >
          {t.label}
        </button>
      ))}
    </nav>
  )
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

function HeaderMascot({ act, live, cfg, omniEnabled }: {
  act: ActiveReport | null
  live: Live | null
  cfg: ConfigInfo | null
  omniEnabled: boolean | undefined
}) {
  const memory = useRef<SpeechMemory | null>(null)
  const [line, setLine] = useState<SpeechLine | null>(null)
  const [talking, setTalking] = useState(false)
  const [omniFailures, setOmniFailures] = useState<number>()

  useEffect(() => {
    setOmniFailures(undefined)
    if (!omniEnabled) return
    const controller = new AbortController()
    const load = async () => {
      if (document.hidden) return
      try {
        const response = await fetch('/api/models?source=omniroute&range=7d', { signal: controller.signal })
        if (!response.ok) return
        const report: ModelsReport = await response.json()
        if (!controller.signal.aborted) {
          setOmniFailures(report.models.reduce((n, model) => n + (model.via?.e429 ?? 0) + (model.via?.e5xx ?? 0), 0))
        }
      } catch {
        /* conserva la última lectura hasta el siguiente sondeo */
      }
    }
    void load()
    const timer = setInterval(() => void load(), 300_000)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [omniEnabled])

  useEffect(() => {
    if (!cfg || !act || !live) return
    const result = pickLine({
      mascot: cfg.mascot ?? { talk: true, talkCooldownMin: 10 },
      chats: act.chats,
      level: act.level,
      todayFresh: live.todayFresh,
      todayCostUsd: live.todayCostUsd,
      omniFailures: omniEnabled === false ? null : omniFailures,
    }, memory.current ?? loadSpeechMemory(), Date.now())
    memory.current = result.memory
    saveSpeechMemory(result.memory)
    if (cfg.mascot?.talk === false) setLine(null)
    else if (result.line) setLine(result.line)
  }, [act, live, cfg, omniEnabled, omniFailures])

  return (
    <div className="header-mascot">
      <Mascot state={pickMascotState(act)} size={56} level={levelFrom(act)?.level} talking={talking} />
      {line && cfg?.mascot?.talk !== false && (
        <SpeechBubble key={line.id} text={line.text} onTyping={setTalking} onDone={() => setLine(null)} />
      )}
    </div>
  )
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
  useEffect(() => setAnimations(animationsOn()), [])
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
        <HeaderMascot act={act} live={live} cfg={cfg} omniEnabled={sources?.omniroute.enabled} />
        <h1>Que sigue{cfg?.name ? `, ${cfg.name}` : ''}?</h1>
        <TodayCount data={live} className="today" />
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
        <button
          className="link"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            cycleTheme({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
          }}
          title="Cambiar tema"
        >
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
          <AnimatedTabs items={TABS} active={tab} onSelect={setTab} />
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
        {tab === 'resumen' && <ResumenView q={qs} qClaude={q} billing={cfg?.billing ?? 'subscription'} />}
        {tab === 'modelos' && <ModelosView q={qs} billing={cfg?.billing ?? 'subscription'} />}
        {tab === 'sesiones' && <SesionesView q={qs} billing={cfg?.billing ?? 'subscription'} />}
        {tab === 'proyectos' && <ProyectosView q={qs} billing={cfg?.billing ?? 'subscription'} />}
        {tab === 'ajustes' && <SettingsView />}
      </section>
      <DashboardFooter />
    </main>
  )
}

function DashboardFooter() {
  const { data } = useApi<{ current: string }>('/api/update', 30 * 60_000)
  return (
    <footer className="dashboard-footer">
      {data && <span className="version-badge" aria-label={`Versión de ClaudeHub: ${data.current}`}>v{data.current}</span>}
    </footer>
  )
}
