import { useMemo, useState } from 'react'
import { useApi, type Billing, type ModelsReport } from './api'
import { PALETTE, StackedBars, fillDays } from './charts'
import { billingText, compact, fmtUsd, pct } from './format'
import { Loading } from './Loading'
import { OmniBadge } from './OmniBadge'

type ModelRow = ModelsReport['models'][number]

const MODEL_SORTS: { id: string; label: string; get: (m: ModelRow) => string | number }[] = [
  { id: 'total', label: 'Tokens', get: (m) => m.total },
  { id: 'input', label: 'Entrada', get: (m) => m.input },
  { id: 'output', label: 'Salida', get: (m) => m.output },
  { id: 'costUsd', label: 'Costo', get: (m) => m.costUsd ?? 0 },
  { id: 'model', label: 'Nombre', get: (m) => m.model },
]

function SortTools({ sortId, desc, onSort, onDesc, billing }: { sortId: string; desc: boolean; onSort: (id: string) => void; onDesc: (desc: boolean) => void; billing: Billing }) {
  return (
    <div className="legend-tools">
      <label htmlFor="model-sort">Ordenar por</label>
      <select
        id="model-sort"
        value={sortId}
        onChange={(e) => {
          onSort(e.target.value)
          onDesc(e.target.value !== 'model')
        }}
      >
        {MODEL_SORTS.map((o) => (
          <option key={o.id} value={o.id}>
            {o.id === 'costUsd' ? billingText(billing).label : o.label}
          </option>
        ))}
      </select>
      <button className="link" onClick={() => onDesc(!desc)} title="Invertir orden">
        {desc ? 'Mayor a menor' : 'Menor a mayor'}
      </button>
    </div>
  )
}

function ModelLegendItem({ m, color, billing }: { m: ModelRow; color: string; billing: Billing }) {
  return (
    <li>
      <i style={{ background: color }} />
      <span className="name">
        {m.model}
        {m.via && <OmniBadge via={m.via} />}
      </span>
      <span className="detail">
        {compact(m.input)} entrada · {compact(m.output)} salida
      </span>
      <span className="model-cost num" title={billingText(billing).title}>
        {(m.costUsd ?? 0) === 0 && (m.costUnpriced ?? 0) > 0 ? 'sin precio' : fmtUsd(m.costUsd ?? 0)}
      </span>
      <span className="share">{pct(m.share)}</span>
    </li>
  )
}

export function ModelosView({ q, billing = 'subscription' }: { q: string; billing?: Billing }) {
  const { data, error } = useApi<ModelsReport>(`/api/models?${q}`)
  const [more, setMore] = useState(false)
  const [sortId, setSortId] = useState('total')
  const [desc, setDesc] = useState(true)
  const ordered = useMemo(() => {
    const get = MODEL_SORTS.find((s) => s.id === sortId)!.get
    const m = desc ? -1 : 1
    return [...(data?.models ?? [])].sort((a, b) => {
      const x = get(a)
      const y = get(b)
      return (typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y, 'es') : Number(x) - Number(y)) * m
    })
  }, [data, sortId, desc])
  if (!data) return <Loading error={error} />
  const names = data.models.map((m) => m.model)
  const color = (m: string) => PALETTE[names.indexOf(m) % PALETTE.length]
  const series = names.map((k) => ({ key: k, color: color(k) })).reverse()
  const rows = fillDays(
    data.daily.map((d) => ({ day: d.day, values: d.byModel })),
    (day) => ({ day, values: {} }),
  )
  const shown = more ? ordered : ordered.slice(0, 6)
  return (
    <>
      <StackedBars data={rows} series={series} />
      <SortTools sortId={sortId} desc={desc} onSort={setSortId} onDesc={setDesc} billing={billing} />
      <div className="model-cost-head">
        <button className="sort" title={billingText(billing).title} onClick={() => {
          setSortId('costUsd')
          setDesc(sortId === 'costUsd' ? !desc : true)
        }}>
          {billingText(billing).label}
        </button>
      </div>
      <ul className="legend model-legend">
        {shown.map((m) => (
          <ModelLegendItem key={m.model} m={m} color={color(m.model)} billing={billing} />
        ))}
      </ul>
      {ordered.length > 6 && (
        <button className="link" onClick={() => setMore(!more)}>
          {more ? 'Mostrar menos' : `Mostrar ${ordered.length - 6} mas`}
        </button>
      )}
    </>
  )
}
