import { describe, it, expect } from 'vitest'
import { buildDraftPayload, type AutoDraftInput } from '../auto-draft'

describe('buildDraftPayload', () => {
  it('builds a valid draft payload with required fields', () => {
    const input: AutoDraftInput = {
      symbol: 'spx',
      direction: 'long',
      contractType: 'call',
    }

    const payload = buildDraftPayload(input)

    expect(payload.symbol).toBe('SPX')
    expect(payload.direction).toBe('long')
    expect(payload.contract_type).toBe('call')
    expect(payload.is_draft).toBe(true)
    expect(payload.draft_status).toBe('pending')
    expect(payload.draft_expires_at).toBeDefined()
    expect(payload.is_open).toBe(true) // no exit price
  })

  it('marks as closed when exit price is provided', () => {
    const input: AutoDraftInput = {
      symbol: 'SPX',
      direction: 'short',
      contractType: 'put',
      entryPrice: 5100,
      exitPrice: 5080,
      pnl: 200,
    }

    const payload = buildDraftPayload(input)

    expect(payload.is_open).toBe(false)
    expect(payload.entry_price).toBe(5100)
    expect(payload.exit_price).toBe(5080)
    expect(payload.pnl).toBe(200)
  })

  it('adds auto-source tag', () => {
    const payload = buildDraftPayload({
      symbol: 'SPX',
      direction: 'long',
      contractType: 'stock',
      source: 'spx_cc',
    })

    expect(payload.tags).toEqual(['auto:spx_cc'])
  })

  it('adds default auto-detected tag when no source', () => {
    const payload = buildDraftPayload({
      symbol: 'SPX',
      direction: 'long',
      contractType: 'stock',
    })

    expect(payload.tags).toEqual(['auto:detected'])
  })

  it('includes setup_type and market_context when provided', () => {
    const payload = buildDraftPayload({
      symbol: 'SPX',
      direction: 'long',
      contractType: 'stock',
      setupType: 'Bull Bounce',
      marketContext: { vix_bucket: '<15', trend_state: 'trending_up' },
    })

    expect(payload.setup_type).toBe('Bull Bounce')
    expect(payload.market_context).toEqual({ vix_bucket: '<15', trend_state: 'trending_up' })
  })

  it('sets draft expiry to 7 days from now', () => {
    const before = Date.now()
    const payload = buildDraftPayload({
      symbol: 'SPX',
      direction: 'long',
      contractType: 'stock',
    })
    const after = Date.now()

    const expiresAt = new Date(payload.draft_expires_at as string).getTime()
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000

    expect(expiresAt).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000)
    expect(expiresAt).toBeLessThanOrEqual(after + sevenDaysMs + 1000)
  })
})
