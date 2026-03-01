import { normalizeEngineDirection, scoreReplayDrill } from '../drillScoring';

describe('spx/drillScoring', () => {
  it('scores aligned direction with disciplined R:R and low pnl delta as high quality', () => {
    const result = scoreReplayDrill({
      learnerDirection: 'long',
      engineDirection: 'bullish',
      strike: 6030,
      stopLevel: 6025,
      targetLevel: 6042,
      learnerPnlPct: 19.5,
      actualPnlPct: 20.2,
    });

    expect(result.directionMatch).toBe(true);
    expect(result.learnerRr).toBeCloseTo(2.4, 4);
    expect(result.components).toEqual({
      directionScore: 50,
      riskDisciplineScore: 30,
      pnlDeltaScore: 20,
    });
    expect(result.score).toBe(100);
  });

  it('penalizes opposite direction and invalid risk geometry', () => {
    const result = scoreReplayDrill({
      learnerDirection: 'short',
      engineDirection: 'bullish',
      strike: 6030,
      stopLevel: 6028,
      targetLevel: 6038,
      learnerPnlPct: -18,
      actualPnlPct: 21,
    });

    expect(result.directionMatch).toBe(false);
    expect(result.learnerRr).toBeNull();
    expect(result.components.directionScore).toBe(0);
    expect(result.components.riskDisciplineScore).toBe(0);
    expect(result.components.pnlDeltaScore).toBe(0);
    expect(result.score).toBe(0);
  });

  it('treats flat call with neutral engine as disciplined and direction-aligned', () => {
    const result = scoreReplayDrill({
      learnerDirection: 'flat',
      engineDirection: 'neutral',
      strike: null,
      stopLevel: null,
      targetLevel: null,
      learnerPnlPct: null,
      actualPnlPct: 4,
    });

    expect(result.directionMatch).toBe(true);
    expect(result.learnerRr).toBeNull();
    expect(result.learnerPnlPct).toBe(0);
    expect(result.components).toEqual({
      directionScore: 50,
      riskDisciplineScore: 30,
      pnlDeltaScore: 18,
    });
    expect(result.score).toBe(98);
  });

  it('falls back to default pnl component when actual outcome is unavailable', () => {
    const result = scoreReplayDrill({
      learnerDirection: 'long',
      engineDirection: 'bullish',
      strike: 6020,
      stopLevel: 6015,
      targetLevel: 6026,
      learnerPnlPct: null,
      actualPnlPct: null,
    });

    expect(result.directionMatch).toBe(true);
    expect(result.learnerRr).toBeCloseTo(1.2, 4);
    expect(result.components).toEqual({
      directionScore: 50,
      riskDisciplineScore: 30,
      pnlDeltaScore: 10,
    });
    expect(result.score).toBe(90);
  });

  it('normalizes engine-direction aliases deterministically', () => {
    expect(normalizeEngineDirection('LONG')).toBe('bullish');
    expect(normalizeEngineDirection('put')).toBe('bearish');
    expect(normalizeEngineDirection('flat')).toBe('neutral');
    expect(normalizeEngineDirection('')).toBeNull();
  });
});
