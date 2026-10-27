import type { ModelVia } from '../api'
import { compact, msText, pct } from '../format'
import { OmniLogo } from './OmniLogo'
import './omni-badge.css'

function errorsText(via: ModelVia): string {
  const parts = [
    via.e429 && `${via.e429} con 429`,
    via.e403 && `${via.e403} con 403`,
    via.e5xx && `${via.e5xx} con 5xx`,
  ].filter(Boolean)
  return parts.length ? ` Errores: ${parts.join(', ')}.` : ''
}

/** Texto del title y del aria-label: lo que paso por OmniRoute para este modelo. */
export function viaDetail(via: ModelVia): string {
  const head = `Via OmniRoute: ${via.calls} llamadas, ${pct(via.successRate)} de exito, p95 ${msText(via.p95Ms)}, ${compact(via.tokens)} tokens.`
  return `${head}${errorsText(via)} Proveedores: ${via.providers.join(', ')}.`
}

/** Logo de OmniRoute para un modelo que paso por OmniRoute. El detalle de uso va en title y aria-label. */
export function OmniBadge({ via }: { via: ModelVia }) {
  const detail = viaDetail(via)
  return (
    <span className="omni-badge" role="img" aria-label={detail} title={detail}>
      <OmniLogo />
    </span>
  )
}
