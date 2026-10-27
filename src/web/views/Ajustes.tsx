import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useApi, type Billing, type OverlayMode, type PriceOverride, type SettingsInfo } from '../api'
import { int } from '../format'
import { animationsOn, setAnimations } from '../components/AnimatedNumber'
import { normVersion, useUpdateCheck } from '../update'

function AnimationsToggle() {
  const [on, setOn] = useState(animationsOn)
  return (
    <div className="field">
      <label htmlFor="s-anim">
        <input id="s-anim" type="checkbox" checked={on} onChange={(e) => { setAnimations(e.target.checked); setOn(e.target.checked) }} /> Animaciones
      </label>
      <small>Se guarda en este navegador y se aplica al instante. El movimiento reducido del sistema las apaga siempre.</small>
    </div>
  )
}

const PRESETS = [
  { value: '', label: 'Automático (estimado)' },
  { value: '200000', label: '200 000' },
  { value: '1000000', label: '1 000 000' },
  { value: 'custom', label: 'Otro valor' },
]

const PRICE_FIELDS = [
  { id: 'input', label: 'Entrada' },
  { id: 'output', label: 'Salida' },
  { id: 'cacheWrite', label: 'Escritura de caché (5 min)' },
  { id: 'cacheWrite1h', label: 'Escritura de caché (1 h)' },
  { id: 'cacheRead', label: 'Lectura de caché' },
] as const

interface PriceRow {
  id: number
  model: string
  values: Partial<Record<keyof PriceOverride, string>>
}

interface Form {
  name: string
  alertAt: number
  activeMinutes: number
  limits: Record<string, number>
  checkUpdates: boolean
  sources: SettingsInfo['config']['sources']
  mascot: SettingsInfo['config']['mascot']
  billing: Billing
  overlayMode: OverlayMode
  freeProviders: string
  prices: PriceRow[]
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
  const nextPriceId = useRef(0)

  useEffect(() => {
    if (!data || form) return
    const c = data.config as typeof data.config & { checkUpdates?: boolean }
    setForm({
      name: c.name,
      alertAt: Math.round(c.alertAt * 100),
      activeMinutes: c.activeMinutes,
      limits: { ...c.contextLimits },
      checkUpdates: c.checkUpdates !== false,
      sources: { ...c.sources },
      mascot: { talk: c.mascot?.talk ?? true, talkCooldownMin: c.mascot?.talkCooldownMin ?? 10 },
      billing: c.billing ?? 'subscription',
      overlayMode: c.overlayMode ?? 'corner',
      freeProviders: (c.pricing?.freeProviders ?? []).join(', '),
      prices: Object.entries(c.pricing?.overrides ?? {}).map(([model, price]) => ({
        id: nextPriceId.current++,
        model,
        values: Object.fromEntries(Object.entries(price).map(([field, value]) => [field, String(value)])),
      })),
    })
    setCustom(Object.fromEntries(Object.entries(c.contextLimits).map(([m, v]) => [m, presetOf(v) === 'custom'])))
  }, [data, form])

  if (!data || !form) return <div className="empty">{error ? `No se pudo cargar (${error}).` : 'Cargando ajustes...'}</div>

  const models = [...new Set([...data.models, ...Object.keys(form.limits)])]
  const priceModels = [...new Set([...data.models, ...form.prices.map((row) => row.model)])].filter((m) => m.length <= 80)
  const nextModel = priceModels.find((model) => !form.prices.some((row) => row.model === model))

  const setPrice = (id: number, update: Partial<PriceRow>) => {
    setForm({ ...form, prices: form.prices.map((row) => row.id === id ? { ...row, ...update } : row) })
  }

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
          checkUpdates: form.checkUpdates,
          sources: form.sources,
          mascot: form.mascot,
          billing: form.billing,
          overlayMode: form.overlayMode,
          pricing: {
            freeProviders: [...new Set(form.freeProviders.split(',').map((p) => p.trim()).filter(Boolean))],
            overrides: Object.fromEntries(form.prices.map((row) => [
              row.model,
              Object.fromEntries(PRICE_FIELDS
                .filter(({ id }) => row.values[id] !== undefined && row.values[id] !== '')
                .map(({ id }) => [id, Number(row.values[id])])),
            ])),
          },
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

      <div className="field">
        <label htmlFor="s-updates">
          <input id="s-updates" type="checkbox" checked={form.checkUpdates} onChange={(e) => setForm({ ...form, checkUpdates: e.target.checked })} /> Buscar versiones nuevas
        </label>
        <small>Consulta la última versión publicada en GitHub al iniciar y cada 6 horas. Apagado, no hay llamadas a la red.</small>
      </div>

      <AnimationsToggle />

      <SourceSettings sources={form.sources} onChange={(sources) => setForm({ ...form, sources })} />

      <fieldset className="field">
        <legend>Mascota</legend>
        <label htmlFor="s-talk">
          <input id="s-talk" type="checkbox" checked={form.mascot.talk} onChange={(e) => setForm({ ...form, mascot: { ...form.mascot, talk: e.target.checked } })} /> Chispa habla
        </label>
        <label htmlFor="s-talk-cooldown">Minutos entre frases</label>
        <input id="s-talk-cooldown" type="number" min={1} max={240} step={1} disabled={!form.mascot.talk} value={form.mascot.talkCooldownMin} onChange={(e) => setForm({ ...form, mascot: { ...form.mascot, talkCooldownMin: Number(e.target.value) } })} />
        <label htmlFor="s-overlay-mode">Posición de la mascota</label>
        <select id="s-overlay-mode" value={form.overlayMode} onChange={(e) => setForm({ ...form, overlayMode: e.target.value as OverlayMode })}>
          <option value="corner">Esquina</option>
          <option value="island">Isla superior</option>
        </select>
      </fieldset>

