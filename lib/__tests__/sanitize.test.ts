import { describe, expect, it } from 'vitest'
import { sanitizeContent, sanitizeSymbol, sanitizeUUID } from '@/lib/sanitize'

describe('sanitizeContent', () => {
  it('removes script tags and event handlers', () => {
    const input = '<script>alert(1)</script><div onclick="evil()">safe</div>'
    expect(sanitizeContent(input)).toBe('safe')
  })

  it('removes javascript protocol payloads', () => {
    const input = '<a href="javascript:alert(1)">Click</a>'
    expect(sanitizeContent(input)).toBe('Click')
  })
})

describe('sanitizeUUID', () => {
  it('accepts valid uuid values', () => {
    expect(sanitizeUUID('123e4567-e89b-12d3-a456-426614174000')).toBe('123e4567-e89b-12d3-a456-426614174000')
  })

  it('rejects invalid uuid values', () => {
    expect(sanitizeUUID('not-a-uuid')).toBeNull()
  })
})

describe('sanitizeSymbol', () => {
  it('normalizes valid symbols', () => {
    expect(sanitizeSymbol('spy')).toBe('SPY')
  })

  it('rejects symbols with invalid characters', () => {
    expect(sanitizeSymbol('SPY!')).toBeNull()
  })
})
