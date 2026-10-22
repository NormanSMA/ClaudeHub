import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { ActiveList, PlanLimits } from './Active'
import { useApi, type ActiveReport } from './api'
import { TodayCount } from './TodayCount'
import { CodexBadge, LevelBadge, Mascot } from './Mascot'
import { codexBusy, exhaustText, levelFrom, levelText, pickMascotState, type MascotState } from './mascotState'
import { balloonText, useUpdateNotice } from './update'
import './style.css'
import './overlay.css'

interface HubBridge {
  dragBy(dx: number, dy: number): void
  resize(width: number, height: number): void
  openDashboard(): void
  hide(): void
  openExternal?(url: string): void
}
const hub = (window as unknown as { hub?: HubBridge }).hub

const COLLAPSED_W = 68
const BALLOON_W = 220
const EXPANDED_W = 360

function Overlay() {
  const [open, setOpen] = useState(location.hash === '#open')
  const { data } = useApi<ActiveReport>('/api/active', 4_000)
  const root = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const dragged = useRef(false)

  const chats = data?.chats ?? []
  const alertAt = data?.alertAt ?? 0.85
  const mood: MascotState = pickMascotState(data)
  const codex = codexBusy(data)
  const level = levelFrom(data)
  const exhaust = exhaustText(level)
  // cerrada solo se ve la mascota con sus insignias; el detalle del nivel va en la ayuda al pasar el mouse
  const levelHint = level ? [levelText(level), level.label, exhaust].filter(Boolean).join(' · ') : null
  const { info: update, dismiss } = useUpdateNotice()
  const notice = update !== null && !open

  // al ocultarse la ventana (por ejemplo al abrir el dashboard) el panel se cierra: reaparece colapsada
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setOpen(false)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const width = open ? EXPANDED_W : notice ? BALLOON_W : COLLAPSED_W
    const send = () => hub?.resize(width, Math.ceil(el.getBoundingClientRect().height))
    send()
    const ro = new ResizeObserver(send)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, notice])

  const down = (e: PointerEvent) => {
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
    d.x = e.screenX
    d.y = e.screenY
    hub?.dragBy(dx, dy)
  }
  const end = () => {
    drag.current = null
  }
  // onClick cubre mouse y teclado (Enter y Espacio); se ignora el que sigue a un arrastre
  const toggle = () => {
    if (dragged.current) {
      dragged.current = false
      return
    }
    setOpen((o) => !o)
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
      <button
        className="mascot-btn"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onClick={toggle}
        title={levelHint ?? undefined}
        aria-label={levelHint ? `Mascota de ClaudeHub. ${levelHint}` : 'Mascota de ClaudeHub'}
        aria-expanded={open}
      >
        <Mascot state={mood} size={44} level={level?.level} announce={notice} />
        {level && <LevelBadge level={level.level} />}
        {codex && <CodexBadge />}
        {chats.length > 0 && <span className={`badge ${mood === 'alert' ? 'bad' : ''}`}>{chats.length}</span>}
      </button>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Overlay />)
