import { cloneElement, useMemo } from 'react'
import { SplitBar } from '../components/charts'
import { Loading } from '../components/Loading'
import { useSort } from '../components/sort'
import { useApi, type Billing, type ProjectRow } from '../api'
import { billingText, compact, fmtUsd, int } from '../format'

export function ProyectosView({ q, billing }: { q: string; billing: Billing }) {
  const cost = billingText(billing)
  const { data, error } = useApi<ProjectRow[]>(`/api/projects?${q}`)
  const all = useMemo(() => data ?? [], [data])
  const { sorted, th } = useSort<ProjectRow>(
    all,
    { project: (p) => p.project, split: (p) => p.sub / (p.total || 1), sessions: (p) => p.sessions, total: (p) => p.total, costUsd: (p) => p.costUsd },
    'total',
  )
  if (!data) return <Loading error={error} />
  return (
    <table className="projects-table">
      <thead>
        <tr>
          {th('project', 'Proyecto')}
          {th('split', 'Reparto')}
          {th('sessions', 'Sesiones', true)}
          {th('total', 'Tokens', true)}
          {cloneElement(th('costUsd', cost.label, true), { title: cost.title })}
        </tr>
      </thead>
      <tbody>
        {sorted.map((p) => (
          <tr key={p.project}>
            <td>{p.project}</td>
            <td>
              <SplitBar a={p.orch} b={p.sub} />
            </td>
            <td className="num">{int(p.sessions)}</td>
            <td className="num">{compact(p.total)}</td>
            <td className="num project-cost"><strong>{fmtUsd(p.costUsd)}</strong></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
