import { beforeAll, describe, expect, it } from 'vitest'
import type { ZodTypeAny } from 'zod'

let createSchema: ZodTypeAny

beforeAll(async () => {
  const module = await import('@/lib/validation/journal-entry')
  createSchema = (module as { journalEntryCreateSchema?: ZodTypeAny; journalEntrySchema?: ZodTypeAny }).journalEntryCreateSchema
    ?? (module as { journalEntrySchema: ZodTypeAny }).journalEntrySchema
})

describe('journalEntryCreateSchema', () => {
  it('normalizes symbol casing for valid payloads', () => {
    const parsed = createSchema.parse({
      symbol: 'spy',
      direction: 'long',
      contract_type: 'stock',
      entry_price: 500,
      position_size: 1,
    })

    expect(parsed.symbol).toBe('SPY')
  })

  it('rejects invalid symbols', () => {
    expect(() => createSchema.parse({
      symbol: 'SPY!',
      direction: 'long',
      contract_type: 'stock',
    })).toThrow()
  })

  it('rejects more than 20 tags', () => {
    expect(() => createSchema.parse({
      symbol: 'AAPL',
      direction: 'long',
      contract_type: 'stock',
      tags: Array.from({ length: 21 }, (_, index) => `tag-${index}`),
    })).toThrow()
  })

  it('rejects entry prices above configured bounds', () => {
    expect(() => createSchema.parse({
      symbol: 'MSFT',
      direction: 'long',
      entry_price: 1_000_000,
    })).toThrow()
  })

  it('rejects pnl values below configured bounds', () => {
    expect(() => createSchema.parse({
      symbol: 'QQQ',
      direction: 'long',
      pnl: -1_000_000,
    })).toThrow()
  })

  it('rejects oversized setup note payloads', () => {
    expect(() => createSchema.parse({
      symbol: 'TSLA',
      setup_notes: 'x'.repeat(10_001),
    })).toThrow()
  })
})
