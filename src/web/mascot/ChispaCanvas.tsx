import { useEffect, useRef, useState, type JSX, type MutableRefObject } from 'react'

export type ChispaEmote = 'greeting' | 'squish' | 'dizzy' | 'happyJump'

export interface ChispaCanvasProps {
  width: number
  height: number
  cursorRef: MutableRefObject<{ x: number; y: number } | null>
  emote: { name: ChispaEmote; id: number } | null
  sleeping?: boolean
}

const COLORS = {
  body: '#D97757',
  cheek: '#F0A488',
  spark: '#F3C3A8',
  eye: '#1F1E1D',
}
const DURATION: Record<ChispaEmote, number> = {
  greeting: 1_000,
  squish: 650,
  dizzy: 1_200,
  happyJump: 800,
}
const MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function drawBody(context: CanvasRenderingContext2D): void {
  context.fillStyle = COLORS.body
  context.beginPath()
  context.roundRect(2, 4, 10, 6.6, 2.1)
  context.fill()
  for (const x of [1.3, 5.3, 9.9]) {
    context.beginPath()
    context.roundRect(x, 9.3, 2.8, 2.5, 0.8)
    context.fill()
  }
  context.beginPath()
  context.roundRect(6.8, 2.5, 0.7, 2, 0.35)
  context.fill()

  context.fillStyle = COLORS.spark
  context.beginPath()
  context.moveTo(7, 0)
  context.quadraticCurveTo(7.6, 1.1, 9, 1.4)
  context.quadraticCurveTo(7.6, 1.7, 7, 2.8)
  context.quadraticCurveTo(6.4, 1.7, 5, 1.4)
  context.quadraticCurveTo(6.4, 1.1, 7, 0)
  context.fill()

  context.fillStyle = COLORS.cheek
  for (const x of [3.4, 10.6]) {
    context.beginPath()
    context.ellipse(x, 8.6, 0.7, 0.4, 0, 0, Math.PI * 2)
    context.fill()
  }
}

function drawEyes(
  context: CanvasRenderingContext2D,
  closed: number,
  pupilX: number,
  pupilY: number,
  dizzy: boolean,
  angle: number,
): void {
  context.fillStyle = COLORS.eye
  context.strokeStyle = COLORS.eye
  context.lineWidth = 0.2
  context.lineCap = 'round'
  for (const x of [4.5, 9.5]) {
    context.save()
    context.translate(x, 7.2)
    context.beginPath()
    if (dizzy) {
      context.rotate(angle)
      for (let step = 0; step <= 48; step++) {
        const phase = (step / 48) * Math.PI * 4
        const radius = (step / 48) * 0.72
        const sx = Math.cos(phase) * radius
        const sy = Math.sin(phase) * radius
        if (step === 0) context.moveTo(sx, sy)
        else context.lineTo(sx, sy)
      }
      context.stroke()
    } else if (closed > 0.95) {
      context.moveTo(-0.55, 0)
      context.lineTo(0.55, 0)
      context.stroke()
    } else {
      context.ellipse(pupilX, pupilY, 0.48, 0.92 * (1 - closed), 0, 0, Math.PI * 2)
      context.fill()
    }
    context.restore()
  }
}

