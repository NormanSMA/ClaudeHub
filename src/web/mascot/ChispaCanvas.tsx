import { useEffect, useRef, useState, type JSX, type MutableRefObject } from 'react'
import type { MascotFamily } from './mascotState'

export type ChispaEmote = 'greeting' | 'squish' | 'dizzy' | 'happyJump'

export interface ChispaCanvasProps {
  width: number
  height: number
  cursorRef: MutableRefObject<{ x: number; y: number } | null>
  emote: { name: ChispaEmote; id: number } | null
  sleeping?: boolean
  family?: MascotFamily
}

const CLAUDE_PALETTE = { body: '#D97757', cheek: '#F0A488', spark: '#F3C3A8', eye: '#1F1E1D' }

const DURATION: Record<ChispaEmote, number> = {
  greeting: 1_000,
  squish: 650,
  dizzy: 1_200,
  happyJump: 800,
}
const MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function drawClaudeBody(context: CanvasRenderingContext2D): void {
  context.fillStyle = CLAUDE_PALETTE.body
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

  context.fillStyle = CLAUDE_PALETTE.spark
  context.beginPath()
  context.moveTo(7, 0)
  context.quadraticCurveTo(7.6, 1.1, 9, 1.4)
  context.quadraticCurveTo(7.6, 1.7, 7, 2.8)
  context.quadraticCurveTo(6.4, 1.7, 5, 1.4)
  context.quadraticCurveTo(6.4, 1.1, 7, 0)
  context.fill()

  context.fillStyle = CLAUDE_PALETTE.cheek
  for (const x of [3.4, 10.6]) {
    context.beginPath()
    context.ellipse(x, 8.6, 0.7, 0.4, 0, 0, Math.PI * 2)
    context.fill()
  }
}

function drawSpiral(context: CanvasRenderingContext2D, cx: number, cy: number, radius: number, angle: number): void {
  context.save()
  context.translate(cx, cy)
  context.rotate(angle)
  context.beginPath()
  for (let step = 0; step <= 48; step++) {
    const phase = (step / 48) * Math.PI * 4
    const r = (step / 48) * radius
    const sx = Math.cos(phase) * r
    const sy = Math.sin(phase) * r
    if (step === 0) context.moveTo(sx, sy)
    else context.lineTo(sx, sy)
  }
  context.stroke()
  context.restore()
}

