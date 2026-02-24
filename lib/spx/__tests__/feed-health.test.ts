import { describe, expect, it } from 'vitest'

import { doesSPXFeedReasonBlockTradeEntry, resolveSPXFeedHealth } from '@/lib/spx/feed-health'

describe('feed health', () => {
  it('prioritizes degraded state over stale conditions', () => {
    const result = resolveSPXFeedHealth({
      snapshotIsDegraded: true,
      snapshotRequestLate: false,
      snapshotAvailable: true,
      streamConnected: true,
      spxPriceSource: 'tick',
      spxPriceAgeMs: 200,
      errorMessage: null,
    })

    expect(result.dataHealth).toBe('degraded')
    expect(result.dataHealthMessage).toMatch(/degraded/i)
    expect(result.fallbackPolicy.reasonCode).toBe('snapshot_degraded')
    expect(result.fallbackPolicy.blockTradeEntry).toBe(true)
  })

  it('marks stale when sequence gaps are detected', () => {
    const result = resolveSPXFeedHealth({
      snapshotIsDegraded: false,
      snapshotRequestLate: false,
      snapshotAvailable: true,
      streamConnected: true,
      spxPriceSource: 'tick',
      spxPriceAgeMs: 200,
      sequenceGapDetected: true,
    })

    expect(result.dataHealth).toBe('stale')
    expect(result.flags.sequenceGapDetected).toBe(true)
    expect(result.dataHealthMessage).toMatch(/sequence gap/i)
    expect(result.fallbackPolicy.reasonCode).toBe('sequence_gap_detected')
    expect(result.fallbackPolicy.blockTradeEntry).toBe(true)
  })

  it('stays healthy on fresh tick source with no trust warnings', () => {
    const result = resolveSPXFeedHealth({
      snapshotIsDegraded: false,
      snapshotRequestLate: false,
      snapshotAvailable: false,
      streamConnected: true,
      spxPriceSource: 'tick',
      spxPriceAgeMs: 300,
    })

    expect(result.dataHealth).toBe('healthy')
    expect(result.dataHealthMessage).toBeNull()
    expect(result.fallbackPolicy.reasonCode).toBe('none')
    expect(result.fallbackPolicy.stage).toBe('live_stream')
    expect(result.fallbackPolicy.blockTradeEntry).toBe(false)
  })

  it('marks stale poll fallback with explicit reason code', () => {
    const result = resolveSPXFeedHealth({
      snapshotIsDegraded: false,
      snapshotRequestLate: false,
      snapshotAvailable: true,
      streamConnected: true,
      spxPriceSource: 'poll',
      spxPriceAgeMs: 120_000,
    })

    expect(result.dataHealth).toBe('stale')
    expect(result.fallbackPolicy.stage).toBe('poll_fallback')
    expect(result.fallbackPolicy.reasonCode).toBe('poll_source_stale')
    expect(result.fallbackPolicy.blockTradeEntry).toBe(true)
  })

  it('marks stale when snapshot fallback exceeds max age', () => {
    const result = resolveSPXFeedHealth({
      snapshotIsDegraded: false,
      snapshotRequestLate: false,
      snapshotAvailable: true,
      streamConnected: true,
      spxPriceSource: 'snapshot',
      spxPriceAgeMs: 305_000,
    })

    expect(result.dataHealth).toBe('stale')
    expect(result.flags.snapshotSourceStale).toBe(true)
    expect(result.fallbackPolicy.reasonCode).toBe('snapshot_source_stale')
    expect(result.fallbackPolicy.blockTradeEntry).toBe(true)
  })

  it('only blocks trade-entry for high-risk trust reasons', () => {
    expect(doesSPXFeedReasonBlockTradeEntry('poll_fallback_active')).toBe(false)
    expect(doesSPXFeedReasonBlockTradeEntry('stream_disconnected_snapshot')).toBe(false)
    expect(doesSPXFeedReasonBlockTradeEntry('snapshot_source_stale')).toBe(true)
    expect(doesSPXFeedReasonBlockTradeEntry('sequence_gap_detected')).toBe(true)
  })
})