export function ChispaCanvas({ width, height, cursorRef, emote, sleeping = false }: ChispaCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputsRef = useRef({ cursorRef, emote, sleeping })
  const emoteRef = useRef<{ name: ChispaEmote; start: number } | null>(null)
  const emoteIdRef = useRef<number | null>(null)
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(MOTION_QUERY).matches,
  )
  inputsRef.current = { cursorRef, emote, sleeping }

  useEffect(() => {
    const media = window.matchMedia(MOTION_QUERY)
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return
    const context = canvas.getContext('2d')
    if (!context) return

    const unit = Math.min(width / 17, height / 18)
    let pixelRatio = 0
    let frameId = 0
    let lastPaint = performance.now()
    let nextBlink = lastPaint + 2_000 + Math.random() * 3_000
    let blinkStart: number | null = null

    const draw = (now: number) => {
      const ratio = window.devicePixelRatio || 1
      if (pixelRatio !== ratio) {
        pixelRatio = ratio
        canvas.width = Math.max(1, Math.round(width * ratio))
        canvas.height = Math.max(1, Math.round(height * ratio))
      }
      context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0)
      context.clearRect(0, 0, width, height)

      const inputs = inputsRef.current
      const nextEmote = inputs.emote
      if ((nextEmote?.id ?? null) !== emoteIdRef.current) {
        emoteIdRef.current = nextEmote?.id ?? null
        if (nextEmote) emoteRef.current = { name: nextEmote.name, start: now }
      }
      if (reduced) emoteRef.current = null
      const active = emoteRef.current
      let progress = 0
      if (active) {
        progress = Math.min(1, (now - active.start) / DURATION[active.name])
        if (progress >= 1) emoteRef.current = null
      }

      const breath = reduced ? 0 : Math.sin(now / (inputs.sleeping ? 850 : 550)) * 0.025
      let scaleX = 1 - breath * 0.5
      let scaleY = 1 + breath
      let lift = 0
      let rotation = 0
      let wave = 0
      const name = emoteRef.current?.name
      if (name === 'greeting') {
        lift = Math.abs(Math.sin(progress * Math.PI * 3)) * (1 - progress) * 1.2
        wave = Math.sin(progress * Math.PI * 6) * 0.5
      } else if (name === 'squish') {
        const squash = Math.sin(progress * Math.PI)
        scaleX *= 1 + squash * 0.22
        scaleY *= 1 - squash * 0.35
      } else if (name === 'dizzy') {
        rotation = Math.sin(progress * Math.PI * 6) * 0.12 * Math.sin(progress * Math.PI)
      } else if (name === 'happyJump') {
        lift = 3 * 4 * progress * (1 - progress)
      }

      if (!reduced && now >= nextBlink && blinkStart === null) blinkStart = now
      let closed = 0
      if (blinkStart !== null) {
        const elapsed = now - blinkStart
        closed = Math.sin(Math.min(1, elapsed / 160) * Math.PI)
        if (elapsed >= 160) {
          blinkStart = null
          nextBlink = now + 2_000 + Math.random() * 3_000
        }
      }

      let pupilX = 0
      let pupilY = 0
      const cursor = inputs.cursorRef.current
      if (cursor && !reduced && !inputs.sleeping) {
        const dx = (cursor.x - width / 2) / unit
        const dy = (cursor.y - (height / 2 + (7.2 - 5.5) * unit)) / unit
        const distance = Math.hypot(dx, dy)
        if (Number.isFinite(distance) && distance > 0) {
          const factor = Math.min(0.1, 0.65 / distance)
          pupilX = dx * factor
          pupilY = dy * factor
        }
      }

      context.save()
      context.translate(width / 2, height / 2 + 5.5 * unit - lift * unit)
      context.scale(unit * scaleX, unit * scaleY)
      context.rotate(rotation)
      context.translate(-7, -11)
      drawBody(context)
      if (name === 'greeting') {
        context.fillStyle = COLORS.body
        context.beginPath()
        context.ellipse(12.3, 6.2 + wave, 0.7, 1.4, -0.4 + wave, 0, Math.PI * 2)
        context.fill()
      }
      drawEyes(context, inputs.sleeping ? 1 : closed, pupilX, pupilY, name === 'dizzy', progress * Math.PI * 8)
      context.restore()
    }

    draw(lastPaint)
    if (reduced) return

    // Limita el dibujo a 60 fps en pantallas de mayor frecuencia.
    const interval = 1_000 / 60
    const animate = (now: number) => {
      const elapsed = now - lastPaint
      if (elapsed >= interval - 0.1) {
        lastPaint = now - (Math.max(0, elapsed) % interval)
        draw(now)
      }
      frameId = requestAnimationFrame(animate)
    }
    frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [width, height, reduced])

  return <canvas ref={canvasRef} width={width} height={height} style={{ width, height }} aria-hidden="true" />
}
