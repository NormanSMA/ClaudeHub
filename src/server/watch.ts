import { existsSync, watch, type FSWatcher } from 'node:fs'
import { join } from 'node:path'

const EXTENSIONS = ['.jsonl', '.json', '.sqlite']

export interface WatcherOptions {
  debounceMs?: number
  retryMs?: number
  onError?: (e: unknown) => void
}

export interface Watcher {
  close(): void
  watching(): string[]
}

/**
 * Vigila carpetas y avisa una sola vez por rafaga de cambios.
 * Solo cuentan archivos .jsonl, .json y .sqlite. Las carpetas que no existen se reintentan.
 */
export function createWatcher(dirs: string[], onChange: (file: string) => void, opts: WatcherOptions = {}): Watcher {
  const debounceMs = opts.debounceMs ?? 500
  const retryMs = opts.retryMs ?? 60_000
  const active = new Map<string, FSWatcher>()
  let debounce: NodeJS.Timeout | null = null
  let retry: NodeJS.Timeout | null = null
  let closed = false
  let lastFile = ''

  const report = (e: unknown): void => {
    try {
      opts.onError?.(e)
    } catch {
      // Un onError defectuoso no debe tumbar el proceso.
    }
  }

  const schedule = (file: string): void => {
    lastFile = file
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(() => {
      debounce = null
      if (!closed) onChange(lastFile)
    }, debounceMs)
    debounce.unref()
  }

  const drop = (dir: string): void => {
    const w = active.get(dir)
    active.delete(dir)
    try {
      w?.close()
    } catch {
      // El watcher ya estaba cerrado.
    }
  }

  const start = (dir: string): void => {
    if (active.has(dir) || !existsSync(dir)) return
    try {
      const w = watch(dir, { recursive: true }, (_event, name) => {
        if (closed || name == null) return
        const file = String(name)
        if (EXTENSIONS.some((ext) => file.endsWith(ext))) schedule(join(dir, file))
      })
      w.on('error', (e) => {
        report(e)
        drop(dir)
        ensureRetry()
      })
      active.set(dir, w)
    } catch (e) {
      report(e)
    }
  }

  const pending = (): string[] => dirs.filter((d) => !active.has(d))

  const ensureRetry = (): void => {
    if (closed || retry || pending().length === 0) return
    retry = setInterval(() => {
      for (const dir of pending()) start(dir)
      if (pending().length === 0 && retry) {
        clearInterval(retry)
        retry = null
      }
    }, retryMs)
    retry.unref()
  }

  for (const dir of dirs) start(dir)
  ensureRetry()

  return {
    close() {
      closed = true
      if (debounce) clearTimeout(debounce)
      if (retry) clearInterval(retry)
      debounce = null
      retry = null
      for (const dir of [...active.keys()]) drop(dir)
    },
    watching: () => [...active.keys()],
  }
}

export interface EventHubOptions {
  max?: number
  heartbeatMs?: number
}

export interface EventHub {
  subscribe(send: (chunk: string) => void): (() => void) | null
  broadcast(event: string): void
  size(): number
  close(): void
}

/** Reparte avisos SSE sin datos de uso. Tope de clientes y latido periodico. */
export function createEventHub(opts: EventHubOptions = {}): EventHub {
  const max = opts.max ?? 8
  const heartbeatMs = opts.heartbeatMs ?? 25_000
  const clients = new Set<(chunk: string) => void>()
  let timer: NodeJS.Timeout | null = null

  const sendAll = (chunk: string): void => {
    for (const send of [...clients]) {
      try {
        send(chunk)
      } catch {
        clients.delete(send)
      }
    }
    if (clients.size === 0) stopTimer()
  }

  const stopTimer = (): void => {
    if (timer) clearInterval(timer)
    timer = null
  }

  const startTimer = (): void => {
    if (timer) return
    timer = setInterval(() => sendAll(': ping\n\n'), heartbeatMs)
    timer.unref()
  }

  return {
    subscribe(send) {
      if (clients.size >= max) return null
      // Se envuelve para que dos suscripciones con la misma funcion sean distintas.
      const client = (chunk: string): void => send(chunk)
      clients.add(client)
      startTimer()
      return () => {
        clients.delete(client)
        if (clients.size === 0) stopTimer()
      }
    },
    broadcast(event) {
      sendAll(`event: ${event}\ndata: {}\n\n`)
    },
    size: () => clients.size,
    close() {
      clients.clear()
      stopTimer()
    },
  }
}
