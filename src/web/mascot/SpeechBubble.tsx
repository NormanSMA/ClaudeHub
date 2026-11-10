import { useEffect, useRef, useState } from 'react'

const LETTER_MS = 30
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

export function typedText(text: string, elapsedMs: number): string {
  return Array.from(text).slice(0, Math.max(0, Math.floor(elapsedMs / LETTER_MS))).join('')
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.(REDUCED_MOTION).matches
}

export function SpeechBubble({ text, onDone, onTyping, durationMs = 6000 }: {
  text: string
  onDone: () => void
  onTyping?: (typing: boolean) => void
  durationMs?: number
}) {
  const [reduced, setReduced] = useState(prefersReducedMotion)
  const [visibleText, setVisibleText] = useState(() => reduced ? text : '')
  const [closed, setClosed] = useState(false)
  const callbacks = useRef({ onDone, onTyping })
  const close = useRef(() => {})

  useEffect(() => {
    callbacks.current = { onDone, onTyping }
  }, [onDone, onTyping])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia(REDUCED_MOTION)
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    let active = true
    let typing = !reduced && text.length > 0
    const started = Date.now()
    setClosed(false)
    setVisibleText(reduced ? text : '')
    callbacks.current.onTyping?.(typing)

    const stopTyping = () => {
      if (!typing) return
      typing = false
      callbacks.current.onTyping?.(false)
    }
    close.current = () => {
      if (!active) return
      active = false
      clearTimeout(timer)
      stopTyping()
      setClosed(true)
      callbacks.current.onDone()
    }
    const tick = () => {
      const next = typedText(text, Date.now() - started)
      setVisibleText(next)
      if (next === text) {
        stopTyping()
        timer = setTimeout(() => close.current(), durationMs)
      } else {
        timer = setTimeout(tick, LETTER_MS)
      }
    }
    timer = typing
      ? setTimeout(tick, LETTER_MS)
      : setTimeout(() => close.current(), durationMs)

    return () => {
      active = false
      clearTimeout(timer)
      stopTyping()
    }
  }, [text, durationMs, reduced])

  if (closed) return null
  // Un solo anuncio: la region de estado lleva el texto completo y el texto escrito queda oculto a lectores.
  return (
    <div className="speech-bubble">
      <span className="speech-bubble-live" role="status" aria-live="polite" aria-atomic="true">{text}</span>
      <p className="speech-bubble-text" aria-hidden="true">
        <span className="speech-bubble-ghost">{text}</span>
        <span>{visibleText}</span>
      </p>
      <button type="button" className="speech-bubble-close" onClick={() => close.current()} aria-label="Cerrar bocadillo">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M5 5l14 14M19 5L5 19" />
        </svg>
      </button>
    </div>
  )
}
