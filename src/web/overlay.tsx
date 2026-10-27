import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { ActiveList, PlanLimits } from './components/Active'
import { useApi, type ActiveReport, type ConfigInfo, type Live, type OverlayMode, type SettingsInfo } from './api'
import { ChispaCanvas, type ChispaEmote } from './mascot/ChispaCanvas'
import { TodayCount } from './components/TodayCount'
import { CodexBadge, LevelBadge, Mascot } from './mascot/Mascot'
import { codexBusy, exhaustText, levelFrom, levelText, pickMascotState, type MascotState } from './mascot/mascotState'
import { balloonText, useUpdateNotice } from './update'
import { SpeechBubble } from './mascot/SpeechBubble'
import { loadSpeechMemory, pickLine, saveSpeechMemory, type SpeechLine } from './mascot/mascotSpeech'
import './style.css'
import './overlay.css'

interface HubBridge {
  dragBy(dx: number, dy: number): void
  resize(width: number, height: number): void
  openDashboard(): void
  hide(): void
  openExternal?(url: string): void
  setMode?(mode: OverlayMode): void
  onCursor?(cb: (x: number, y: number) => void): () => void
}
const hub = typeof window === 'undefined' ? undefined : (window as unknown as { hub?: HubBridge }).hub

const COLLAPSED_W = 68
const BALLOON_W = 220
const EXPANDED_W = 360

export function isPetting(times: number[], now: number): boolean {
  return times.filter((time) => time <= now && now - time <= 1_500).length >= 3
}

export function clickAction(clicks: number, wasDragged: boolean): 'none' | 'toggle' | 'dashboard' {
  if (wasDragged || clicks < 1) return 'none'
  return clicks >= 2 ? 'dashboard' : 'toggle'
}

