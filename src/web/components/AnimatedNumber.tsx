import { useLayoutEffect, useRef, useState } from 'react'

const DURATION = 650

const ANIM_KEY = 'animations'

/** Interruptor propio de las animaciones; se suma a prefers-reduced-motion. */
export function animationsOn(): boolean {
  try {
    return localStorage.getItem(ANIM_KEY) !== 'off'
  } catch {
    return true
  }
}

export function setAnimations(on: boolean): void {
  if (typeof document !== 'undefined') {
    if (on) document.documentElement.removeAttribute('data-anim')
    else document.documentElement.setAttribute('data-anim', 'off')
  }
  try {
    localStorage.setItem(ANIM_KEY, on ? 'on' : 'off')
  } catch {
    /* sin almacenamiento */
  }
}

/** Interpola sin sobrepasar los extremos y conserva el valor final exacto. */
export function interpolate(from: number, to: number, elapsed: number): number {
  if (elapsed <= 0) return from
  if (elapsed >= DURATION) return to
  const eased = 1 - Math.pow(2, -10 * (elapsed / DURATION))
  return from + (to - from) * eased
}

/** Devuelve la cancelación del contador y de su escucha de movimiento reducido. */
export function animateNumber(from: number, to: number, update: (value: number) => void): () => void {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  if (motion.matches || from === to || !animationsOn()) {
    update(to)
    return () => {}
  }

  const start = performance.now()
  let frame: number
  const cancel = () => {
    cancelAnimationFrame(frame)
    motion.removeEventListener('change', onMotion)
  }
  const onMotion = () => {
    if (!motion.matches) return
    cancel()
    update(to)
  }
  const tick = (now: number) => {
    const elapsed = now - start
    update(interpolate(from, to, elapsed))
    if (elapsed < DURATION) frame = requestAnimationFrame(tick)
    else cancel()
  }
  motion.addEventListener('change', onMotion)
  frame = requestAnimationFrame(tick)
  return cancel
}

export function AnimatedNumber({ value, format }: { value: number; format: (value: number) => string }) {
  const [shown, setShown] = useState(value)
  const current = useRef(value)
  const mounted = useRef(false)
  // La primera vez cuenta desde cero; despues, desde el valor que se ve.
  useLayoutEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      current.current = 0
      setShown(0)
    }
    return animateNumber(current.current, value, (next) => {
      current.current = next
      setShown(next)
    })
  }, [value])
  return format(shown)
}
