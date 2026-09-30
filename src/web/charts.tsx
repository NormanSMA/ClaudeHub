import { compact, dayLabel, niceMax } from './format'

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
              if (!v) return null
              const top = y(acc + v)
              const h = y(acc) - top
              acc += v
              return <rect key={s.key} x={x + bw * 0.12} y={top} width={Math.max(1, bw * 0.76)} height={h} fill={s.color} />
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
      {days.map((d) => (
        <span
          key={d.day}
          className={`cell l${d.day > todayKey ? 'x' : level(d.tokens)}`}
          title={`${dayLabel(d.day)}: ${compact(d.tokens)} tokens`}
        />
      ))}
    </div>
  )
}

export function SplitBar({ a, b }: { a: number; b: number }) {
  const t = a + b || 1
  return (
    <span className="split" title={`Orquestador ${compact(a)} / Subagentes ${compact(b)}`}>
      <i style={{ width: `${(a / t) * 100}%`, background: 'var(--accent)' }} />
      <i style={{ width: `${(b / t) * 100}%`, background: 'var(--blue)' }} />
    </span>
  )
}
