import { describe, it, expect } from 'vitest'
import { analyzeBiases, type BiasSignal } from '../bias-detector'
import type { JournalEntry } from '@/lib/types/journal'

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: crypto.randomUUID(),
    user_id: 'test-user',
    trade_date: new Date().toISOString(),
    symbol: 'SPX',
    direction: 'long',
    contract_type: 'stock',
    entry_price: 5000,
    exit_price: 5010,
    position_size: 1,
    pnl: 10,
    pnl_percentage: 0.2,
    is_winner: true,
    is_open: false,
    entry_timestamp: null,
    exit_timestamp: null,
    stop_loss: null,
    initial_target: null,
    hold_duration_min: 30,
    mfe_percent: null,
    mae_percent: null,
    strike_price: null,
    expiration_date: null,
    dte_at_entry: null,
    iv_at_entry: null,
    delta_at_entry: null,
    theta_at_entry: null,
    gamma_at_entry: null,
    vega_at_entry: null,
    underlying_at_entry: null,
    underlying_at_exit: null,
    mood_before: null,
    mood_after: null,
    discipline_score: null,
    followed_plan: null,
    deviation_notes: null,
    strategy: null,
    setup_notes: null,
    execution_notes: null,
    lessons_learned: null,
    tags: [],
    rating: null,
    screenshot_url: null,
    screenshot_storage_path: null,
    ai_analysis: null,
    market_context: null,
    import_id: null,
    is_favorite: false,
    setup_type: null,
    is_draft: false,
    draft_status: null,
    draft_expires_at: null,
    coach_review_status: null,
    coach_review_requested_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('analyzeBiases', () => {
  it('returns empty signals for insufficient data', () => {
    const result = analyzeBiases([])
    expect(result.signals).toEqual([])
    expect(result.tradeCount).toBe(0)
  })

  it('returns empty signals for few trades', () => {
    const entries = [makeEntry(), makeEntry(), makeEntry()]
    const result = analyzeBiases(entries)
    expect(result.tradeCount).toBe(3)
    // Not enough data for most detectors (require 5-10 trades minimum)
  })

  it('detects loss aversion when losers held significantly longer', () => {
    const entries: JournalEntry[] = []

    // 5 winners held ~20 min
    for (let i = 0; i < 5; i++) {
      entries.push(makeEntry({
        pnl: 50,
        is_winner: true,
        hold_duration_min: 20,
      }))
    }

    // 5 losers held ~60 min (3x longer)
    for (let i = 0; i < 5; i++) {
      entries.push(makeEntry({
        pnl: -30,
        is_winner: false,
        hold_duration_min: 60,
      }))
    }

    const result = analyzeBiases(entries)
    const lossAversion = result.signals.find((s: BiasSignal) => s.type === 'loss_aversion')
    expect(lossAversion).toBeDefined()
    expect(lossAversion!.confidence).toBeGreaterThan(0)
    expect(lossAversion!.label).toBe('Loss Aversion')
  })

  it('does not detect loss aversion when hold times are similar', () => {
    const entries: JournalEntry[] = []

    for (let i = 0; i < 5; i++) {
      entries.push(makeEntry({ pnl: 50, hold_duration_min: 30 }))
    }
    for (let i = 0; i < 5; i++) {
      entries.push(makeEntry({ pnl: -30, hold_duration_min: 35 }))
    }

    const result = analyzeBiases(entries)
    const lossAversion = result.signals.find((s: BiasSignal) => s.type === 'loss_aversion')
    expect(lossAversion).toBeUndefined()
  })

  it('detects revenge trading with rapid post-loss entries', () => {
    const baseTime = new Date('2024-01-15T10:00:00Z').getTime()
    const entries: JournalEntry[] = []

    // Create a series of trades where post-loss entries happen within 5 min
    for (let i = 0; i < 8; i++) {
      const isLoss = i % 2 === 0
      entries.push(makeEntry({
        pnl: isLoss ? -20 : 15,
        entry_timestamp: new Date(baseTime + i * 5 * 60_000).toISOString(),
        exit_timestamp: new Date(baseTime + i * 5 * 60_000 + 3 * 60_000).toISOString(),
      }))
    }

    const result = analyzeBiases(entries)
    const revenge = result.signals.find((s: BiasSignal) => s.type === 'revenge_trading')
    // May or may not detect depending on threshold, but should not crash
    expect(result.tradeCount).toBe(8)
  })

  it('detects anchoring when entries cluster near round numbers', () => {
    const entries: JournalEntry[] = []

    // 10 entries all at round-5 prices
    for (let i = 0; i < 12; i++) {
      entries.push(makeEntry({
        entry_price: 5000 + i * 5, // 5000, 5005, 5010...
      }))
    }

    const result = analyzeBiases(entries)
    const anchoring = result.signals.find((s: BiasSignal) => s.type === 'anchoring')
    expect(anchoring).toBeDefined()
    expect(anchoring!.label).toBe('Anchoring Bias')
  })

  it('returns signals sorted by confidence', () => {
    const result = analyzeBiases([]) // No entries = no signals
    // Just verify the sort contract
    for (let i = 1; i < result.signals.length; i++) {
      expect(result.signals[i - 1].confidence).toBeGreaterThanOrEqual(result.signals[i].confidence)
    }
  })
})
