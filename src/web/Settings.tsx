import { useEffect, useState, type FormEvent } from 'react'
import { useApi, type SettingsInfo } from './api'
import { int } from './format'

const PRESETS = [
  { value: '', label: 'Automático (estimado)' },
  { value: '200000', label: '200 000' },
  { value: '1000000', label: '1 000 000' },
  { value: 'custom', label: 'Otro valor' },
]

interface Form {
  name: string
  alertAt: number
  activeMinutes: number
  limits: Record<string, number>
}

function presetOf(limit: number | undefined): string {
  if (limit === undefined) return ''
  return limit === 200_000 ? '200000' : limit === 1_000_000 ? '1000000' : 'custom'
}

export function SettingsView() {
  const { data, error } = useApi<SettingsInfo>('/api/settings', 600_000)
  const [form, setForm] = useState<Form | null>(null)
  const [custom, setCustom] = useState<Record<string, boolean>>({})
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!data || form) return
    const c = data.config
    setForm({ name: c.name, alertAt: Math.round(c.alertAt * 100), activeMinutes: c.activeMinutes, limits: { ...c.contextLimits } })
    setCustom(Object.fromEntries(Object.entries(c.contextLimits).map(([m, v]) => [m, presetOf(v) === 'custom'])))
  }, [data, form])

  if (!data || !form) return <div className="empty">{error ? `No se pudo cargar (${error}).` : 'Cargando ajustes...'}</div>

  const models = [...new Set([...data.models, ...Object.keys(form.limits)])]

  const setLimit = (model: string, v: number | undefined) =>
    setForm((f) => {
      if (!f) return f
      const limits = { ...f.limits }
      if (v === undefined) delete limits[model]
      else limits[model] = v
      return { ...f, limits }
    })

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    setStatus(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          alertAt: form.alertAt / 100,
          activeMinutes: form.activeMinutes,
          contextLimits: form.limits,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? String(res.status))
      setStatus({ ok: true, text: 'Guardado. Los cambios ya están activos.' })
    } catch (err) {
      setStatus({ ok: false, text: `No se pudo guardar: ${(err as Error).message}` })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="form" onSubmit={save}>
      {data.demo && <p className="demo-banner">El modo demo no guarda cambios.</p>}

      <div className="field">
        <label htmlFor="s-name">Nombre</label>
        <input id="s-name" type="text" maxLength={40} value={form.name} placeholder="Opcional, para el saludo" onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>

      <div className="field">
        <label htmlFor="s-alert">
          Alerta de contexto: <strong>{form.alertAt}%</strong>
        </label>
        <input id="s-alert" type="range" min={50} max={99} value={form.alertAt} onChange={(e) => setForm({ ...form, alertAt: Number(e.target.value) })} />
        <small>La mascota se alerta y Windows avisa cuando un chat pasa de este porcentaje.</small>
      </div>

      <div className="field">
        <label htmlFor="s-active">Minutos para considerar activo un chat</label>
        <input id="s-active" type="number" min={1} max={240} value={form.activeMinutes} onChange={(e) => setForm({ ...form, activeMinutes: Number(e.target.value) })} />
      </div>

      <fieldset className="field">
        <legend>Ventana de contexto por modelo</legend>
        <small>Con &quot;Automático&quot; ClaudeHub la estima. Fíjala si sabes cuál usa tu modelo.</small>
        {models.length === 0 && <p className="note">Aún no hay modelos en tus registros.</p>}
        {models.map((m) => {
          const preset = custom[m] ? 'custom' : presetOf(form.limits[m])
          return (
            <div className="row-limit" key={m}>
              <span className="name">{m}</span>
              <select
                aria-label={`Ventana de ${m}`}
                value={preset}
                onChange={(e) => {
                  const v = e.target.value
                  setCustom((c) => ({ ...c, [m]: v === 'custom' }))
                  if (v === '') setLimit(m, undefined)
                  else if (v === 'custom') setLimit(m, form.limits[m] ?? 500_000)
                  else setLimit(m, Number(v))
                }}
              >
                {PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              {preset === 'custom' && (
                <input
                  type="number"
                  min={10000}
                  max={10000000}
                  step={1000}
                  aria-label={`Tokens de la ventana de ${m}`}
                  value={form.limits[m] ?? 500_000}
                  onChange={(e) => setLimit(m, Number(e.target.value))}
                />
              )}
            </div>
          )
        })}
      </fieldset>

      <div className="form-actions">
        <button type="submit" className="primary" disabled={saving || data.demo}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        {status && (
          <span role="status" className={status.ok ? 'ok' : 'bad'}>
            {status.text}
          </span>
        )}
      </div>
      <p className="foot">
        Se guarda en {data.path}. Límite máximo aceptado: {int(10_000_000)} tokens.
      </p>
    </form>
  )
}
