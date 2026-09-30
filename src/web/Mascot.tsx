import type { ReactElement } from 'react'

export type MascotState = 'sleeping' | 'working' | 'happy' | 'alert'

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

export function Mascot({ state = 'sleeping', size = 56 }: { state?: MascotState; size?: number }) {
  const cells: ReactElement[] = []
  const eyes: [number, number][] = []
  GRID.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === '.') return
      if (c === 'e') {
        eyes.push([x, y])
        cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={COLOR.o} />)
        return
      }
      cells.push(
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={COLOR[c]} className={c === 's' ? 'm-spark' : undefined} />,
      )
    }),
  )
  return (
    <svg
      className={`mascot mascot-${state}`}
      width={size}
      height={Math.round((size * 12) / 14)}
      viewBox="0 0 14 12"
      shapeRendering="crispEdges"
      role="img"
      aria-label={
        state === 'working'
          ? 'Claude esta trabajando'
          : state === 'alert'
            ? 'Un chat casi llena su contexto'
            : state === 'happy'
              ? 'Claude esta despierto'
              : 'Claude esta descansando'
      }
    >
      <g className="m-body">
        {cells}
        {state === 'sleeping' ? (
          <>
            <rect x={3} y={7} width={2} height={1} fill="var(--mascot-eye)" />
            <rect x={8} y={7} width={2} height={1} fill="var(--mascot-eye)" />
          </>
        ) : (
          eyes.map(([x, y]) => <rect key={`e${x}-${y}`} className="m-eye" x={x} y={y} width={1} height={1} fill="var(--mascot-eye)" />)
        )}
      </g>
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
