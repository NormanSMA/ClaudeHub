import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { ActiveList, PlanLimits } from './Active'
import { useApi, type ActiveReport } from './api'
import { compact } from './format'
import { CodexBadge, Mascot } from './Mascot'
import { codexBusy, pickMascotState, type MascotState } from './mascotState'
import './style.css'
import './overlay.css'

interface HubBridge {
  dragBy(dx: number, dy: number): void
  resize(width: number, height: number): void
  openDashboard(): void
  hide(): void
}
const hub = (window as unknown as { hub?: HubBridge }).hub

const COLLAPSED_W = 68
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
    const send = () => hub?.resize(open ? EXPANDED_W : COLLAPSED_W, Math.ceil(el.getBoundingClientRect().height))
    send()
    const ro = new ResizeObserver(send)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

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
            <span>Hoy {compact(data?.todayTokens ?? 0)}</span>
          </header>
          <PlanLimits plan={data?.plan ?? null} alertAt={alertAt} dense />
          <ActiveList chats={chats} alertAt={alertAt} dense />
          <footer>
            <button className="link" onClick={() => hub?.openDashboard()}>
              Abrir dashboard
            </button>
            <button className="link" onClick={() => hub?.hide()}>
              Ocultar mascota
            </button>
          </footer>
        </section>
      )}
      <button
        className="mascot-btn"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onClick={toggle}
        aria-label="Mascota de ClaudeHub"
        aria-expanded={open}
      >
        <Mascot state={mood} size={44} />
        {codex && <CodexBadge />}
        {chats.length > 0 && <span className={`badge ${mood === 'alert' ? 'bad' : ''}`}>{chats.length}</span>}
      </button>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Overlay />)
