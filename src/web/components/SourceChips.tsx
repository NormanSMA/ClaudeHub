import type { SourceId, SourceInfo, SourcesReport } from '../api'
import { int } from '../format'
import { OmniLogo } from './OmniLogo'

export type SourceFilter = 'all' | SourceId

const SOURCES: { id: SourceFilter; label: string; color: string }[] = [
  { id: 'all', label: 'Todas', color: 'var(--muted)' },
  { id: 'claude', label: 'Claude', color: 'var(--accent)' },
  { id: 'codex', label: 'Codex', color: 'var(--blue)' },
  { id: 'gemini', label: 'Gemini', color: 'var(--violet)' },
  { id: 'omniroute', label: 'OmniRoute', color: 'var(--ok)' },
]

const SOURCE_KEY = 'source'

export function loadSource(): SourceFilter {
  try {
    const v = localStorage.getItem(SOURCE_KEY)
    return SOURCES.find((s) => s.id === v)?.id ?? 'all'
  } catch {
    return 'all'
  }
}

export function saveSource(id: SourceFilter) {
  try {
    localStorage.setItem(SOURCE_KEY, id)
  } catch {
    /* sin almacenamiento */
  }
}

function sourceHint(info: SourceInfo): string | undefined {
  if (info.reason) return info.reason
  if (!info.enabled) return 'Fuente desactivada'
  if (!info.ok) return 'La fuente no se pudo leer'
  return undefined
}

export function sourceChipText(id: SourceFilter, info: SourceInfo | undefined) {
  if (!info) return { text: undefined, title: undefined }
  if (id === 'omniroute' && !info.enabled) return { text: 'apagada', title: 'Actívala en Ajustes' }
  return { text: int(info.records), title: sourceHint(info) }
}

export function SourceChips({ source, onChange, report }: {
  source: SourceFilter
  onChange: (id: SourceFilter) => void
  report: SourcesReport | null
}) {
  return (
    <div className="sources" role="group" aria-label="Fuente">
      {SOURCES.map((s) => {
        const info = s.id === 'all' ? undefined : report?.[s.id]
        const dim = info ? !info.enabled || !info.ok : false
        const { text, title } = sourceChipText(s.id, info)
        return (
          <button
            key={s.id}
            type="button"
            className={`chip${source === s.id ? ' on' : ''}${dim ? ' dim' : ''}`}
            aria-pressed={source === s.id}
            title={title}
            onClick={() => onChange(s.id)}
          >
            {s.id === 'omniroute' ? <OmniLogo size={12} /> : <i className="dot" style={{ background: s.color }} />}
            {s.label}
            {info && <span className="chip-count">{text}</span>}
          </button>
        )
      })}
    </div>
  )
}
