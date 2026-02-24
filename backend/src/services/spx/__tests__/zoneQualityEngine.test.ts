import {
  minZoneQualityThreshold,
  scoreZoneQuality,
  selectBestZonesForEntry,
} from '../zoneQualityEngine';
import type { ClusterZone } from '../types';

function zone(overrides: Partial<ClusterZone>): ClusterZone {
  return {
    id: overrides.id || `zone_${Math.random().toString(36).slice(2, 7)}`,
    priceLow: overrides.priceLow ?? 6000,
    priceHigh: overrides.priceHigh ?? 6002,
    clusterScore: overrides.clusterScore ?? 4.2,
    type: overrides.type || 'defended',
    sources: overrides.sources || [],
    testCount: overrides.testCount ?? 2,
    lastTestAt: overrides.lastTestAt ?? '2026-02-23T15:00:00.000Z',
    held: overrides.held ?? true,
    holdRate: overrides.holdRate ?? 66,
  };
}

describe('spx/zoneQualityEngine', () => {
  it('scores fortress zones higher than minor zones', () => {
    const fortress = scoreZoneQuality({
      zone: zone({
        id: 'fortress',
        type: 'fortress',
        clusterScore: 5,
        sources: [{ source: 'gex', category: 'options', price: 6001, instrument: 'SPX' }],
        testCount: 5,
        holdRate: 74,
      }),
      currentPrice: 6001,
    });

    const minor = scoreZoneQuality({
      zone: zone({
        id: 'minor',
        type: 'minor',
        clusterScore: 2.1,
        sources: [],
        testCount: 0,
        holdRate: 45,
      }),
      currentPrice: 6001,
    });

    expect(fortress.compositeScore).toBeGreaterThan(minor.compositeScore);
    expect(fortress.fortressScore).toBeGreaterThan(minor.fortressScore);
  });

  it('uses stricter quality threshold in extreme VIX regime', () => {
    expect(minZoneQualityThreshold({ regime: 'ranging', vixRegime: 'normal' })).toBe(45);
    expect(minZoneQualityThreshold({ regime: 'ranging', vixRegime: 'elevated' })).toBe(52);
    expect(minZoneQualityThreshold({ regime: 'ranging', vixRegime: 'extreme' })).toBe(60);
  });

  it('selects highest quality zones and caps count', () => {
    const selected = selectBestZonesForEntry({
      zones: [
        zone({ id: 'z1', clusterScore: 5, type: 'fortress', holdRate: 75 }),
        zone({ id: 'z2', clusterScore: 4.5, type: 'defended', holdRate: 70, priceLow: 6004, priceHigh: 6006 }),
        zone({ id: 'z3', clusterScore: 3.5, type: 'moderate', holdRate: 60, priceLow: 6010, priceHigh: 6012 }),
        zone({ id: 'z4', clusterScore: 2.0, type: 'minor', holdRate: 42, priceLow: 6020, priceHigh: 6021 }),
      ],
      currentPrice: 6002,
      regime: 'ranging',
      vixRegime: 'normal',
      maxZones: 2,
    });

    expect(selected).toHaveLength(2);
    expect(selected[0].quality.compositeScore).toBeGreaterThanOrEqual(selected[1].quality.compositeScore);
  });
});
