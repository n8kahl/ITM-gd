import { __testables } from '../setupDetector';

describe('spx/orb entry zone clamp', () => {
  it('leaves entry zone unchanged when width is at or below cap', () => {
    const zone = __testables.clampEntryZoneWidth({ low: 5000, high: 5006 }, __testables.ORB_ENTRY_ZONE_MAX_WIDTH_POINTS);
    expect(zone).toEqual({ low: 5000, high: 5006 });
  });

  it('caps wide ORB zones to 6 points', () => {
    const zone = __testables.clampEntryZoneWidth({ low: 5000, high: 5010 }, __testables.ORB_ENTRY_ZONE_MAX_WIDTH_POINTS);
    expect(zone.high - zone.low).toBe(6);
  });

  it('keeps clamped zones centered on original midpoint', () => {
    const original = { low: 5001, high: 5011 };
    const clamped = __testables.clampEntryZoneWidth(original, __testables.ORB_ENTRY_ZONE_MAX_WIDTH_POINTS);
    const originalCenter = (original.low + original.high) / 2;
    const clampedCenter = (clamped.low + clamped.high) / 2;
    expect(clampedCenter).toBe(originalCenter);
    expect(clamped).toEqual({ low: 5003, high: 5009 });
  });
});
