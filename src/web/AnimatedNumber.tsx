import { useEffect, useRef, useState } from 'react'

const DURATION = 400

/** Interpola sin sobrepasar los extremos y conserva el valor final exacto. */
export function interpolate(from: number, to: number, elapsed: number): number {
  if (elapsed <= 0) return from
  if (elapsed >= DURATION) return to
  return from + (to - from) * (elapsed / DURATION)
}

/** Devuelve la cancelación del contador y de su escucha de movimiento reducido. */
export function animateNumber(from: number, to: number, update: (value: number) => void): () => void {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  if (motion.matches || from === to) {
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
  useEffect(() => animateNumber(current.current, value, (next) => {
    current.current = next
    setShown(next)
  }), [value])
  return format(shown)
}
