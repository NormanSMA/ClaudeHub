import { useState } from 'react'
import { useApi, type UpdateInfo } from './api'

const DISMISS_KEY = 'update-dismissed'
const SERVER_POLL_MS = 30 * 60_000

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
