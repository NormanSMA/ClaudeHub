import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { extensionCors, extensionOrigin } from '../src/server/cors'

describe('origen de la extension de Safari', () => {
  it('acepta el origen de una extension de Safari', () => {
    expect(extensionOrigin('safari-web-extension://3F2A9C1E-0B7D-4C55-9A1E-8D2F6B7C4A10')).toBe(
      'safari-web-extension://3F2A9C1E-0B7D-4C55-9A1E-8D2F6B7C4A10',
    )
  })

  it('rechaza webs, otras extensiones y valores vacios', () => {
    for (const o of ['https://evil.com', 'http://127.0.0.1:4317', 'chrome-extension://abc', 'safari-web-extension://x.evil.com', 'safari-web-extension://abc/ruta', '', undefined]) {
      expect(extensionOrigin(o)).toBeNull()
    }
  })
})

describe('middleware de CORS de la extension', () => {
  const ORIGIN = 'safari-web-extension://3F2A9C1E-0B7D-4C55-9A1E-8D2F6B7C4A10'
  const app = new Hono()
  app.use('/api/active', extensionCors)
  app.get('/api/active', (c) => c.json({ ok: true }))
  app.put('/api/active', (c) => c.json({ ok: true }))
  app.get('/api/sessions', (c) => c.json({ ok: true }))

  it('GET de la extension recibe la cabecera y Vary', async () => {
    const r = await app.request('/api/active', { headers: { origin: ORIGIN } })
    expect(r.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(r.headers.get('vary')).toContain('Origin')
  })

  it('un PUT no recibe la cabecera', async () => {
    const r = await app.request('/api/active', { method: 'PUT', headers: { origin: ORIGIN } })
    expect(r.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('un origen web no recibe la cabecera, pero Vary sigue', async () => {
    const r = await app.request('/api/active', { headers: { origin: 'https://evil.com' } })
    expect(r.headers.get('access-control-allow-origin')).toBeNull()
    expect(r.headers.get('vary')).toContain('Origin')
  })

  it('otros endpoints no reciben la cabecera', async () => {
    const r = await app.request('/api/sessions', { headers: { origin: ORIGIN } })
    expect(r.headers.get('access-control-allow-origin')).toBeNull()
  })
})
