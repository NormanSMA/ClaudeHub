import { describe, expect, it } from 'vitest'
import { clickAction, isPetting } from '../src/web/overlay'

describe('caricias de la mascota', () => {
  it('exige tres pasadas dentro de 1,5 segundos', () => {
    expect(isPetting([], 2_000)).toBe(false)
    expect(isPetting([1_000, 1_500], 2_000)).toBe(false)
    expect(isPetting([500, 1_000, 2_000], 2_000)).toBe(true)
    expect(isPetting([499, 1_000, 2_000], 2_000)).toBe(false)
  })

  it('ignora pasadas antiguas y futuras sin modificar la entrada', () => {
    const times = [0, 2_001, 1_800, 900, 1_100]
    expect(isPetting(times, 2_000)).toBe(true)
    expect(times).toEqual([0, 2_001, 1_800, 900, 1_100])
    expect(isPetting([1_000, 1_500, 2_001], 2_000)).toBe(false)
  })
})

describe('clics de la mascota', () => {
  it('alterna el panel con un clic y abre el dashboard con dos', () => {
    expect(clickAction(0, false)).toBe('none')
    expect(clickAction(1, false)).toBe('toggle')
    expect(clickAction(2, false)).toBe('dashboard')
  })

  it('ignora los clics posteriores a un arrastre', () => {
    expect(clickAction(1, true)).toBe('none')
    expect(clickAction(2, true)).toBe('none')
  })
})
