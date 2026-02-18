import { describe, expect, it } from 'vitest'
import { parseNumericInput } from '@/lib/journal/number-parsing'

describe('parseNumericInput', () => {
  it('parses parenthesized negatives used in broker exports', () => {
    expect(parseNumericInput('(1,234.56)')).toEqual({ value: -1234.56, valid: true })
    expect(parseNumericInput('($250.00)')).toEqual({ value: -250, valid: true })
  })

  it('parses decimal-comma formats', () => {
    expect(parseNumericInput('12,34')).toEqual({ value: 12.34, valid: true })
  })

  it('parses percentage-style values by stripping percent symbols', () => {
    expect(parseNumericInput('-12.5%')).toEqual({ value: -12.5, valid: true })
  })

  it('rejects invalid numeric text', () => {
    expect(parseNumericInput('abc')).toEqual({ value: null, valid: false })
  })
})
