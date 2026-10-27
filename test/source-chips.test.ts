import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { SourceInfo, SourcesReport } from '../src/web/api'
import { SourceChips, sourceChipText } from '../src/web/components/SourceChips'

const active: SourceInfo = { enabled: true, ok: true, files: 1, records: 12 }

describe('sourceChipText', () => {
  it('muestra el número de registros de OmniRoute activa', () => {
    expect(sourceChipText('omniroute', active)).toEqual({ text: '12', title: undefined })
  })

  it('muestra apagada y la ayuda de Ajustes aunque exista un motivo anterior', () => {
    const disabled = { ...active, enabled: false, records: 0, reason: 'desactivada' }
    expect(sourceChipText('omniroute', disabled)).toEqual({ text: 'apagada', title: 'Actívala en Ajustes' })
  })

  it('conserva el número y muestra el error de lectura', () => {
    expect(sourceChipText('omniroute', { ...active, ok: false, reason: 'Sin Docker' }))
      .toEqual({ text: '12', title: 'Sin Docker' })
    expect(sourceChipText('omniroute', { ...active, ok: false }))
      .toEqual({ text: '12', title: 'La fuente no se pudo leer' })
  })

  it('conserva el texto y la ayuda de las otras fuentes', () => {
    for (const id of ['claude', 'codex', 'gemini'] as const) {
      expect(sourceChipText(id, { ...active, enabled: false }))
        .toEqual({ text: '12', title: 'Fuente desactivada' })
    }
    expect(sourceChipText('all', undefined)).toEqual({ text: undefined, title: undefined })
  })
})

describe('SourceChips', () => {
  it('usa un logo de 12 px para OmniRoute y mantiene los puntos de las otras fuentes', () => {
    const report: SourcesReport = {
      claude: active, codex: active, gemini: active,
      omniroute: { ...active, enabled: false, records: 0 },
    }
    const html = renderToStaticMarkup(createElement(SourceChips, { source: 'all', onChange: () => {}, report }))
    expect(html).toContain('width="12" height="12"')
    expect(html).toContain('title="Actívala en Ajustes"')
    expect(html).toContain('>apagada</span>')
    expect(html.match(/class="dot"/g)).toHaveLength(4)
    expect(html.match(/<svg/g)).toHaveLength(1)
  })
})
