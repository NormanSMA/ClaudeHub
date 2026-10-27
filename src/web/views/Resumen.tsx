import type { ReactNode } from 'react'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { CategoryBar, Heatmap, Sparkline, TokenAreaChart } from '../components/charts'
import { Loading } from '../components/Loading'
import { useApi, type Billing, type Summary } from '../api'
import { billingText, compact, fmtUsd, hourLabel, int, pct } from '../format'
import { RolesView } from './Roles'

// ~38.9k tokens, la longitud aproximada de "Rebelion en la granja"
const BOOK_TOKENS = 38_918

function Stat({ label, value, hint, labelTitle, valueTitle, showHint }: { label: string; value: ReactNode; hint?: string; labelTitle?: string; valueTitle?: string; showHint?: boolean }) {
  return (
    <div className="stat" title={hint}>
      <div className="stat-label" title={labelTitle}>{label}</div>
      <div className="stat-value" title={valueTitle}>{value}</div>
      {showHint && <div className="stat-sub">{hint}</div>}
    </div>
  )
}

export function ResumenView({ q, qClaude, billing }: { q: string; qClaude: string; billing: Billing }) {
  const { data, error } = useApi<Summary>(`/api/summary?${q}`)
  if (!data) return <Loading error={error} />
  const t = data.tokens
  const cost = billingText(billing)
  const now = new Date()
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return (
    <>
      <section className="stats summary-primary" aria-label="Métricas principales">
        <Stat
          label={`${cost.label} del rango`}
          labelTitle={cost.title}
          value={<AnimatedNumber value={t.costUsd ?? 0} format={fmtUsd} />}
          hint={`Ahorro por caché ${fmtUsd(t.cacheSavingsUsd ?? 0)}${(t.costUnpriced ?? 0) > 0 ? ` · ${compact(t.costUnpriced ?? 0)} tokens sin precio` : ''}`}
          showHint
        />
        <div className="stat">
          <div className="stat-label">Tokens nuevos frente a lectura de caché</div>
          <div className="summary-token-pair">
            <div title="Entrada + escritura de caché + salida">
              <div className="stat-value"><AnimatedNumber value={t.fresh ?? t.input + t.cacheWrite + t.output} format={compact} /></div>
              <div className="stat-sub">Nuevos</div>
            </div>
            <div>
              <div className="stat-value"><AnimatedNumber value={t.cacheRead} format={compact} /></div>
              <div className="stat-sub">Lectura de caché</div>
            </div>
          </div>
          <div className="stat-sub">{compact(t.total)} tokens totales</div>
          <Sparkline values={data.heatmap.slice(-30).map((d) => d.tokens)} />
        </div>
        <Stat
          label="Sesiones y mensajes"
          value={<><AnimatedNumber value={data.sessions} format={int} /> sesiones</>}
          hint={`${int(data.messages)} mensajes · Respuestas del modelo, sin duplicados`}
          showHint
        />
      </section>
      <section className="stats small summary-secondary" aria-label="Métricas secundarias">
        <Stat label="Días activos" value={<AnimatedNumber value={data.activeDays} format={int} />} />
        <Stat label="Hora pico" value={hourLabel(data.peakHour)} />
        <Stat label="Modelo favorito" value={data.favoriteModel ?? '-'} />
      </section>
      <Heatmap days={data.heatmap} />
      <TokenAreaChart days={data.heatmap.filter((d) => d.day <= todayKey)} />
      <p className="note">Usaste ~{int(Math.round(t.total / BOOK_TOKENS))}x mas tokens que Rebelion en la granja.</p>
      <div className="stats two">
        <Stat
          label="Eficiencia de cache"
          value={<AnimatedNumber value={t.cacheRead / Math.max(1, t.input + t.cacheWrite + t.cacheRead)} format={pct} />}
          hint="Parte de la entrada que se leyo desde cache"
        />
        <Stat label="Salida visible" value={<AnimatedNumber value={Math.max(0, t.output - (t.reasoning ?? 0))} format={compact} />} hint="Salida sin pensamiento" />
      </div>
      <CategoryBar tokens={t} />
      <h3 className="section-title">Orquestador vs subagentes (solo Claude)</h3>
      <RolesView q={qClaude} />
    </>
  )
}
