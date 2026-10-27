import { useMemo } from 'react'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { StackedBars, fillDays } from '../components/charts'
import { Loading } from '../components/Loading'
import { useSort } from '../components/sort'
import { useApi, type RolesReport } from '../api'
import { compact, int, pct } from '../format'

type AgentRow = RolesReport['agents'][number]

export function RolesView({ q }: { q: string }) {
  const { data, error } = useApi<RolesReport>(`/api/roles?${q}`)
  const agents = useMemo(() => data?.agents ?? [], [data])
  const { sorted, th } = useSort<AgentRow>(
    agents,
    { agent: (a) => a.agent, messages: (a) => a.messages, output: (a) => a.output, total: (a) => a.total },
    'total',
  )
  if (!data) return <Loading error={error} />
  const rows = fillDays(
    data.daily.map((d) => ({ day: d.day, values: { Orquestador: d.orchestrator, Subagentes: d.subagent } })),
    (day) => ({ day, values: {} as Record<string, number> }),
  )
  const o = data.orchestrator
  const s = data.subagent
  return (
    <>
      <div className="stats two">
        <div className="stat role">
          <div className="stat-label">
            <i className="dot" style={{ background: 'var(--accent)' }} /> Orquestador
          </div>
          <div className="stat-value"><AnimatedNumber value={o.total} format={compact} /></div>
          <div className="stat-sub">
            {pct(o.share)} · {int(o.messages)} mensajes · salida {compact(o.output)}
          </div>
        </div>
        <div className="stat role">
          <div className="stat-label">
            <i className="dot" style={{ background: 'var(--blue)' }} /> Subagentes
          </div>
          <div className="stat-value"><AnimatedNumber value={s.total} format={compact} /></div>
          <div className="stat-sub">
            {pct(s.share)} · {int(s.messages)} mensajes · salida {compact(s.output)}
          </div>
        </div>
      </div>
      <StackedBars
        data={rows}
        series={[
          { key: 'Orquestador', color: 'var(--accent)' },
          { key: 'Subagentes', color: 'var(--blue)' },
        ]}
      />
      <h3>Subagentes por tipo</h3>
      {sorted.length === 0 ? (
        <div className="empty">No hubo subagentes en este rango</div>
      ) : (
        <table>
          <thead>
            <tr>
              {th('agent', 'Tipo')}
              {th('messages', 'Mensajes', true)}
              {th('output', 'Salida', true)}
              {th('total', 'Tokens', true)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => (
              <tr key={a.agent}>
                <td>{a.agent}</td>
                <td className="num">{int(a.messages)}</td>
                <td className="num">{compact(a.output)}</td>
                <td className="num">{compact(a.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
