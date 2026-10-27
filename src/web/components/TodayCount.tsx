import { compact, fmtUsd, int } from '../format'
import { AnimatedNumber } from './AnimatedNumber'

export interface TodayTokens {
  todayTokens: number
  todayFresh?: number
  todayCacheRead?: number
  todayCostUsd?: number
}

/** Textos del contador de hoy. Sin los campos nuevos (servidor viejo) cae al total. */
export function todayText(t: TodayTokens): { main: string; cache: string | null; title: string } {
  const cost = t.todayCostUsd === undefined ? '' : ` · ~${fmtUsd(t.todayCostUsd)}`
  if (t.todayFresh === undefined || t.todayCacheRead === undefined) {
    return { main: `Hoy ${compact(t.todayTokens)}${cost}`, cache: null, title: `Tokens de hoy: ${int(t.todayTokens)}` }
  }
  return {
    main: `Hoy ${compact(t.todayFresh)} nuevos${cost}`,
    cache: `${compact(t.todayCacheRead)} caché`,
    title:
      `Nuevos (entrada + escritura de caché + salida): ${int(t.todayFresh)}\n` +
      `Lectura de caché: ${int(t.todayCacheRead)}\n` +
      `Total: ${int(t.todayTokens)}`,
  }
}

/** "Hoy 1.05M nuevos" y debajo "44.1M caché". */
export function TodayCount({ data, className = '' }: { data: TodayTokens | null | undefined; className?: string }) {
  if (!data) return <span className={`today-count ${className}`} />
  const t = todayText(data)
  const hasCache = data.todayFresh !== undefined && data.todayCacheRead !== undefined
  return (
    <span className={`today-count ${className}`} title={t.title}>
      <span>
        Hoy <AnimatedNumber value={hasCache ? data.todayFresh! : data.todayTokens} format={compact} />
        {hasCache && ' nuevos'}
        {data.todayCostUsd !== undefined && <> · ~<AnimatedNumber value={data.todayCostUsd} format={fmtUsd} /></>}
      </span>
      {hasCache && <small><AnimatedNumber value={data.todayCacheRead!} format={compact} /> caché</small>}
    </span>
  )
}
