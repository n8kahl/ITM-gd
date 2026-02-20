import { describe, expect, it } from 'vitest'
import {
  buildProbabilityConeGeometry,
  buildGammaTopographyEntries,
  buildRiskRewardShadowGeometry,
  buildSetupLockGeometry,
  buildTopographicLadderEntries,
  evolveSpatialGhostLifecycle,
  extractSpatialCoachAnchors,
  parseIsoToUnixSeconds,
  resolveSpatialAnchorX,
  resolveSetupLockState,
} from '@/lib/spx/spatial-hud'
import type { Setup } from '@/lib/types/spx-command-center'

describe('spatial-hud helpers', () => {
  describe('buildProbabilityConeGeometry', () => {
    it('builds deterministic cone geometry from prediction windows', () => {
      const geometry = buildProbabilityConeGeometry({
        width: 1000,
        height: 500,
        currentPrice: 6000,
        windows: [
          { minutesForward: 5, high: 6010, low: 5994, center: 6002 },
          { minutesForward: 15, high: 6022, low: 5988, center: 6004 },
        ],
        directionBias: 0.4,
        visiblePriceRange: { min: 5950, max: 6050 },
        priceToPixel: (price) => ((6050 - price) / 100) * 500,
      })

      expect(geometry).not.toBeNull()
      expect(geometry?.usedFallback).toBe(false)
      expect(geometry?.path.startsWith('M820,')).toBe(true)
      expect(geometry?.centerLine.startsWith('M820,')).toBe(true)
    })

    it('builds fallback cone when prediction windows are missing', () => {
      const geometry = buildProbabilityConeGeometry({
        width: 800,
        height: 400,
        currentPrice: 6000,
        windows: [],
        directionBias: 0.8,
        visiblePriceRange: { min: 5960, max: 6040 },
        priceToPixel: () => null,
      })

      expect(geometry).not.toBeNull()
      expect(geometry?.usedFallback).toBe(true)
      expect(geometry?.path.includes('Z')).toBe(true)
      expect(geometry?.centerLine.length).toBeGreaterThan(0)
    })

    it('returns null when dimensions are invalid', () => {
      const geometry = buildProbabilityConeGeometry({
        width: 0,
        height: 400,
        currentPrice: 6000,
        windows: [{ high: 6010, low: 5990 }],
        priceToPixel: () => 100,
      })

      expect(geometry).toBeNull()
    })
  })

  describe('extractSpatialCoachAnchors', () => {
    it('extracts newest anchorable messages, skipping dismissed entries', () => {
      const messages = [
        { id: '1', content: 'Watch 6025 for hold.', timestamp: '2026-02-20T14:00:00.000Z' },
        { id: '2', content: 'Retest around 6012 then trigger.', timestamp: '2026-02-20T14:02:00.000Z' },
        { id: '3', content: '6500 mention should be ignored.', timestamp: '2026-02-20T14:03:00.000Z' },
        { id: '4', content: 'Tag 6031 for continuation.', timestamp: '2026-02-20T14:05:00.000Z' },
        { id: '5', content: 'Watch 6008 and 5999 zones.', timestamp: '2026-02-20T14:04:00.000Z' },
      ]

      const anchors = extractSpatialCoachAnchors(messages, {
        dismissedIds: new Set(['5']),
        maxNodes: 3,
      })

      expect(anchors).toHaveLength(3)
      expect(anchors.map((entry) => entry.message.id)).toEqual(['4', '2', '1'])
      expect(anchors.map((entry) => entry.anchorPrice)).toEqual([6031, 6012, 6025])
    })
  })

  describe('buildTopographicLadderEntries', () => {
    it('prioritizes closer and stronger levels while respecting cap', () => {
      const entries = buildTopographicLadderEntries([
        { id: 'a', price: 6001, strength: 'critical', type: 'options', color: '#10B981' },
        { id: 'b', price: 6018, strength: 'weak', type: 'fibonacci', color: '#F5EDCC' },
        { id: 'c', price: 5999, strength: 'strong', type: 'structural', color: '#10B981' },
        { id: 'd', price: 6060, strength: 'moderate', type: 'options', color: '#FB7185' },
      ], 6000, 3)

      expect(entries).toHaveLength(3)
      expect(entries.some((entry) => entry.id === 'a')).toBe(true)
      expect(entries.some((entry) => entry.id === 'c')).toBe(true)
      expect(entries[0]!.price).toBeGreaterThanOrEqual(entries[1]!.price)
    })
  })

  describe('buildGammaTopographyEntries', () => {
    it('selects strongest nearby strikes and tags polarity', () => {
      const entries = buildGammaTopographyEntries([
        { strike: 5980, gex: -200 },
        { strike: 6000, gex: 1500 },
        { strike: 6010, gex: -1200 },
        { strike: 6030, gex: 300 },
      ], 6005, { maxEntries: 3, minMagnitudeRatio: 0.1 })

      expect(entries).toHaveLength(3)
      expect(entries.some((entry) => entry.strike === 6000 && entry.polarity === 'positive')).toBe(true)
      expect(entries.some((entry) => entry.strike === 6010 && entry.polarity === 'negative')).toBe(true)
      expect(entries[0]!.strike).toBeGreaterThanOrEqual(entries[1]!.strike)
    })
  })

  describe('buildSetupLockGeometry', () => {
    const baseSetup: Setup = {
      id: 'setup-1',
      type: 'fade_at_wall',
      direction: 'bullish',
      entryZone: { low: 6000, high: 6004 },
      stop: 5994,
      target1: { price: 6012, label: 'T1' },
      target2: { price: 6021, label: 'T2' },
      confluenceScore: 4,
      confluenceSources: ['flow', 'gex'],
      clusterZone: {
        id: 'cluster-1',
        priceLow: 5999,
        priceHigh: 6005,
        clusterScore: 4,
        type: 'defended',
        sources: [{ source: 'spx_call_wall', category: 'options', price: 6002, instrument: 'SPX' }],
        testCount: 2,
        lastTestAt: '2026-02-20T14:00:00.000Z',
        held: true,
        holdRate: 0.7,
      },
      regime: 'ranging',
      status: 'ready',
      probability: 68,
      recommendedContract: null,
      createdAt: '2026-02-20T14:00:00.000Z',
      triggeredAt: null,
    }

    it('returns entry/risk/target bands and clamped confluence rings', () => {
      const geometry = buildSetupLockGeometry(baseSetup)
      expect(geometry).not.toBeNull()
      expect(geometry?.bands.some((band) => band.kind === 'entry')).toBe(true)
      expect(geometry?.bands.some((band) => band.kind === 'risk')).toBe(true)
      expect(geometry?.bands.some((band) => band.kind === 'target1')).toBe(true)
      expect(geometry?.confluenceRings).toBe(4)
    })

    it('handles bearish setups and returns null on empty input', () => {
      const bearish = buildSetupLockGeometry({
        ...baseSetup,
        id: 'setup-2',
        direction: 'bearish',
        stop: 6010,
        target1: { price: 5992, label: 'T1' },
        target2: { price: 5984, label: 'T2' },
      })

      expect(bearish).not.toBeNull()
      expect(bearish?.centerPrice).toBeCloseTo(6002)
      expect(buildSetupLockGeometry(null)).toBeNull()
    })
  })

  describe('resolveSetupLockState', () => {
    it('maps trade mode and setup status to lock states', () => {
      expect(resolveSetupLockState('scan', 'forming')).toBe('idle')
      expect(resolveSetupLockState('scan', 'ready')).toBe('ready')
      expect(resolveSetupLockState('scan', 'triggered')).toBe('triggered')
      expect(resolveSetupLockState('in_trade', 'ready')).toBe('in_trade')
      expect(resolveSetupLockState('in_trade', null)).toBe('in_trade')
    })
  })

  describe('buildRiskRewardShadowGeometry', () => {
    const setup: Setup = {
      id: 'setup-rr-1',
      type: 'fade_at_wall',
      direction: 'bullish',
      entryZone: { low: 6000, high: 6004 },
      stop: 5992,
      target1: { price: 6012, label: 'T1' },
      target2: { price: 6024, label: 'T2' },
      confluenceScore: 5,
      confluenceSources: ['flow'],
      clusterZone: {
        id: 'cluster-rr-1',
        priceLow: 6000,
        priceHigh: 6005,
        clusterScore: 4.5,
        type: 'defended',
        sources: [{ source: 'spx_call_wall', category: 'options', price: 6002, instrument: 'SPX' }],
        testCount: 1,
        lastTestAt: null,
        held: null,
        holdRate: null,
      },
      regime: 'ranging',
      status: 'triggered',
      probability: 70,
      recommendedContract: null,
      createdAt: '2026-02-20T15:00:00.000Z',
      triggeredAt: '2026-02-20T15:05:00.000Z',
    }

    it('computes rr geometry from setup structure', () => {
      const rr = buildRiskRewardShadowGeometry(setup)
      expect(rr).not.toBeNull()
      expect(rr?.riskPoints).toBeGreaterThan(0)
      expect(rr?.rrToT1).toBeCloseTo(1, 2)
      expect(rr?.rrToT2).toBeCloseTo(2.2, 2)
    })

    it('uses contract risk/reward when provided', () => {
      const rr = buildRiskRewardShadowGeometry(setup, {
        description: '6005C',
        strike: 6005,
        expiry: '2026-03-20',
        type: 'call',
        delta: 0.3,
        gamma: 0.02,
        theta: -0.03,
        vega: 0.05,
        bid: 10.2,
        ask: 10.8,
        riskReward: 2.4,
        expectedPnlAtTarget1: 100,
        expectedPnlAtTarget2: 220,
        maxLoss: 1080,
        reasoning: 'test',
      })
      expect(rr).not.toBeNull()
      expect(rr?.rrToT1).toBeCloseTo(2.4, 4)
      expect(rr?.contractMid).toBeCloseTo(10.5, 4)
    })

    it('returns null for invalid setup', () => {
      expect(buildRiskRewardShadowGeometry(null)).toBeNull()
      expect(buildRiskRewardShadowGeometry({ ...setup, stop: (setup.entryZone.low + setup.entryZone.high) / 2 })).toBeNull()
    })
  })

  describe('time-anchor helpers', () => {
    it('parses iso timestamps to unix seconds', () => {
      expect(parseIsoToUnixSeconds('2026-02-20T15:05:12.000Z')).toBe(1771599912)
      expect(parseIsoToUnixSeconds('bad-date')).toBeNull()
      expect(parseIsoToUnixSeconds(null)).toBeNull()
    })

    it('resolves time anchor x and falls back when out of range', () => {
      const timeAnchored = resolveSpatialAnchorX({
        width: 1000,
        fallbackIndex: 0,
        anchorTimeSec: 100,
        timeToPixel: (timestamp) => (timestamp === 100 ? 740 : null),
      })
      expect(timeAnchored.mode).toBe('time')
      expect(timeAnchored.x).toBe(740)

      const fallback = resolveSpatialAnchorX({
        width: 1000,
        fallbackIndex: 1,
        anchorTimeSec: 100,
        timeToPixel: () => null,
      })
      expect(fallback.mode).toBe('fallback')
      expect(fallback.x).toBeGreaterThan(0)
    })
  })

  describe('ghost lifecycle evolution', () => {
    it('advances entering -> active -> fading -> removed', () => {
      const start = 1_000
      let lifecycle = evolveSpatialGhostLifecycle({}, ['m1'], start, {
        enterDurationMs: 100,
        activeDurationMs: 250,
        fadeDurationMs: 100,
      })
      expect(lifecycle.m1?.state).toBe('entering')

      lifecycle = evolveSpatialGhostLifecycle(lifecycle, ['m1'], start + 120, {
        enterDurationMs: 100,
        activeDurationMs: 250,
        fadeDurationMs: 100,
      })
      expect(lifecycle.m1?.state).toBe('active')

      lifecycle = evolveSpatialGhostLifecycle(lifecycle, ['m1'], start + 290, {
        enterDurationMs: 100,
        activeDurationMs: 250,
        fadeDurationMs: 100,
      })
      expect(lifecycle.m1?.state).toBe('fading')

      lifecycle = evolveSpatialGhostLifecycle(lifecycle, [], start + 420, {
        enterDurationMs: 100,
        activeDurationMs: 250,
        fadeDurationMs: 100,
      })
      expect(lifecycle.m1).toBeUndefined()
    })

    it('re-activates fading node when it reappears', () => {
      const start = 10_000
      let lifecycle = evolveSpatialGhostLifecycle({}, ['m1'], start)
      lifecycle = evolveSpatialGhostLifecycle(lifecycle, [], start + 50)
      expect(lifecycle.m1?.state).toBe('fading')

      lifecycle = evolveSpatialGhostLifecycle(lifecycle, ['m1'], start + 80)
      expect(lifecycle.m1?.state).toBe('active')
    })
  })
})
