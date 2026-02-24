import { __testables } from '../setupDetector';

describe('spx/confluence decay', () => {
  it('defines half-life values for each confluence component', () => {
    expect(__testables.CONFLUENCE_HALF_LIVES_MS).toMatchObject({
      flow: 2 * 60_000,
      gex: 15 * 60_000,
      regime: 10 * 60_000,
      ema: 5 * 60_000,
      zone: 30 * 60_000,
      memory: 60 * 60_000,
    });
  });

  it('decays flow component to ~25% after 4 minutes (2-minute half-life)', () => {
    const nowMs = Date.parse('2026-02-24T15:00:00.000Z');
    const score = __testables.computeDecayedConfluence({
      components: { flow: 1 },
      componentTimestampsMs: { flow: nowMs - (4 * 60_000) },
      nowMs,
    });

    expect(score).toBeCloseTo(0.25, 2);
  });

  it('decays zone component to ~50% after 30 minutes (30-minute half-life)', () => {
    const nowMs = Date.parse('2026-02-24T15:00:00.000Z');
    const score = __testables.computeDecayedConfluence({
      components: { zone: 1 },
      componentTimestampsMs: { zone: nowMs - (30 * 60_000) },
      nowMs,
    });

    expect(score).toBeCloseTo(0.5, 2);
  });

  it('caps decayed confluence score at 5', () => {
    const nowMs = Date.parse('2026-02-24T15:00:00.000Z');
    const score = __testables.computeDecayedConfluence({
      components: {
        flow: 3,
        gex: 3,
        regime: 3,
        ema: 3,
        zone: 3,
        memory: 3,
      },
      componentTimestampsMs: {
        flow: nowMs,
        gex: nowMs,
        regime: nowMs,
        ema: nowMs,
        zone: nowMs,
        memory: nowMs,
      },
      nowMs,
    });

    expect(score).toBe(5);
  });
});
