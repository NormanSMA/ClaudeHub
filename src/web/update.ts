import { useEffect, useRef, useState } from 'react'
import { useApi, type ManualCheck, type UpdateInfo } from './api'

const DISMISS_KEY = 'update-dismissed'
const SERVER_POLL_MS = 30 * 60_000

export type CheckState = 'idle' | 'checking' | 'up-to-date' | 'update-available' | 'error' | 'disabled' | 'throttled'

/** Estado del boton "Buscar actualizacion" a partir de la ultima respuesta. */
export function checkState(r: ManualCheck | null, loading: boolean, failed: boolean): CheckState {
  if (loading) return 'checking'
  if (failed) return 'error'
  if (!r) return 'idle'
  switch (r.result) {
    case 'checked': return r.info.available ? 'update-available' : 'up-to-date'
    case 'failed': return 'error'
    case 'disabled': return 'disabled'
    case 'throttled': return 'throttled'
  }
}

export function useUpdateCheck(): {
  state: CheckState
  info: UpdateInfo | null
  check: () => Promise<void>
} {
  const { data, error } = useApi<UpdateInfo>('/api/update', SERVER_POLL_MS)
  const [result, setResult] = useState<ManualCheck | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const pending = useRef<AbortController | null>(null)

  useEffect(() => () => pending.current?.abort(), [])

  const check = async () => {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setLoading(true)
    setFailed(false)
    try {
      const res = await fetch('/api/update/check', { method: 'POST', signal: controller.signal })
      const body: ManualCheck = await res.json()
      if (!res.ok && !(res.status === 429 && body.result === 'throttled')) throw new Error(String(res.status))
      if (!controller.signal.aborted) setResult(body)
    } catch {
      if (!controller.signal.aborted) setFailed(true)
    } finally {
      pending.current = null
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  const initial: ManualCheck | null = data?.enabled === false ? { result: 'disabled', info: data } : null
  return {
    state: checkState(result ?? initial, loading, failed || (!result && error !== null)),
    info: result?.info ?? data,
    check,
  }
}

/** "v0.5.0" y "0.5.0" son la misma version. */
export function normVersion(v: string | null | undefined): string {
  return (v ?? '').trim().replace(/^v/i, '')
}

/** El aviso se muestra solo con una version nueva, un enlace https y una version no descartada. */
export function shouldShow(info: UpdateInfo | null | undefined, dismissed: string | null | undefined): boolean {
  if (!info || info.enabled === false || !info.available) return false
  const latest = normVersion(info.latest)
  if (!latest || !info.url || !info.url.startsWith('https://')) return false
  return latest !== normVersion(dismissed)
}

/** "Hay una version nueva (v0.5.0) con cambios nuevos." */
export function balloonText(info: Pick<UpdateInfo, 'latest'>): string {
  return `Hay una versión nueva (v${normVersion(info.latest)}) con cambios nuevos.`
}

export function loadDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY)
  } catch {
    return null
  }
}

/** Devuelve false si no se pudo guardar; el llamador igual oculta el aviso en la sesion. */
export function saveDismissed(version: string): boolean {
  try {
    localStorage.setItem(DISMISS_KEY, version)
    return true
  } catch {
    return false
  }
}

/** Datos del aviso (o null si no hay que mostrarlo) y la accion "Luego". */
export function useUpdateNotice(): { info: UpdateInfo | null; dismiss: () => void } {
  const { data } = useApi<UpdateInfo>('/api/update', SERVER_POLL_MS)
  // el estado en memoria oculta el aviso en la sesion aunque falle localStorage
  const [dismissed, setDismissed] = useState<string | null>(loadDismissed)
  const info = shouldShow(data, dismissed) ? data : null
  const dismiss = () => {
    if (!info?.latest) return
    setDismissed(info.latest)
    saveDismissed(info.latest)
  }
  return { info, dismiss }
}
