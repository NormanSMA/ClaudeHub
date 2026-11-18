import { useId, type ReactElement } from 'react'
import type { MascotFamily, MascotState } from './mascotState'
import './mascot-states.css'

export type { MascotFamily, MascotState } from './mascotState'

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

export const GRIDS: Record<MascotFamily, string[]> = {
  claude: GRID,
  codex: [
    '.....ssss.....',
    '....s.ss.s....',
    '.....ssss.....',
    '......oo......',
    '..oooooooooo..',
    '.oooooooooooo.',
    '.oooeooooeooo.',
    '.oooeooooeooo.',
    '.oolooooooolo.',
    '..oooooooooo..',
    '...oo.oo.oo...',
    '...o..oo..o...',
  ],
  gemini: [
    '......ss......',
    '....ssssss....',
    '......ss......',
    '......oo......',
    '....oooooo....',
    '..oooooooooo..',
    '..ooeooooeoo..',
    '..ooeooooeoo..',
    '..oloooooolo..',
    '...oooooooo...',
    '..oo..oo..oo..',
    '.o....oo....o.',
  ],
}

const FAMILY_NAME: Record<MascotFamily, string> = {
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini',
}

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
  sleeping: 'Claude está descansando',
  happy: 'Claude está despierto',
  working: 'Claude está trabajando',
  tool: 'Claude está usando una herramienta',
  thinking: 'Claude está pensando',
  waiting: 'Claude espera una respuesta tuya',
  error: 'Claude tuvo un error',
  alert: 'Un chat casi llena su contexto',
}

function px(x: number, y: number, fill: string, className?: string, w = 1) {
  return <rect key={`${className ?? 'p'}${x}-${y}`} className={className} x={x} y={y} width={w} height={1} fill={fill} />
}

// Destellos del anuncio de version nueva: [x, y, retraso en ms].
const GLINTS: [number, number, number][] = [
  [1, 1, 0],
  [12, 1, 300],
  [0, 5, 600],
]

const GLINTS_28: [number, number, number][] = [
  [3, 3, 0],
  [24, 3, 300],
  [2, 14, 600],
]

const CODEX_CLOUD_PATH =
  'M 7.8 18.2 C 4.8 18.2 3.6 15.4 4.7 12.6 C 4.0 9.6 6.0 6.8 8.9 7.1 C 10.2 4.5 12.2 4.2 14.0 4.2 C 15.8 4.2 17.8 4.5 19.1 7.1 C 22.0 6.8 24.0 9.6 23.3 12.6 C 24.4 15.4 23.2 18.2 20.2 18.2 Z'

const GEMINI_STAR_PATH =
  'M 14 2 C 14.5 9.5 18.5 13.5 26 14 C 18.5 14.5 14.5 18.5 14 26 C 13.5 18.5 9.5 14.5 2 14 C 9.5 13.5 13.5 9.5 14 2 Z'

const GEMINI_BADGE_STAR_PATH =
  'M 9 3 C 9.3 6.7 11.3 8.7 15 9 C 11.3 9.3 9.3 11.3 9 15 C 8.7 11.3 6.7 9.3 3 9 C 6.7 8.7 8.7 6.7 9 3 Z'

function microStarPath(cx: number, cy: number, r: number): string {
  const k = r * 0.22
  return `M ${cx} ${cy - r} C ${cx + k * 0.35} ${cy - k} ${cx + k} ${cy - k * 0.35} ${cx + r} ${cy} C ${cx + k} ${cy + k * 0.35} ${cx + k * 0.35} ${cy + k} ${cx} ${cy + r} C ${cx - k * 0.35} ${cy + k} ${cx - k} ${cy + k * 0.35} ${cx - r} ${cy} C ${cx - k} ${cy - k * 0.35} ${cx - k * 0.35} ${cy - k} ${cx} ${cy - r} Z`
}

