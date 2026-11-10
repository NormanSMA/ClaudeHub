import { compact, fmtUsd, int } from '../format'
import { AnimatedNumber } from './AnimatedNumber'

export interface TodayTokens {
  todayTokens: number
  todayFresh?: number
  todayCacheRead?: number
  todayCostUsd?: number
  todayCostUnpriced?: number
  todayBySource?: Partial<Record<string, { fresh: number; costUsd: number; costUnpriced: number }>>
}

const SOURCE_LABEL: Record<string, string> = { claude: 'Claude', codex: 'Codex', gemini: 'Gemini', omniroute: 'OmniRoute' }

/** Una linea por fuente con consumo hoy. Con una sola fuente no hace falta desglose. */
function sourceLines(t: TodayTokens): string {
  const rows = Object.entries(t.todayBySource ?? {}).filter(([, v]) => v && v.fresh > 0)
  if (rows.length < 2) return ''
  return (
    '\nPor fuente (nuevos · valor API):\n' +
    rows.map(([k, v]) => `  ${SOURCE_LABEL[k] ?? k}: ${int(v!.fresh)} · ${v!.costUnpriced > 0 && v!.costUsd === 0 ? 'sin precio' : `~${fmtUsd(v!.costUsd)}`}`).join('\n')
  )
}

/** Textos del contador de hoy. Sin los campos nuevos (servidor viejo) cae al total. */
export function todayText(t: TodayTokens): { main: string; cache: string | null; title: string } {
  const cost = t.todayCostUsd === undefined ? '' : ` · ~${fmtUsd(t.todayCostUsd)}`
  if (t.todayFresh === undefined || t.todayCacheRead === undefined) {
    return { main: `Hoy ${compact(t.todayTokens)}${cost}`, cache: null, title: `Tokens de hoy: ${int(t.todayTokens)}` }
  }
  const unpriced = (t.todayCostUnpriced ?? 0) > 0 ? `\n${int(t.todayCostUnpriced!)} tokens de modelos sin tarifa no entran en el valor.` : ''
  return {
    main: `Hoy ${compact(t.todayFresh)} nuevos${cost}`,
    cache: `${compact(t.todayCacheRead)} caché`,
    title:
      `Hoy, todas las fuentes activas.\n` +
      `Nuevos (entrada + escritura de caché + salida): ${int(t.todayFresh)}\n` +
      `Lectura de caché: ${int(t.todayCacheRead)}\n` +
      `Total: ${int(t.todayTokens)}` +
      (t.todayCostUsd === undefined ? '' : `\nValor API estimado: ~${fmtUsd(t.todayCostUsd)}. No es lo que cobra una suscripción.`) +
      unpriced +
      sourceLines(t),
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
