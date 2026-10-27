import type { MiddlewareHandler } from 'hono'

// La extension del navegador lee la API desde su propio origen. Solo se permite ese origen.
const EXT_ORIGIN = /^safari-web-extension:\/\/[0-9A-Fa-f-]+$/

export function extensionOrigin(origin: string | undefined): string | null {
  return origin && EXT_ORIGIN.test(origin) ? origin : null
}

/** CORS solo para GET y solo para el origen de la extension. Vary siempre, para no envenenar cachés. */
export const extensionCors: MiddlewareHandler = async (c, next) => {
  await next()
  c.res.headers.append('Vary', 'Origin')
  const origin = extensionOrigin(c.req.header('origin'))
  if (origin && c.req.method === 'GET') c.res.headers.set('Access-Control-Allow-Origin', origin)
}