function Overlay() {
  const [open, setOpen] = useState(location.hash === '#open')
  const { data } = useApi<ActiveReport>('/api/active', 4_000)
  const { data: cfg } = useApi<ConfigInfo>('/api/config', 60_000)
  const { data: live } = useApi<Live>('/api/live', 5_000)
  const [line, setLine] = useState<SpeechLine | null>(null)
  const [talking, setTalking] = useState(false)
  const [petted, setPetted] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const dragged = useRef(false)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const petTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const passes = useRef<number[]>([])

  const chats = data?.chats ?? []
  const alertAt = data?.alertAt ?? 0.85
  const mood: MascotState = petted ? 'happy' : pickMascotState(data)
  const codex = codexBusy(data)
  const level = levelFrom(data)
  const exhaust = exhaustText(level)
  // cerrada solo se ve la mascota con sus insignias; el detalle del nivel va en la ayuda al pasar el mouse
  const levelHint = level ? [levelText(level), level.label, exhaust].filter(Boolean).join(' · ') : null
  const { info: update, dismiss } = useUpdateNotice()
  const notice = update !== null && !open
  // un globo a la vez: el aviso de version nueva tiene prioridad sobre el bocadillo
  const speaking = !open && !notice && cfg?.mascot?.talk !== false && line !== null

  useEffect(() => {
    if (open || notice || document.hidden || !cfg || !data || !live) return
    const result = pickLine({
      mascot: cfg.mascot ?? { talk: true, talkCooldownMin: 10 },
      chats: data.chats,
      level: data.level,
      todayFresh: live.todayFresh,
      todayCostUsd: live.todayCostUsd,
    }, loadSpeechMemory(), Date.now())
    saveSpeechMemory(result.memory)
    if (cfg.mascot?.talk === false) setLine(null)
    else if (result.line) setLine(result.line)
  }, [open, notice, cfg, data, live])

  useEffect(() => () => {
    if (clickTimer.current !== null) clearTimeout(clickTimer.current)
    if (petTimer.current !== null) clearTimeout(petTimer.current)
  }, [])

  // al ocultarse la ventana (por ejemplo al abrir el dashboard) el panel se cierra: reaparece colapsada
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        setOpen(false)
        setLine(null)
        passes.current = []
        drag.current = null
        if (clickTimer.current !== null) clearTimeout(clickTimer.current)
        clickTimer.current = null
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const width = open ? EXPANDED_W : notice || speaking ? BALLOON_W : COLLAPSED_W
    const send = () => hub?.resize(width, Math.ceil(el.getBoundingClientRect().height))
    send()
    const ro = new ResizeObserver(send)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, notice, speaking])

  const down = (e: PointerEvent) => {
    if (e.button !== 0) return
    passes.current = []
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { x: e.screenX, y: e.screenY, moved: false }
    dragged.current = false
  }
  const move = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.screenX - d.x
    const dy = e.screenY - d.y
    if (!d.moved && Math.hypot(dx, dy) < 4) return
    d.moved = true
    dragged.current = true
    if (clickTimer.current !== null) clearTimeout(clickTimer.current)
    clickTimer.current = null
    d.x = e.screenX
    d.y = e.screenY
    hub?.dragBy(dx, dy)
  }
  const end = () => {
    drag.current = null
  }
  const pet = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.buttons !== 0 || drag.current) {
      passes.current = []
      return
    }
    const now = Date.now()
    passes.current = [...passes.current.filter((time) => now - time <= 1_500), now]
    if (!isPetting(passes.current, now)) return
    passes.current = []
    setPetted(true)
    if (petTimer.current !== null) clearTimeout(petTimer.current)
    petTimer.current = setTimeout(() => {
      setPetted(false)
      petTimer.current = null
    }, 3_000)
  }

  // El segundo clic cancela la apertura pendiente del panel.
  const toggle = (e: MouseEvent) => {
    const action = clickAction(e.detail === 0 || clickTimer.current === null ? 1 : 2, dragged.current)
    dragged.current = false
    if (clickTimer.current !== null) clearTimeout(clickTimer.current)
    clickTimer.current = null
    if (action === 'dashboard') hub?.openDashboard()
    else if (action === 'toggle') {
      if (e.detail === 0) {
        setLine(null)
        setOpen((o) => !o)
        return
      }
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null
        setLine(null)
        setOpen((o) => !o)
      }, 250)
    }
  }

  return (
    <div ref={root} className={`overlay ${open ? 'open' : ''}`}>
      {open && (
        <section className="overlay-panel">
          <header>
            <strong>Chats activos</strong>
            <TodayCount data={data ?? { todayTokens: 0 }} />
          </header>
          <PlanLimits plan={data?.plan ?? null} alertAt={alertAt} dense />
          <ActiveList chats={chats} agents={data?.agents} alertAt={alertAt} dense />
          <footer>
            <button type="button" className="overlay-action" onClick={() => hub?.openDashboard()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M3 9h18M9 9v12" />
              </svg>
              Abrir dashboard
            </button>
            <button type="button" className="overlay-action" onClick={() => hub?.hide()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9 5.5a10 10 0 013-.5c6 0 9 7 9 7a16 16 0 01-3 4M6 6.5A17 17 0 003 12s3 7 9 7a10 10 0 004-.8" />
              </svg>
              Ocultar mascota
            </button>
          </footer>
        </section>
      )}
      {notice && update?.url && (
        <section className="update-balloon" role="status" aria-label="Versión nueva">
          <p>{balloonText(update)}</p>
          {update.notes.length > 0 && (
            <ul>
              {update.notes.slice(0, 3).map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          <div className="update-actions">
            {hub?.openExternal ? (
              <button className="update-btn" onClick={() => hub.openExternal?.(update.url!)}>
                Descargar
              </button>
            ) : (
              <a className="update-btn" href={update.url} target="_blank" rel="noopener noreferrer">
                Descargar
              </a>
            )}
            <button className="link" onClick={dismiss}>
              Luego
            </button>
          </div>
        </section>
      )}
      {speaking && (
        <SpeechBubble key={line.id} text={line.text} onTyping={setTalking} onDone={() => setLine(null)} />
      )}
      <button
        className="mascot-btn"
        onPointerEnter={pet}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={() => {
          end()
          dragged.current = true
          if (clickTimer.current !== null) clearTimeout(clickTimer.current)
          clickTimer.current = null
        }}
        onClick={toggle}
        title={levelHint ?? undefined}
        aria-label={levelHint ? `Mascota de ClaudeHub. ${levelHint}` : 'Mascota de ClaudeHub'}
        aria-expanded={open}
      >
        <Mascot state={mood} size={44} level={level?.level} announce={notice} talking={speaking && talking} />
        {level && <LevelBadge level={level.level} />}
        {codex && <CodexBadge />}
        {chats.length > 0 && <span className={`badge ${mood === 'alert' ? 'bad' : ''}`}>{chats.length}</span>}
      </button>
    </div>
  )
}

const ISLAND_COMPACT = { w: 168, h: 38 }
const ISLAND_EXPANDED = { w: 460, h: 220 }
const COLLAPSE_MS = 4_000
const CANVAS_SIZE = 30

function IslandOverlay() {
  const { data } = useApi<ActiveReport>('/api/active', 4_000)
  const [expanded, setExpanded] = useState(false)
  const [emote, setEmote] = useState<{ name: ChispaEmote; id: number } | null>(null)
  const cursorRef = useRef<{ x: number; y: number } | null>(null)
  const canvasBox = useRef<HTMLDivElement>(null)
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clicks = useRef<number[]>([])
  const emoteId = useRef(0)
  const lastMood = useRef<MascotState | null>(null)

  const chats = data?.chats ?? []
  const alertAt = data?.alertAt ?? 0.85
  const mood = pickMascotState(data)
  const level = levelFrom(data)
  const tool = data?.agents?.find((a) => a.tool)?.tool ?? null

  const play = (name: ChispaEmote) => setEmote({ name, id: ++emoteId.current })
  const clearCollapse = () => {
    if (collapseTimer.current !== null) clearTimeout(collapseTimer.current)
    collapseTimer.current = null
  }
  const expand = () => {
    clearCollapse()
    setExpanded((was) => {
      if (!was) play('greeting')
      return true
    })
  }

  useEffect(() => {
    const size = expanded ? ISLAND_EXPANDED : ISLAND_COMPACT
    hub?.resize(size.w, size.h)
  }, [expanded])

  // el cursor llega relativo a la ventana; se pasa relativo al canvas
  useEffect(() => {
    if (!hub?.onCursor) return
    return hub.onCursor((x, y) => {
      const r = canvasBox.current?.getBoundingClientRect()
      cursorRef.current = r ? { x: x - r.left, y: y - r.top } : { x, y }
    })
  }, [])

  useEffect(() => {
    if (lastMood.current !== null && lastMood.current !== 'happy' && mood === 'happy') play('happyJump')
    lastMood.current = mood
  }, [mood])

  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) return
      clearCollapse()
      setExpanded(false)
      clicks.current = []
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      clearCollapse()
    }
  }, [])

  const click = () => {
    const now = Date.now()
    clicks.current = [...clicks.current.filter((t) => now - t <= 900), now]
    if (clicks.current.length >= 3) {
      clicks.current = []
      play('dizzy')
    } else play('squish')
    expand()
  }

  const leave = () => {
    clearCollapse()
    collapseTimer.current = setTimeout(() => {
      collapseTimer.current = null
      setExpanded(false)
    }, COLLAPSE_MS)
  }

  return (
    <div
      className={`island ${expanded ? 'island-expanded' : 'island-compact'}`}
      onPointerEnter={expand}
      onPointerLeave={leave}
      onClick={click}
    >
      <div className="island-head">
        <div ref={canvasBox} className="island-chispa">
          <ChispaCanvas width={CANVAS_SIZE} height={CANVAS_SIZE} cursorRef={cursorRef} emote={emote} sleeping={mood === 'sleeping'} />
        </div>
        {expanded ? (
          <>
            <strong>{chats.length} {chats.length === 1 ? 'chat activo' : 'chats activos'}</strong>
            {level && <span className="island-level">{[levelText(level), level.label].join(' · ')}</span>}
          </>
        ) : (
          <span className="island-tool">{tool ?? (chats.length > 0 ? `${chats.length} chats` : 'En reposo')}</span>
        )}
      </div>
      {expanded && (
        <ul className="island-rows">
          {chats.length === 0 && <li className="island-empty">Sin chats activos</li>}
          {chats.map((c) => {
            const chatTool = data?.agents?.find((a) => a.session === c.session)?.tool
            const pct = Math.round(c.context.pct * 100)
            return (
              <li key={c.session} className="island-row">
                <span className={`island-dot ${c.working ? 'on' : ''}`} aria-hidden="true" />
                <span className="island-title">{c.title}</span>
                <span className="island-meta">{chatTool ?? c.project}</span>
                <span className={`island-pct ${c.context.pct >= alertAt ? 'bad' : ''}`}>{pct}%</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Lee la posicion de la mascota de los ajustes, avisa a Electron y elige la vista. */
function Root() {
  const { data, error } = useApi<SettingsInfo>('/api/settings', 30_000)
  const mode: OverlayMode | null = data ? (data.config.overlayMode ?? 'corner') : error ? 'corner' : null
  useEffect(() => {
    if (mode) hub?.setMode?.(mode)
  }, [mode])
  if (mode === null) return null
  return mode === 'island' ? <IslandOverlay /> : <Overlay />
}

if (typeof document !== 'undefined') {
  const container = document.getElementById('root')
  if (container) createRoot(container).render(<Root />)
}
