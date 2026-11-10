export type RangeId = 'all' | '30d' | '7d' | 'custom'

const RANGES: { id: RangeId; label: string }[] = [
  { id: 'all', label: 'Todo' },
  { id: '30d', label: '30d' },
  { id: '7d', label: '7d' },
  { id: 'custom', label: 'Fechas' },
]

export function RangeGroup({ range, onChange }: { range: RangeId; onChange: (id: RangeId) => void }) {
  return (
    <div className="tabs ranges" role="group" aria-label="Rango">
      {RANGES.map((r) => (
        <button key={r.id} type="button" className={range === r.id ? 'on' : ''} aria-pressed={range === r.id} onClick={() => onChange(r.id)}>
          {r.label}
        </button>
      ))}
    </div>
  )
}
