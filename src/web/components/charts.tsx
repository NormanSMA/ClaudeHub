import { useState, type CSSProperties, type PointerEvent } from 'react'
import type { Breakdown } from '../api'
import { compact, dayLabel, niceMax } from '../format'

export const PALETTE = ['#D97757', '#5b8def', '#e3c99b', '#8fb4f2', '#a8553a', '#b8b0a4', '#6fa58a', '#c98bb9']

export interface Series {
  key: string
  color: string
}

export function StackedBars({
  data,
  series,
  height = 240,
}: {
  data: { day: string; values: Record<string, number> }[]
  series: Series[]
  height?: number
}) {
  const W = 680
  const H = height
  const pad = { l: 44, r: 8, t: 8, b: 26 }
  if (!data.length) return <div className="empty">Sin datos en este rango</div>
  const totals = data.map((d) => series.reduce((a, s) => a + (d.values[s.key] ?? 0), 0))
  const max = niceMax(Math.max(...totals))
  const bw = (W - pad.l - pad.r) / data.length
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max)
  const every = Math.max(1, Math.ceil(data.length / 7))
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tokens por dia">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="axis">
            {t === 0 ? '0' : compact(t)}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        let acc = 0
        const x = pad.l + i * bw
        return (
          <g key={d.day}>
            <title>{`${dayLabel(d.day)}: ${compact(totals[i])}`}</title>
            {series.map((s) => {
              const v = d.values[s.key] ?? 0
              const top = y(acc + v)
              const h = y(acc) - top
              const bottom = y(acc)
              acc += v
              return <rect key={s.key} className="chart-bar" x={x + bw * 0.12} y={-1} width={Math.max(1, bw * 0.76)} height={1} fill={s.color}
                style={{ '--bar-base': `${bottom}px`, '--bar-scale': h, '--chart-bottom': `${y(0)}px` } as CSSProperties} />
            })}
            {i % every === 0 && (
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="axis">
                {dayLabel(d.day)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** Rellena los dias sin actividad para que el eje X sea continuo. */
export function fillDays<T extends { day: string }>(rows: T[], empty: (day: string) => T): T[] {
  if (rows.length < 2) return rows
  const byDay = new Map(rows.map((r) => [r.day, r]))
  const out: T[] = []
  const [y, m, d] = rows[0].day.split('-').map(Number)
  const [y2, m2, d2] = rows[rows.length - 1].day.split('-').map(Number)
  const end = new Date(y2, m2 - 1, d2).getTime()
  for (let t = new Date(y, m - 1, d); t.getTime() <= end; t.setDate(t.getDate() + 1)) {
    const k = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    out.push(byDay.get(k) ?? empty(k))
  }
  return out
}

export function Heatmap({ days }: { days: { day: string; tokens: number }[] }) {
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const vals = days.filter((d) => d.tokens > 0).map((d) => d.tokens).sort((a, b) => a - b)
  const q = (f: number) => vals[Math.min(vals.length - 1, Math.floor(vals.length * f))] ?? 0
  const cuts = [q(0.25), q(0.5), q(0.75)]
  const level = (v: number) => (v <= 0 ? 0 : v <= cuts[0] ? 1 : v <= cuts[1] ? 2 : v <= cuts[2] ? 3 : 4)
  return (
    <div className="heatmap" role="img" aria-label="Actividad por dia">
      {days.map((d, i) => (
        <span
          key={d.day}
          className={`cell l${d.day > todayKey ? 'x' : level(d.tokens)}`}
          style={{ '--cell-delay': `${(Math.floor(i / 7) + i % 7) * 18}ms` } as CSSProperties}
          title={`${dayLabel(d.day)}: ${compact(d.tokens)} tokens`}
        />
      ))}
    </div>
  )
}

/** Curva suave por los puntos: control horizontal en el punto medio de cada tramo. */
function smoothPath(pts: { x: number; y: number }[]): string {
  return pts.reduce((d, p, i) => {
    if (i === 0) return `M ${p.x},${p.y}`
    const q = pts[i - 1]
    const cx = (q.x + p.x) / 2
    return `${d} C ${cx},${q.y} ${cx},${p.y} ${p.x},${p.y}`
  }, '')
}

export function Sparkline({ values, width = 96, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pts = values.map((value, i) => ({
    x: 3 + (i / (values.length - 1)) * (width - 6),
    y: max === min ? height / 2 : 3 + (1 - (value - min) / (max - min)) * (height - 6),
  }))
  const last = pts[pts.length - 1]
  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path className="sparkline-line" d={smoothPath(pts)} pathLength={1} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle className="sparkline-dot" cx={last.x} cy={last.y} r={3} fill="var(--accent)" />
    </svg>
  )
}

/** Area suave de tokens por dia con cursor vertical y globo al pasar el puntero. */
export function TokenAreaChart({ days }: { days: { day: string; tokens: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  if (days.length < 2) return null
  const W = 640
  const H = 150
  const padX = 8
  const top = 12
  const bottom = 22
  const max = Math.max(...days.map((d) => d.tokens), 1)
  const pts = days.map((d, i) => ({
    x: padX + (i / (days.length - 1)) * (W - padX * 2),
    y: top + (1 - d.tokens / max) * (H - top - bottom),
  }))
  const line = smoothPath(pts)
  const area = `${line} L ${pts[pts.length - 1].x},${H - bottom} L ${pts[0].x},${H - bottom} Z`
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const f = (e.clientX - r.left) / r.width
    setHover(Math.min(days.length - 1, Math.max(0, Math.round(((f * W - padX) / (W - padX * 2)) * (days.length - 1)))))
  }
  const h = hover === null ? null : { p: pts[hover], d: days[hover] }
  const tipLeft = h ? Math.min(78, Math.max(22, (h.p.x / W) * 100)) : 0
  return (
    <div className="area-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tokens por dia" onPointerMove={move} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={padX} x2={W - padX} y1={H - bottom} y2={H - bottom} stroke="var(--line)" />
        <g className="area-reveal">
          <path d={area} fill="url(#area-fill)" />
          <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </g>
        <text x={padX} y={H - 6} className="area-axis">{dayLabel(days[0].day)}</text>
        <text x={W - padX} y={H - 6} textAnchor="end" className="area-axis">{dayLabel(days[days.length - 1].day)}</text>
        {h && (
          <g className="area-scrub">
            <line x1={h.p.x} x2={h.p.x} y1={top} y2={H - bottom} stroke="var(--muted)" strokeDasharray="3 3" />
            <circle cx={h.p.x} cy={h.p.y} r={4.5} fill="var(--bg)" stroke="var(--accent)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {h && (
        <div className="area-tip" style={{ left: `${tipLeft}%` }}>
          <b>{compact(h.d.tokens)}</b> <span>{dayLabel(h.d.day)}</span>
        </div>
      )}
    </div>
  )
}

export function ArcGauge({ pct, color }: { pct: number; color: string }) {
  const value = Math.min(100, Math.max(0, pct))
  return (
    <svg className="arc-gauge" viewBox="0 0 100 56" role="img" aria-label={`Nivel ${Math.round(pct)}%`}>
      <path d="M 6 50 A 44 44 0 0 1 94 50" fill="none" stroke="var(--line)" strokeWidth={8} strokeLinecap="round" />
      <path className="arc-gauge-value" d="M 6 50 A 44 44 0 0 1 94 50" fill="none" stroke={color}
        strokeWidth={8} strokeLinecap="round" pathLength={100} strokeDasharray={`${value} 100`} />
      <g className="arc-needle" style={{ transform: `translate(50px, 50px) rotate(${-90 + (value / 100) * 180}deg)` }}>
        <line x1={0} y1={0} x2={0} y2={-32} stroke="var(--text)" strokeWidth={2} strokeLinecap="round" />
        <circle cx={0} cy={0} r={3.5} fill="var(--text)" />
      </g>
    </svg>
  )
}

export interface Segment {
  key: 'input' | 'cacheWrite' | 'cacheRead' | 'output' | 'reasoning'
  label: string
  value: number
  color: string
}

/**
 * Segmentos del desglose. `reasoning` es parte de `output`: la salida visible lo descuenta
 * para que la suma de segmentos iguale `total` sin doble conteo.
 */
export function categorySegments(t: Breakdown): Segment[] {
  const output = Math.max(0, t.output)
  const thinking = Math.min(Math.max(0, t.reasoning ?? 0), output)
  return [
    { key: 'input', label: 'Entrada', value: t.input, color: 'var(--blue)' },
    { key: 'cacheWrite', label: 'Escritura de cache', value: t.cacheWrite, color: 'var(--warn)' },
    { key: 'cacheRead', label: 'Lectura de cache', value: t.cacheRead, color: 'var(--ok)' },
    { key: 'output', label: 'Salida', value: Math.max(0, output - thinking), color: 'var(--accent)' },
    { key: 'reasoning', label: 'Pensamiento', value: thinking, color: 'var(--violet)' },
  ]
}

export function CategoryBar({ tokens }: { tokens: Breakdown }) {
  const segs = categorySegments(tokens)
  const sum = segs.reduce((a, s) => a + s.value, 0) || 1
  let offset = 0
  return (
    <div className="catbar">
      <div className="catbar-track" role="img" aria-label="Desglose de tokens por categoria">
        {segs.map((s) => {
          const start = offset
          offset += s.value / sum
          return <i key={s.key} title={`${s.label}: ${compact(s.value)}`}
            style={{ '--bar-start': `${start * 100}%`, '--bar-scale': s.value / sum, background: s.color } as CSSProperties} />
        })}
      </div>
      <ul className="catbar-legend">
        {segs.map((s) => (
          <li key={s.key}>
            <i style={{ background: s.color }} />
            <span className="name">{s.label}</span>
            <span className="val">{compact(s.value)}</span>
          </li>
        ))}
      </ul>
      {!tokens.reasoning && <p className="active-meta">Claude no separa el pensamiento: va incluido en salida.</p>}
    </div>
  )
}

export function SplitBar({ a, b }: { a: number; b: number }) {
  const t = a + b || 1
  return (
    <span className="split" title={`Orquestador ${compact(a)} / Subagentes ${compact(b)}`}>
      <i style={{ '--bar-start': '0%', '--bar-scale': a / t, background: 'var(--accent)' } as CSSProperties} />
      <i style={{ '--bar-start': `${(a / t) * 100}%`, '--bar-scale': b / t, background: 'var(--blue)' } as CSSProperties} />
    </span>
  )
}
