import { describe, expect, it } from 'vitest'
import { fmtUsd } from '../src/web/format'

describe('fmtUsd', () => {
  it.each([
    [0, '$0.00'],
    [0.001, '<$0.01'],
    [0.0099, '<$0.01'],
    [0.01, '$0.01'],
    [1, '$1.00'],
    [3.856, '$3.86'],
    [999.99, '$999.99'],
    [1000, '$1.0k'],
    [1200, '$1.2k'],
    [12500, '$12.5k'],
  ])('formatea %s como %s', (value, expected) => {
    expect(fmtUsd(value)).toBe(expected)
  })
})