function drawClaudeEyes(
  context: CanvasRenderingContext2D,
  closed: number,
  pupilX: number,
  pupilY: number,
  dizzy: boolean,
  angle: number,
): void {
  context.fillStyle = CLAUDE_PALETTE.eye
  context.strokeStyle = CLAUDE_PALETTE.eye
  context.lineWidth = 0.2
  context.lineCap = 'round'
  for (const x of [4.5, 9.5]) {
    context.save()
    context.translate(x, 7.2)
    context.beginPath()
    if (dizzy) {
      drawSpiral(context, 0, 0, 0.72, angle)
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

function drawCodex(
  context: CanvasRenderingContext2D,
  sleeping: boolean,
  closed: number,
  pupilX: number,
  pupilY: number,
  dizzy: boolean,
  angle: number,
  greetingWave: number | null,
): void {
  const bodyGrad = context.createLinearGradient(0, 7.2, 0, 10.6)
  bodyGrad.addColorStop(0, '#5E82F7')
  bodyGrad.addColorStop(1, '#3655CC')

  const headGrad = context.createLinearGradient(0, 0.6, 0, 7.6)
  headGrad.addColorStop(0, '#94B6FF')
  headGrad.addColorStop(1, '#4669E8')

  context.lineWidth = 0.4
  context.strokeStyle = '#182454'
  context.lineJoin = 'round'

  // Patitas
  context.fillStyle = '#3655CC'
  for (const fx of [4.6, 7.5]) {
    context.beginPath()
    context.roundRect(fx, 10.1, 1.9, 1.45, 0.72)
    context.fill()
    context.stroke()
  }

  // Brazos
  context.fillStyle = bodyGrad
  context.beginPath()
  context.roundRect(2.7, 7.55, 1.55, 2.5, 0.78)
  context.fill()
  context.stroke()

  context.save()
  if (greetingWave !== null) {
    context.translate(10.5, 8.0)
    context.rotate(-0.8 + greetingWave)
    context.beginPath()
    context.roundRect(-0.78, -0.4, 1.55, 2.5, 0.78)
    context.fill()
    context.stroke()
  } else {
    context.beginPath()
    context.roundRect(9.75, 7.55, 1.55, 2.5, 0.78)
    context.fill()
    context.stroke()
  }
  context.restore()

  // Torso y simbolo >-
  context.fillStyle = bodyGrad
  context.beginPath()
  context.roundRect(4.2, 7.25, 5.6, 3.3, 1.5)
  context.fill()
  context.stroke()

  context.strokeStyle = '#E0F7FA'
  context.lineWidth = 0.42
  context.lineCap = 'round'
  context.beginPath()
  context.moveTo(6.05, 8.4)
  context.lineTo(6.85, 8.95)
  context.lineTo(6.05, 9.5)
  context.stroke()
  context.strokeStyle = '#5CE1E6'
  context.beginPath()
  context.moveTo(7.25, 9.45)
  context.lineTo(8.1, 9.45)
  context.stroke()

  // Cabeza tipo nube esponjosa
  context.fillStyle = headGrad
  context.strokeStyle = '#182454'
  context.lineWidth = 0.4
  context.beginPath()
  context.moveTo(3.9, 7.6)
  context.bezierCurveTo(2.4, 7.6, 1.8, 6.2, 2.35, 4.8)
  context.bezierCurveTo(2.0, 3.3, 3.0, 1.9, 4.45, 2.05)
  context.bezierCurveTo(5.1, 0.75, 6.1, 0.6, 7.0, 0.6)
  context.bezierCurveTo(7.9, 0.6, 8.9, 0.75, 9.55, 2.05)
  context.bezierCurveTo(11.0, 1.9, 12.0, 3.3, 11.65, 4.8)
  context.bezierCurveTo(12.2, 6.2, 11.6, 7.6, 10.1, 7.6)
  context.closePath()
  context.fill()
  context.stroke()

  // Visor terminal oscuro
  context.fillStyle = '#111A3D'
  context.strokeStyle = '#2D4294'
  context.lineWidth = 0.36
  context.beginPath()
  context.roundRect(3.75, 2.75, 6.5, 4.25, 1.25)
  context.fill()
  context.stroke()

  if (dizzy) {
    context.strokeStyle = '#5CE1E6'
    context.lineWidth = 0.28
    drawSpiral(context, 5.55, 4.9, 0.85, angle)
    drawSpiral(context, 8.45, 4.9, 0.85, angle)
  } else if (sleeping) {
    context.strokeStyle = 'rgba(92, 225, 230, 0.55)'
    context.lineWidth = 0.52
    context.lineCap = 'round'
    context.beginPath()
    context.moveTo(4.9, 4.9)
    context.lineTo(6.2, 4.9)
    context.moveTo(7.8, 4.9)
    context.lineTo(9.1, 4.9)
    context.stroke()
  } else {
    const ox = Math.max(-0.4, Math.min(0.4, pupilX * 2.5))
    const oy = Math.max(-0.35, Math.min(0.35, pupilY * 1.5))
    context.save()
    context.beginPath()
    context.roundRect(4.35, 3.05, 5.3, 3.7, 0.85)
    context.clip()
    context.strokeStyle = '#5CE1E6'
    context.lineWidth = 0.6
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.beginPath()
    context.moveTo(5.05 + ox, 3.95 + oy)
    context.lineTo(6.45 + ox, 4.85 + oy)
    context.lineTo(5.05 + ox, 5.75 + oy)
    context.stroke()
    if (closed < 0.7) {
      context.fillStyle = '#5CE1E6'
      context.beginPath()
      context.roundRect(7.15 + ox, 5.4 + oy, 1.7, 0.58, 0.2)
      context.fill()
    }
    context.restore()
  }
}

function drawMicroStar(context: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const k = r * 0.22
  context.beginPath()
  context.moveTo(cx, cy - r)
  context.bezierCurveTo(cx + k * 0.35, cy - k, cx + k, cy - k * 0.35, cx + r, cy)
  context.bezierCurveTo(cx + k, cy + k * 0.35, cx + k * 0.35, cy + k, cx, cy + r)
  context.bezierCurveTo(cx - k * 0.35, cy + k, cx - k, cy + k * 0.35, cx - r, cy)
  context.bezierCurveTo(cx - k, cy - k * 0.35, cx - k * 0.35, cy - k, cx, cy - r)
  context.closePath()
  context.fill()
}

function drawGemini(
  context: CanvasRenderingContext2D,
  now: number,
  sleeping: boolean,
  reduced: boolean,
  pupilX: number,
  pupilY: number,
  dizzy: boolean,
  angle: number,
): void {
  context.save()
  if (sleeping) context.globalAlpha = 0.72

  const traceStar = () => {
    context.beginPath()
    context.moveTo(7, -0.4)
    context.bezierCurveTo(7.25, 3.35, 9.25, 5.35, 13, 5.6)
    context.bezierCurveTo(9.25, 5.85, 7.25, 7.85, 7, 11.6)
    context.bezierCurveTo(6.75, 7.85, 4.75, 5.85, 1, 5.6)
    context.bezierCurveTo(4.75, 5.35, 6.75, 3.35, 7, -0.4)
    context.closePath()
  }

  context.save()
  traceStar()
  context.clip()

  context.fillStyle = '#3B82F6'
  context.fillRect(1, -0.4, 12, 12)

  const topGrad = context.createRadialGradient(6.4, 0.56, 0, 6.4, 0.56, 7.0)
  topGrad.addColorStop(0, 'rgba(250, 66, 72, 1)')
  topGrad.addColorStop(0.55, 'rgba(250, 66, 72, 0.68)')
  topGrad.addColorStop(1, 'rgba(250, 66, 72, 0)')
  context.fillStyle = topGrad
  context.fillRect(1, -0.4, 12, 12)

  const leftGrad = context.createRadialGradient(1.72, 5.6, 0, 1.72, 5.6, 7.0)
  leftGrad.addColorStop(0, 'rgba(251, 188, 4, 1)')
  leftGrad.addColorStop(0.55, 'rgba(251, 188, 4, 0.7)')
  leftGrad.addColorStop(1, 'rgba(251, 188, 4, 0)')
  context.fillStyle = leftGrad
  context.fillRect(1, -0.4, 12, 12)

  const botGrad = context.createRadialGradient(6.4, 10.64, 0, 6.4, 10.64, 6.7)
  botGrad.addColorStop(0, 'rgba(52, 168, 83, 1)')
  botGrad.addColorStop(0.55, 'rgba(52, 168, 83, 0.7)')
  botGrad.addColorStop(1, 'rgba(52, 168, 83, 0)')
  context.fillStyle = botGrad
  context.fillRect(1, -0.4, 12, 12)

  const sx = 8.4 + pupilX * 2.5
  const sy = 3.7 + pupilY * 2.5
  const specGrad = context.createRadialGradient(sx, sy, 0, sx, sy, 4.2)
  specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.44)')
  specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
  context.fillStyle = specGrad
  context.fillRect(1, -0.4, 12, 12)
  context.restore()

  traceStar()
  context.strokeStyle = 'rgba(255, 255, 255, 0.22)'
  context.lineWidth = 0.24
  context.stroke()

  if (!sleeping && !reduced) {
    const pulseA = 0.7 + 0.3 * Math.sin(now / 420)
    const pulseB = 0.7 + 0.3 * Math.cos(now / 420 + 1.1)
    const orbitAngle = dizzy ? angle * 0.25 : Math.sin(now / 900) * 0.12

    context.save()
    context.translate(7, 5.6)
    context.rotate(orbitAngle)
    context.translate(-7, -5.6)

    context.fillStyle = '#93C5FD'
    context.globalAlpha = 0.55 + 0.4 * pulseA
    drawMicroStar(context, 11.4, 1.4, 0.88 * pulseA)

    context.fillStyle = '#FDE68A'
    context.globalAlpha = 0.55 + 0.4 * pulseB
    drawMicroStar(context, 2.6, 9.8, 0.75 * pulseB)
    context.restore()
  }

  context.restore()
}

export function ChispaCanvas({ width, height, cursorRef, emote, sleeping = false, family = 'claude' }: ChispaCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputsRef = useRef({ cursorRef, emote, sleeping, family })
  const emoteRef = useRef<{ name: ChispaEmote; start: number } | null>(null)
  const emoteIdRef = useRef<number | null>(null)
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(MOTION_QUERY).matches,
  )
  inputsRef.current = { cursorRef, emote, sleeping, family }

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

      if (inputs.family === 'codex') {
        drawCodex(
          context,
          inputs.sleeping,
          closed,
          pupilX,
          pupilY,
          name === 'dizzy',
          progress * Math.PI * 8,
          name === 'greeting' ? wave : null,
        )
      } else if (inputs.family === 'gemini') {
        drawGemini(
          context,
          now,
          inputs.sleeping,
          reduced,
          pupilX,
          pupilY,
          name === 'dizzy',
          progress * Math.PI * 8,
        )
      } else {
        drawClaudeBody(context)
        if (name === 'greeting') {
          context.fillStyle = CLAUDE_PALETTE.body
          context.beginPath()
          context.ellipse(12.3, 6.2 + wave, 0.7, 1.4, -0.4 + wave, 0, Math.PI * 2)
          context.fill()
        }
        drawClaudeEyes(context, inputs.sleeping ? 1 : closed, pupilX, pupilY, name === 'dizzy', progress * Math.PI * 8)
      }

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
  }, [width, height, reduced, family])

  return <canvas ref={canvasRef} width={width} height={height} style={{ width, height }} aria-hidden="true" />
}
