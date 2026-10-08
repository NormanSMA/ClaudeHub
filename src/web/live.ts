/** Aviso en vivo: un unico EventSource por pestana y throttle de recargas. Nunca lanza excepciones. */

export type LiveStatus = 'live' | 'poll'

/** Parte de EventSource que se usa; permite probar sin navegador. */
export interface SourceLike {
  readyState: number
  addEventListener(type: string, listener: () => void): void
  close(): void
}

export type SourceFactory = () => SourceLike | null

export interface Live {
  subscribeChanges(cb: () => void): () => void
  onStatus(cb: (status: LiveStatus) => void): () => void
}

const CLOSED = 2
const RETRY_MS = 30_000

function safe(fn: () => void): void {
  try {
    fn()
  } catch {
    // un oyente defectuoso no debe afectar a los demas
  }
}

/** Crea el canal compartido. Abre la conexion con el primer oyente y la cierra con el ultimo. */
export function createLive(make: SourceFactory): Live {
  const changes = new Set<() => void>()
  const statuses = new Set<(status: LiveStatus) => void>()
  let status: LiveStatus = 'poll'
  let source: SourceLike | null = null
  let retry: ReturnType<typeof setTimeout> | null = null

  const setStatus = (next: LiveStatus) => {
    if (next === status) return
    status = next
    for (const cb of [...statuses]) safe(() => cb(next))
  }

  const close = () => {
    if (retry) clearTimeout(retry)
    retry = null
    if (source) safe(() => source?.close())
    source = null
    setStatus('poll')
  }

  const open = () => {
    if (source || retry) return
    let s: SourceLike | null = null
    try {
      s = make()
    } catch {
      s = null
    }
    if (!s) {
      setStatus('poll')
      return
    }
    const current = s
    source = current
    current.addEventListener('hello', () => setStatus('live'))
    current.addEventListener('open', () => setStatus('live'))
    current.addEventListener('changed', () => {
      for (const cb of [...changes]) safe(cb)
    })
    current.addEventListener('error', () => {
      setStatus('poll')
      // CLOSED: el servidor rechazo la conexion (por ejemplo 429); se reintenta mas tarde
      if (current.readyState === CLOSED && source === current) {
        safe(() => current.close())
        source = null
        retry = setTimeout(() => {
          retry = null
          if (changes.size + statuses.size > 0) open()
        }, RETRY_MS)
      }
    })
  }

  const release = () => {
    if (changes.size + statuses.size === 0) close()
  }

  return {
    subscribeChanges(cb) {
      changes.add(cb)
      open()
      return () => {
        changes.delete(cb)
        release()
      }
    },
    onStatus(cb) {
      statuses.add(cb)
      open()
      safe(() => cb(status))
      return () => {
        statuses.delete(cb)
        release()
      }
    },
  }
}

const shared = createLive(() => (typeof EventSource === 'undefined' ? null : new EventSource('/api/events')))

/** Llama `cb` cada vez que el servidor avisa de datos nuevos. Devuelve la funcion para cancelar. */
export const subscribeChanges = shared.subscribeChanges
/** Informa el estado de la conexion ('live' o 'poll'). Llama `cb` al registrarse. */
export const onStatus = shared.onStatus

export type Throttled = (() => void) & { cancel(): void }

/** Ejecuta `fn` de inmediato al primer aviso y una vez mas al cerrar la ventana si hubo avisos dentro. */
export function throttle(fn: () => void, ms: number): Throttled {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending = false
  const arm = () => {
    timer = setTimeout(() => {
      timer = null
      if (!pending) return
      pending = false
      safe(fn)
      arm()
    }, ms)
  }
  const call = (() => {
    if (timer) {
      pending = true
      return
    }
    safe(fn)
    arm()
  }) as Throttled
  call.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
    pending = false
  }
  return call
}
