import { useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'

/** Indice de la pestana que sigue a la tecla pulsada, o null si la tecla no navega. */
export function nextTabIndex(key: string, index: number, count: number): number | null {
  if (count < 1) return null
  if (key === 'ArrowRight') return (index + 1) % count
  if (key === 'ArrowLeft') return (index - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}

type Pill = { left: number; right: number; width: number; dir: string }

/** Mide la pestana activa para colocar la pildora y la mantiene a la vista dentro de la barra. */
function useActivePill(navRef: RefObject<HTMLDivElement | null>, active: string): Pill {
  const [pill, setPill] = useState<Pill>({ left: 0, right: 0, width: 0, dir: 'right' })
  const prev = useRef(0)
  useLayoutEffect(() => {
    const measure = () => {
      const btn = navRef.current?.querySelector<HTMLButtonElement>('button.on')
      if (!btn) return
      const moved = btn.offsetLeft - prev.current
      prev.current = btn.offsetLeft
      const nav = navRef.current!
      if (btn.offsetLeft < nav.scrollLeft) nav.scrollLeft = btn.offsetLeft - 6
      else if (btn.offsetLeft + btn.offsetWidth > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = btn.offsetLeft + btn.offsetWidth - nav.clientWidth + 6
      setPill((o) => ({ left: btn.offsetLeft, right: nav.clientWidth - btn.offsetLeft - btn.offsetWidth, width: btn.offsetWidth, dir: moved > 0 ? 'right' : moved < 0 ? 'left' : o.dir }))
    }
    measure()
    void document.fonts?.ready.then(measure)
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [navRef, active])
  return pill
}

/** Barra de pestañas: la pildora se estira hacia la pestaña nueva y una segunda sigue al puntero. */
export function AnimatedTabs<T extends string>({ items, active, onSelect }: { items: { id: T; label: string }[]; active: T; onSelect: (id: T) => void }) {
  const navRef = useRef<HTMLDivElement | null>(null)
  const pill = useActivePill(navRef, active)
  const [hover, setHover] = useState<{ left: number; width: number } | null>(null)

  // El foco viaja con la seleccion: con flechas, Inicio y Fin la pestana nueva queda activa y enfocada.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = nextTabIndex(e.key, items.findIndex((t) => t.id === active), items.length)
    if (next === null) return
    e.preventDefault()
    onSelect(items[next].id)
    navRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <div ref={navRef} className="tabs tabs-sliding" role="tablist" aria-label="Secciones" onKeyDown={onKeyDown} onMouseLeave={() => setHover(null)}>
      <span className="tab-pill-hover" style={{ transform: `translateX(${hover?.left ?? pill.left}px)`, width: hover?.width ?? pill.width, opacity: hover ? 1 : 0 }} aria-hidden="true" />
      <span className={`tab-pill-indicator to-${pill.dir}`} style={{ left: pill.left, right: pill.right }} aria-hidden="true" />
      {items.map((t) => (
        <button
          key={t.id}
          id={`tab-${t.id}`}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          aria-controls="tab-panel"
          tabIndex={active === t.id ? 0 : -1}
          className={active === t.id ? 'on' : ''}
          onClick={() => onSelect(t.id)}
          onMouseEnter={(e) => setHover({ left: e.currentTarget.offsetLeft, width: e.currentTarget.offsetWidth })}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