      <fieldset className="field pricing-settings">
        <legend>Precios</legend>
        <label htmlFor="s-billing">Modalidad de facturación</label>
        <select id="s-billing" value={form.billing} onChange={(e) => setForm({ ...form, billing: e.target.value as Billing })}>
          <option value="subscription">Suscripción Pro o Max</option>
          <option value="api">API por token</option>
        </select>
        <small>Con suscripción, el valor API indica el costo equivalente por token.</small>
        <label htmlFor="s-free-providers">Proveedores gratuitos de OmniRoute</label>
        <input id="s-free-providers" type="text" value={form.freeProviders} aria-describedby="s-free-help" onChange={(e) => setForm({ ...form, freeProviders: e.target.value })} />
        <small id="s-free-help">Separa los nombres de proveedores con comas.</small>
        <p className="pricing-label">Tarifas propias por modelo</p>
        <small id="s-price-help">USD por millón de tokens. Deja campos vacíos para conservar las tarifas predeterminadas.</small>
        {form.prices.map((row) => (
          <fieldset className="price-row" key={row.id} aria-describedby="s-price-help">
            <legend>Tarifa de {row.model}</legend>
            <label htmlFor={`s-price-model-${row.id}`}>Modelo</label>
            <select id={`s-price-model-${row.id}`} value={row.model} onChange={(e) => setPrice(row.id, { model: e.target.value })}>
              {priceModels.map((model) => (
                <option key={model} value={model} disabled={form.prices.some((r) => r.id !== row.id && r.model === model)}>{model}</option>
              ))}
            </select>
            <div className="price-fields">
              {PRICE_FIELDS.map(({ id, label }) => (
                <div key={id}>
                  <label htmlFor={`s-price-${row.id}-${id}`}>{label}</label>
                  <input
                    id={`s-price-${row.id}-${id}`} type="number" min={0} max={1000} step="any" inputMode="decimal"
                    value={row.values[id] ?? ''}
                    onChange={(e) => setPrice(row.id, { values: { ...row.values, [id]: e.target.value } })}
                  />
                </div>
              ))}
            </div>
            <button type="button" className="link" aria-label={`Quitar tarifa de ${row.model}`} onClick={() => setForm({ ...form, prices: form.prices.filter((r) => r.id !== row.id) })}>Quitar tarifa</button>
          </fieldset>
        ))}
        <button type="button" className="link add-price" disabled={!nextModel || form.prices.length >= 50} onClick={() => {
          if (nextModel) setForm({ ...form, prices: [...form.prices, { id: nextPriceId.current++, model: nextModel, values: {} }] })
        }}>Agregar tarifa</button>
        {priceModels.length === 0 && <small>Aún no hay modelos en tus registros.</small>}
      </fieldset>

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
      <AboutSettings />
    </form>
  )
}

function AboutSettings() {
  const { state, info, check } = useUpdateCheck()
  const messages = {
    idle: 'Busca actualizaciones para comprobar si hay una versión nueva.',
    checking: 'Buscando actualizaciones...',
    'up-to-date': 'ClaudeHub está actualizado.',
    'update-available': `Hay una versión nueva: v${normVersion(info?.latest)}.`,
    error: 'No se pudo comprobar la actualización. Inténtalo de nuevo.',
    disabled: 'Activa "Buscar versiones nuevas" y guarda los cambios para buscar actualizaciones.',
    throttled: 'Espera un minuto antes de buscar actualizaciones de nuevo.',
  }

  return (
    <section className="about-card" aria-labelledby="about-title">
      <h3 id="about-title">Acerca de</h3>
      <p className="about-version">ClaudeHub{info ? ` v${normVersion(info.current)}` : ' · Cargando versión...'}</p>
      <p className="about-checked">
        Última comprobación: {info?.checkedAt != null ? new Date(info.checkedAt).toLocaleString('es') : 'nunca'}
      </p>
      <button type="button" className="update-check" disabled={state === 'checking'} onClick={check} aria-busy={state === 'checking'}>
        {state === 'checking' && <span className="update-spinner" aria-hidden="true" />}
        Buscar actualización
      </button>
      <p className="about-status" role="status">{messages[state]}</p>
      {state === 'update-available' && info && (
        <div className="about-release">
          {info.notes.length > 0 && (
            <ul>
              {info.notes.slice(0, 3).map((note, index) => <li key={index}>{note}</li>)}
            </ul>
          )}
          {info.url?.startsWith('https://') && (
            <a className="update-check" href={info.url} target="_blank" rel="noopener noreferrer">Descargar</a>
          )}
        </div>
      )}
    </section>
  )
}

const SOURCE_LABELS = { codex: 'Codex', gemini: 'Gemini', omniroute: 'OmniRoute' } as const

function SourceSettings({ sources, onChange }: {
  sources: Form['sources']
  onChange: (sources: Form['sources']) => void
}) {
  return (
    <fieldset className="field">
      <legend>Fuentes</legend>
      {(Object.keys(SOURCE_LABELS) as (keyof typeof SOURCE_LABELS)[]).map((id) => (
        <label key={id} htmlFor={`s-${id}`}>
          <input
            id={`s-${id}`} type="checkbox" checked={sources[id]}
            aria-describedby={id === 'omniroute' ? 's-omniroute-help' : undefined}
            onChange={(e) => onChange({ ...sources, [id]: e.target.checked })}
          /> {SOURCE_LABELS[id]}
        </label>
      ))}
      <small id="s-omniroute-help">OmniRoute necesita Docker y el contenedor omniroute.</small>
    </fieldset>
  )
}
