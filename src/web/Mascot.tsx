import type { ReactElement } from 'react'
import type { MascotState } from './mascotState'
import './mascot-states.css'

export type { MascotState } from './mascotState'

// Personaje propio: "Chispa". Cuadricula 14 x 12. o = cuerpo, l = mejilla, s = chispa, e = ojo.
const GRID = [
  '......ss......',
  '.....ssss.....',
  '......ss......',
  '.......o......',
  '...oooooooo...',
  '..oooooooooo..',
  '..ooeooooeoo..',
  '..ooeooooeoo..',
  '..oloooooolo..',
  '..oooooooooo..',
  '.ooo.oooo.ooo.',
  '.oo..o..o..oo.',
]

const COLOR: Record<string, string> = { o: 'var(--mascot-body)', l: 'var(--mascot-cheek)', s: 'var(--mascot-spark)' }

// Ojos en X de 3 x 3 centrados en las columnas 4 y 9 (filas 6 a 8).
const X_EYES: [number, number][] = [4, 9].flatMap((cx) => [
  [cx - 1, 6],
  [cx + 1, 6],
  [cx, 7],
  [cx - 1, 8],
  [cx + 1, 8],
])

const LABEL: Record<MascotState, string> = {
  sleeping: 'Claude esta descansando',
  happy: 'Claude esta despierto',
  working: 'Claude esta trabajando',
  tool: 'Claude esta usando una herramienta',
  thinking: 'Claude esta pensando',
  waiting: 'Claude espera una respuesta tuya',
  error: 'Claude tuvo un error',
  alert: 'Un chat casi llena su contexto',
}

function px(x: number, y: number, fill: string, className?: string, w = 1) {
  return <rect key={`${className ?? 'p'}${x}-${y}`} className={className} x={x} y={y} width={w} height={1} fill={fill} />
}

export function Mascot({ state = 'sleeping', size = 56 }: { state?: MascotState; size?: number }) {
  const cells: ReactElement[] = []
  const eyes: [number, number][] = []
  const calm = state === 'thinking' // los puntos de pensar ocupan el lugar de la chispa
  GRID.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === '.') return
      if (c === 'e') {
        eyes.push([x, y])
        cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={COLOR.o} />)
        return
      }
      if (c === 's' && calm) return
      cells.push(
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={COLOR[c]} className={c === 's' ? 'm-spark' : undefined} />,
      )
    }),
  )
  const busy = state === 'working' || state === 'tool' || state === 'thinking'
  return (
    <svg
      className={`mascot mascot-${state}${busy ? ' mascot-working' : ''}`}
      width={size}
      height={Math.round((size * 12) / 14)}
      viewBox="0 0 14 12"
      shapeRendering="crispEdges"
      role="img"
      aria-label={LABEL[state]}
    >
      <g className="m-body">
        {cells}
        {state === 'sleeping' ? (
          <>
            <rect x={3} y={7} width={2} height={1} fill="var(--mascot-eye)" />
            <rect x={8} y={7} width={2} height={1} fill="var(--mascot-eye)" />
          </>
        ) : state === 'error' ? (
          X_EYES.map(([x, y]) => px(x, y, 'var(--mascot-eye)', 'm-x'))
        ) : (
          eyes.map(([x, y]) => <rect key={`e${x}-${y}`} className="m-eye" x={x} y={y} width={1} height={1} fill="var(--mascot-eye)" />)
        )}
        {state === 'tool' && (
          <>
            {px(0, 9, 'var(--mascot-cheek)', 'm-hand m-hand-a')}
            {px(13, 9, 'var(--mascot-cheek)', 'm-hand m-hand-b')}
          </>
        )}
      </g>
      {state === 'thinking' && [4, 7, 10].map((x, i) => px(x, 1, 'var(--mascot-spark)', `m-dot m-dot-${i + 1}`))}
      {state === 'waiting' && (
        <g className="m-wait">
          {[0, 1, 2, 4].map((y) => px(12, y, 'var(--mascot-wait)', 'm-wait-px'))}
        </g>
      )}
      {state === 'alert' && (
        <text className="m-alert" x={11} y={4} fontSize={4} fontWeight="bold" fill="var(--danger)">
          !
        </text>
      )}
      {state === 'sleeping' && (
        <text className="m-z" x={11} y={3} fontSize={3} fill="var(--muted)">
          z
        </text>
      )}
    </svg>
  )
}

// Insignia pixel de Codex: letra C sobre fondo azul. Se coloca sobre el boton de la mascota.
const C_LETTER = ['.###', '#...', '#...', '#...', '.###']

export function CodexBadge() {
  const letter: ReactElement[] = []
  C_LETTER.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === '#') letter.push(<rect key={`${x}-${y}`} x={x + 3} y={y + 2.5} width={1} height={1} fill="#fff" />)
    }),
  )
  return (
    <span className="codex-badge" title="Codex trabajando" role="img" aria-label="Codex trabajando">
      <svg width={18} height={18} viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true">
        <rect x={1} y={0} width={8} height={10} fill="var(--blue)" />
        <rect x={0} y={1} width={10} height={8} fill="var(--blue)" />
        {letter}
      </svg>
    </span>
  )
}
