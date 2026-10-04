import { describe, expect, it } from 'vitest'
import { extensionOrigin } from '../src/server/cors'

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