function CommonStatusOverlays28({
  state,
  lv,
  announce,
}: {
  state: MascotState
  lv: number | null
  announce: boolean
}) {
  return (
    <>
      {lv !== null && lv >= 4 && (
        <>
          <circle className="m-sweat" cx={3.2} cy={9.0} r={0.95} fill="var(--mascot-sweat)" />
          <circle className="m-sweat m-sweat-b" cx={24.8} cy={10.5} r={0.95} fill="var(--mascot-sweat)" />
        </>
      )}
      {announce &&
        GLINTS_28.map(([x, y, delay]) => (
          <path
            key={`g${x}-${y}`}
            className="m-glint"
            d={microStarPath(x, y, 1.35)}
            fill="var(--mascot-spark)"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      {state === 'thinking' &&
        [10.2, 14, 17.8].map((cx, i) => (
          <circle
            key={`d${cx}`}
            className={`m-dot m-dot-${i + 1}`}
            cx={cx}
            cy={1.6}
            r={0.85}
            fill="var(--mascot-dot, var(--mascot-spark))"
          />
        ))}
      {state === 'waiting' && (
        <g className="m-wait">
          <rect x={23.2} y={1.5} width={1.6} height={4.2} rx={0.8} fill="var(--mascot-wait)" />
          <circle cx={24.0} cy={7.0} r={0.9} fill="var(--mascot-wait)" />
        </g>
      )}
      {state === 'alert' && (
        <text className="m-alert" x={22.2} y={7.5} fontSize={7.2} fontWeight="bold" fill="var(--danger)">
          !
        </text>
      )}
      {state === 'sleeping' && (
        <text className="m-z" x={21.8} y={6.2} fontSize={5.5} fill="var(--muted)">
          z
        </text>
      )}
    </>
  )
}

function CodexMascot({
  uid,
  state,
  size,
  lv,
  announce,
  className,
  ariaLabel,
}: {
  uid: string
  state: MascotState
  size: number
  lv: number | null
  announce: boolean
  className: string
  ariaLabel: string
}) {
  const headGradId = `${uid}-codex-head`
  const bodyGradId = `${uid}-codex-body`
  const isError = state === 'error'

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 28 28"
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id={headGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isError ? '#FFA39E' : '#94B6FF'} />
          <stop offset="100%" stopColor={isError ? '#E05252' : '#4669E8'} />
        </linearGradient>
        <linearGradient id={bodyGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isError ? '#E86868' : '#5E82F7'} />
          <stop offset="100%" stopColor={isError ? '#B93838' : '#3655CC'} />
        </linearGradient>
      </defs>
      {lv !== null && lv >= 4 && (
        <rect
          className="m-ring"
          x={0.6}
          y={0.6}
          width={26.8}
          height={26.8}
          rx={4.5}
          fill="none"
          stroke="var(--lv)"
          strokeWidth={0.65}
        />
      )}
      <g className="m-body">
        <rect
          x={9.2}
          y={23.2}
          width={3.8}
          height={2.9}
          rx={1.45}
          fill={isError ? '#B93838' : '#3655CC'}
          stroke="#182454"
          strokeWidth={0.8}
        />
        <rect
          x={15.0}
          y={23.2}
          width={3.8}
          height={2.9}
          rx={1.45}
          fill={isError ? '#B93838' : '#3655CC'}
          stroke="#182454"
          strokeWidth={0.8}
        />
        <rect
          className="m-codex-arm-l"
          x={5.4}
          y={18.1}
          width={3.1}
          height={5.0}
          rx={1.55}
          fill={`url(#${bodyGradId})`}
          stroke="#182454"
          strokeWidth={0.8}
        />
        <rect
          className="m-codex-arm-r"
          x={19.5}
          y={18.1}
          width={3.1}
          height={5.0}
          rx={1.55}
          fill={`url(#${bodyGradId})`}
          stroke="#182454"
          strokeWidth={0.8}
        />
        <rect
          x={8.4}
          y={17.5}
          width={11.2}
          height={6.6}
          rx={3.0}
          fill={`url(#${bodyGradId})`}
          stroke="#182454"
          strokeWidth={0.8}
        />
        <path
          d="M 12.1 19.8 L 13.7 20.9 L 12.1 22.0"
          fill="none"
          stroke="#E0F7FA"
          strokeWidth={0.85}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1={14.5}
          y1={21.9}
          x2={16.2}
          y2={21.9}
          stroke="#5CE1E6"
          strokeWidth={0.85}
          strokeLinecap="round"
        />
        <g className="m-codex-head">
          <path
            d={CODEX_CLOUD_PATH}
            fill={`url(#${headGradId})`}
            stroke="#182454"
            strokeWidth={0.8}
            strokeLinejoin="round"
          />
          <rect
            className="m-codex-visor"
            x={7.5}
            y={8.5}
            width={13}
            height={8.5}
            rx={2.5}
            fill={isError ? '#2B1219' : '#111A3D'}
            stroke={isError ? '#C93B48' : '#2D4294'}
            strokeWidth={0.75}
          />
          {state === 'sleeping' ? (
            <g className="m-codex-sleep">
              <line x1={9.8} y1={12.8} x2={12.5} y2={12.8} stroke="#5CE1E6" strokeOpacity={0.55} strokeWidth={1.1} strokeLinecap="round" />
              <line x1={15.5} y1={12.8} x2={18.2} y2={12.8} stroke="#5CE1E6" strokeOpacity={0.55} strokeWidth={1.1} strokeLinecap="round" />
            </g>
          ) : isError ? (
            <g className="m-codex-error">
              <path d="M 9.8 11.6 L 12.0 13.8 M 12.0 11.6 L 9.8 13.8" stroke="#FF8A80" strokeWidth={1.15} strokeLinecap="round" />
              <path d="M 16.0 11.6 L 18.2 13.8 M 18.2 11.6 L 16.0 13.8" stroke="#FF8A80" strokeWidth={1.15} strokeLinecap="round" />
            </g>
          ) : state === 'thinking' ? (
            <g className="m-codex-thinking">
              {[10.8, 14.0, 17.2].map((cx, i) => (
                <circle key={cx} className={`m-dot m-dot-${i + 1}`} cx={cx} cy={12.75} r={0.95} fill="#5CE1E6" />
              ))}
            </g>
          ) : (
            <g className="m-codex-prompt-group">
              <path
                className="m-codex-prompt"
                d="M 10.2 10.9 L 13.1 12.75 L 10.2 14.6"
                fill="none"
                stroke="#5CE1E6"
                strokeWidth={1.25}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect className="m-codex-cursor" x={14.5} y={13.9} width={3.4} height={1.2} rx={0.4} fill="#5CE1E6" />
            </g>
          )}
        </g>
      </g>
      <CommonStatusOverlays28 state={state} lv={lv} announce={announce} />
    </svg>
  )
}

function GeminiMascot({
  uid,
  state,
  size,
  lv,
  announce,
  className,
  ariaLabel,
}: {
  uid: string
  state: MascotState
  size: number
  lv: number | null
  announce: boolean
  className: string
  ariaLabel: string
}) {
  const clipId = `${uid}-gemini-clip`
  const topGradId = `${uid}-gemini-top`
  const leftGradId = `${uid}-gemini-left`
  const botGradId = `${uid}-gemini-bot`
  const specGradId = `${uid}-gemini-spec`
  const isError = state === 'error'
  const showOrbits = state !== 'sleeping'

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 28 28"
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={GEMINI_STAR_PATH} />
        </clipPath>
        <radialGradient id={topGradId} cx="0.45" cy="0.08" r="0.58">
          <stop offset="0%" stopColor="#FA4248" stopOpacity={1} />
          <stop offset="55%" stopColor="#FA4248" stopOpacity={0.68} />
          <stop offset="100%" stopColor="#FA4248" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={leftGradId} cx="0.06" cy="0.5" r="0.58">
          <stop offset="0%" stopColor="#FBBC04" stopOpacity={1} />
          <stop offset="55%" stopColor="#FBBC04" stopOpacity={0.7} />
          <stop offset="100%" stopColor="#FBBC04" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={botGradId} cx="0.45" cy="0.92" r="0.56">
          <stop offset="0%" stopColor="#34A853" stopOpacity={1} />
          <stop offset="55%" stopColor="#34A853" stopOpacity={0.7} />
          <stop offset="100%" stopColor="#34A853" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={specGradId} cx="0.62" cy="0.34" r="0.34">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.48} />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
        </radialGradient>
      </defs>
      {lv !== null && lv >= 4 && (
        <rect
          className="m-ring"
          x={0.6}
          y={0.6}
          width={26.8}
          height={26.8}
          rx={4.5}
          fill="none"
          stroke="var(--lv)"
          strokeWidth={0.65}
        />
      )}
      <g className="m-body m-gemini-star">
        <g clipPath={`url(#${clipId})`}>
          <rect x={2} y={2} width={24} height={24} fill="#3B82F6" />
          <rect x={2} y={2} width={24} height={24} fill={`url(#${topGradId})`} />
          <rect x={2} y={2} width={24} height={24} fill={`url(#${leftGradId})`} />
          <rect x={2} y={2} width={24} height={24} fill={`url(#${botGradId})`} />
          <rect x={2} y={2} width={24} height={24} fill={`url(#${specGradId})`} />
          {isError && <rect x={2} y={2} width={24} height={24} fill="#FA4248" fillOpacity={0.55} />}
        </g>
        <path
          d={GEMINI_STAR_PATH}
          fill="none"
          stroke={isError ? '#FF8A80' : 'rgba(255, 255, 255, 0.2)'}
          strokeWidth={isError ? 0.8 : 0.45}
          strokeLinejoin="round"
        />
        {isError && (
          <path
            className="m-gemini-error-flare"
            d={microStarPath(14, 14, 3.6)}
            fill="#FFE4E6"
            fillOpacity={0.9}
          />
        )}
      </g>
      {showOrbits && (
        <>
          <path
            className="m-gemini-orbit"
            d={microStarPath(22.8, 5.2, 1.9)}
            fill={isError ? '#FF8A80' : '#93C5FD'}
          />
          <path
            className="m-gemini-orbit m-gemini-orbit-b"
            d={microStarPath(5.2, 22.8, 1.6)}
            fill={isError ? '#FA4248' : '#FDE68A'}
          />
        </>
      )}
      <CommonStatusOverlays28 state={state} lv={lv} announce={announce} />
    </svg>
  )
}

