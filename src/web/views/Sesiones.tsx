import { cloneElement, useMemo, useState } from 'react'
import { SplitBar } from '../components/charts'
import { Loading } from '../components/Loading'
import { useSort } from '../components/sort'
import { useApi, type Billing, type SessionRow } from '../api'
import { billingText, compact, dateLabel, fmtUsd, int } from '../format'

// encima de esto cada turno relee mucho contexto de cache
const HEAVY_CONTEXT = 600_000

export function SesionesView({ q, billing }: { q: string; billing: Billing }) {
  const cost = billingText(billing)
  const { data, error } = useApi<SessionRow[]>(`/api/sessions?${q}`)
  const [text, setText] = useState('')
  const [project, setProject] = useState('')
  const all = useMemo(() => data ?? [], [data])
  const projects = useMemo(() => [...new Set(all.map((s) => s.project))].sort((a, b) => a.localeCompare(b, 'es')), [all])
  const rows = useMemo(() => {
    const needle = text.trim().toLowerCase()
    return all.filter(
      (s) => (!project || s.project === project) && (!needle || (s.title + ' ' + s.project).toLowerCase().includes(needle)),
    )
  }, [all, text, project])
  const { sorted, th } = useSort<SessionRow>(
    rows,
    {
      title: (s) => s.title,
      last: (s) => s.last,
      split: (s) => s.sub / (s.total || 1),
      messages: (s) => s.messages,
      total: (s) => s.total,
      costUsd: (s) => s.costUsd,
    },
    'total',
  )
  if (!data) return <Loading error={error} />
  return (
    <>
      <div className="filters">
        <input
          className="search"
          type="search"
          placeholder="Buscar por titulo o proyecto"
          aria-label="Buscar sesiones"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <select aria-label="Filtrar por proyecto" value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="">Todos los proyectos</option>
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <table className="sessions-table">
        <thead>
          <tr>
            {th('title', 'Chat')}
            {th('last', 'Ultimo uso')}
            {th('split', 'Reparto')}
            {th('messages', 'Mensajes', true)}
            {th('total', 'Tokens', true)}
            {cloneElement(th('costUsd', cost.label, true), { title: cost.title })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr key={s.session}>
              <td className="title" title={`${s.title} - ${s.project} (${s.session.slice(0, 8)})`}>
                {s.title}
                <div className="active-meta">
                  {s.project}
                  {(s.peakContext ?? 0) > HEAVY_CONTEXT && (
                    <span className="heavy-tag" title={`Pico de contexto: ${int(s.peakContext ?? 0)} tokens. Cada turno relee todo ese contexto.`}>
                      Contexto pesado
                    </span>
                  )}
                </div>
              </td>
              <td>{dateLabel(s.last)}</td>
              <td>
                <SplitBar a={s.orch} b={s.sub} />
              </td>
              <td className="num">{int(s.messages)}</td>
              <td className="num">{compact(s.total)}</td>
              <td className="num">{fmtUsd(s.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && <div className="empty">Ningun chat coincide con los filtros</div>}
    </>
  )
}
