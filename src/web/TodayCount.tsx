import { compact, int } from './format'

export interface TodayTokens {
  todayTokens: number
  todayFresh?: number
  todayCacheRead?: number
}

/** Textos del contador de hoy. Sin los campos nuevos (servidor viejo) cae al total. */
export function todayText(t: TodayTokens): { main: string; cache: string | null; title: string } {
  if (t.todayFresh === undefined || t.todayCacheRead === undefined) {
    return { main: `Hoy ${compact(t.todayTokens)}`, cache: null, title: `Tokens de hoy: ${int(t.todayTokens)}` }
  }
  return {
    main: `Hoy ${compact(t.todayFresh)} nuevos`,
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
  return (
    <span className={`today-count ${className}`} title={t.title}>
      <span>{t.main}</span>
      {t.cache && <small>{t.cache}</small>}
    </span>
  )
}
