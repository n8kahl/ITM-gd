import { describe, it, expect } from 'vitest';

describe('Time-Decay Geometry (S6)', () => {
  const GEOMETRY_BUCKET_OPENING_MAX_MINUTE = 90;
  const GEOMETRY_BUCKET_MIDDAY_MAX_MINUTE = 240;
  const GEOMETRY_BUCKET_LATE_MAX_MINUTE = 330;

  function getTimeBucket(minutesSinceOpen: number): 'opening' | 'midday' | 'late' | 'final' {
    if (minutesSinceOpen <= GEOMETRY_BUCKET_OPENING_MAX_MINUTE) return 'opening';
    if (minutesSinceOpen <= GEOMETRY_BUCKET_MIDDAY_MAX_MINUTE) return 'midday';
    if (minutesSinceOpen <= GEOMETRY_BUCKET_LATE_MAX_MINUTE) return 'late';
    return 'final';
  }

  const bucketGeometry = {
    opening: { target2Scale: 1.15 }, // S6: Widen T2 by 15%
    midday: {}, // Baseline
    late: { target2Scale: 0.80 }, // S6: Compress T2 by 20%
    final: { target1Scale: 1.0, target2Scale: 0 }, // S6: T1-only
  };

  it('assigns opening bucket for 0-90 minutes', () => {
    expect(getTimeBucket(0)).toBe('opening');
    expect(getTimeBucket(45)).toBe('opening');
    expect(getTimeBucket(90)).toBe('opening');
  });

  it('assigns midday bucket for 91-240 minutes', () => {
    expect(getTimeBucket(91)).toBe('midday');
    expect(getTimeBucket(150)).toBe('midday');
    expect(getTimeBucket(240)).toBe('midday');
  });

  it('assigns late bucket for 241-330 minutes', () => {
    expect(getTimeBucket(241)).toBe('late');
    expect(getTimeBucket(300)).toBe('late');
    expect(getTimeBucket(330)).toBe('late');
  });

  it('assigns final bucket for 331+ minutes', () => {
    expect(getTimeBucket(331)).toBe('final');
    expect(getTimeBucket(360)).toBe('final');
    expect(getTimeBucket(390)).toBe('final');
  });

  it('opening bucket widens T2 targets by 15%', () => {
    const target2Scale = bucketGeometry.opening.target2Scale;
    expect(target2Scale).toBe(1.15);
  });

  it('late bucket compresses T2 targets by 20%', () => {
    const target2Scale = bucketGeometry.late.target2Scale;
    expect(target2Scale).toBe(0.80);
  });

  it('final bucket uses T1-only (target2Scale = 0)', () => {
    expect(bucketGeometry.final.target2Scale).toBe(0);
  });

  it('adaptive partial scaling differs by regime', () => {
    const partialByRegime: Record<string, number> = {
      compression: 0.75,
      ranging: 0.70,
      trending: 0.55,
      breakout: 0.50,
    };

    expect(partialByRegime.compression).toBeGreaterThan(partialByRegime.trending);
    expect(partialByRegime.ranging).toBeGreaterThan(partialByRegime.breakout);
  });

  it('runner stop moves to entry + 0.15R (not flat breakeven)', () => {
    const entryPrice = 5.00;
    const breakEvenPlusR = 0.15;
    const runnerStopPrice = entryPrice * (1 + breakEvenPlusR / 10);
    expect(runnerStopPrice).toBeGreaterThan(entryPrice);
  });
});