export function Mascot({
  state = 'sleeping',
  family = 'claude',
  size = 56,
  level,
  announce = false,
  talking = false,
}: {
  state?: MascotState
  family?: MascotFamily
  size?: number
  level?: number | null
  announce?: boolean
  talking?: boolean
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const lv = level && level >= 1 && level <= 5 ? level : null
  const busy = state === 'working' || state === 'tool' || state === 'thinking'
  const baseLabel = family === 'claude' ? LABEL[state] : LABEL[state].replace('Claude', FAMILY_NAME[family])
  const className = `mascot mascot-family-${family} mascot-${state}${busy ? ' mascot-working' : ''}${lv ? ` mascot-lv${lv}` : ''}${announce ? ' mascot-announce' : ''}${talking ? ' mascot-talking' : ''}`
  const ariaLabel = lv ? `${baseLabel}, nivel ${lv}` : baseLabel

  if (family === 'codex') {
    return (
      <CodexMascot
        uid={uid}
        state={state}
        size={size}
        lv={lv}
        announce={announce}
        className={className}
        ariaLabel={ariaLabel}
      />
    )
  }

  if (family === 'gemini') {
    return (
      <GeminiMascot
        uid={uid}
        state={state}
        size={size}
        lv={lv}
        announce={announce}
        className={className}
        ariaLabel={ariaLabel}
      />
    )
  }

  const cells: ReactElement[] = []
  const eyes: [number, number][] = []
  const calm = state === 'thinking' // los puntos de pensar ocupan el lugar de la chispa
  const grid = GRIDS[family] ?? GRIDS.claude
  grid.forEach((row, y) =>
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
  return (
    <svg
      className={className}
      width={size}
      height={Math.round((size * 12) / 14)}
      viewBox="0 0 14 12"
      shapeRendering="crispEdges"
      role="img"
      aria-label={ariaLabel}
    >
      {lv !== null && lv >= 4 && <rect className="m-ring" x={0.2} y={0.2} width={13.6} height={11.6} rx={1.5} fill="none" stroke="var(--lv)" strokeWidth={0.3} />}
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
        {talking && (
          <g className="m-mouth" fill="var(--mascot-eye)">
            <g className="m-mouth-frame m-mouth-1">
              <rect x={6} y={9} width={2} height={1} />
            </g>
            <g className="m-mouth-frame m-mouth-2">
              <rect x={6} y={8} width={2} height={2} />
            </g>
            <g className="m-mouth-frame m-mouth-3">
              <rect x={5} y={8} width={4} height={1} />
              <rect x={6} y={9} width={2} height={1} />
            </g>
          </g>
        )}
        {state === 'tool' && (
          <>
            {px(0, 9, 'var(--mascot-cheek)', 'm-hand m-hand-a')}
            {px(13, 9, 'var(--mascot-cheek)', 'm-hand m-hand-b')}
          </>
        )}
      </g>
      {lv !== null && lv >= 4 && (
        <>
          {px(1, 4, 'var(--mascot-sweat)', 'm-sweat')}
          {px(12, 5, 'var(--mascot-sweat)', 'm-sweat m-sweat-b')}
        </>
      )}
      {announce && (
        <>
          <g className="m-wave">
            {px(12, 8, 'var(--mascot-cheek)', 'm-wave-arm')}
            {px(13, 7, 'var(--mascot-cheek)', 'm-wave-arm')}
            {px(13, 6, 'var(--mascot-cheek)', 'm-wave-top')}
          </g>
          {GLINTS.map(([x, y, delay]) => (
            <rect key={`g${x}-${y}`} className="m-glint" x={x} y={y} width={1} height={1} fill="var(--mascot-spark)" style={{ animationDelay: `${delay}ms` }} />
          ))}
        </>
      )}
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

// Insignia "N1" a "N5". El color sale de la clase del nivel (--lv en mascot-states.css).
export function LevelBadge({ level }: { level: number }) {
  return (
    <span className={`level-badge mascot-lv${level}`} aria-hidden="true">
      {`N${level}`}
    </span>
  )
}

export function CodexBadge() {
  return (
    <span className="provider-badge codex-badge" title="Codex trabajando" role="img" aria-label="Codex trabajando">
      <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
        <rect x={1} y={1} width={16} height={16} rx={4.5} fill="#111A3D" stroke="#4669E8" strokeWidth={1.3} />
        <path
          d="M 4.6 6.2 L 8.2 9.0 L 4.6 11.8"
          fill="none"
          stroke="#5CE1E6"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line x1={9.4} y1={11.8} x2={13.4} y2={11.8} stroke="#5CE1E6" strokeWidth={1.6} strokeLinecap="round" />
      </svg>
    </span>
  )
}

export function GeminiBadge() {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const clipId = `${uid}-gb-clip`
  const topGradId = `${uid}-gb-top`
  const leftGradId = `${uid}-gb-left`
  const botGradId = `${uid}-gb-bot`

  return (
    <span className="provider-badge gemini-badge" title="Gemini trabajando" role="img" aria-label="Gemini trabajando">
      <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
        <defs>
          <clipPath id={clipId}>
            <path d={GEMINI_BADGE_STAR_PATH} />
          </clipPath>
          <radialGradient id={topGradId} cx="0.45" cy="0.08" r="0.58">
            <stop offset="0%" stopColor="#FA4248" stopOpacity={1} />
            <stop offset="100%" stopColor="#FA4248" stopOpacity={0} />
          </radialGradient>
          <radialGradient id={leftGradId} cx="0.06" cy="0.5" r="0.58">
            <stop offset="0%" stopColor="#FBBC04" stopOpacity={1} />
            <stop offset="100%" stopColor="#FBBC04" stopOpacity={0} />
          </radialGradient>
          <radialGradient id={botGradId} cx="0.45" cy="0.92" r="0.56">
            <stop offset="0%" stopColor="#34A853" stopOpacity={1} />
            <stop offset="100%" stopColor="#34A853" stopOpacity={0} />
          </radialGradient>
        </defs>
        <rect x={1} y={1} width={16} height={16} rx={4.5} fill="#0F172A" stroke="#475569" strokeWidth={1.2} />
        <g clipPath={`url(#${clipId})`}>
          <rect x={3} y={3} width={12} height={12} fill="#3B82F6" />
          <rect x={3} y={3} width={12} height={12} fill={`url(#${topGradId})`} />
          <rect x={3} y={3} width={12} height={12} fill={`url(#${leftGradId})`} />
          <rect x={3} y={3} width={12} height={12} fill={`url(#${botGradId})`} />
        </g>
      </svg>
    </span>
  )
}
