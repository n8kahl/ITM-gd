import {
  inferTradierUnderlyingFromOptionSymbol,
  isTradierSPXOptionSymbol,
} from '../killSwitchHelpers';

describe('tradier/killSwitchHelpers', () => {
  it('detects SPX/SPXW option symbols', () => {
    expect(isTradierSPXOptionSymbol('SPXW260301C05870000')).toBe(true);
    expect(isTradierSPXOptionSymbol('SPX260301P05800000')).toBe(true);
    expect(isTradierSPXOptionSymbol('  spxw260301c05870000  ')).toBe(true);
    expect(isTradierSPXOptionSymbol('AAPL260301C00200000')).toBe(false);
    expect(isTradierSPXOptionSymbol('')).toBe(false);
  });

  it('infers tradier underlying from OCC option symbols', () => {
    expect(inferTradierUnderlyingFromOptionSymbol('SPXW260301C05870000')).toBe('SPXW');
    expect(inferTradierUnderlyingFromOptionSymbol('SPX260301P05800000')).toBe('SPX');
    expect(inferTradierUnderlyingFromOptionSymbol('spxw260301c05870000')).toBe('SPXW');
  });

  it('falls back safely for malformed symbols', () => {
    expect(inferTradierUnderlyingFromOptionSymbol('SPXW-UNKNOWN')).toBe('SPXW');
    expect(inferTradierUnderlyingFromOptionSymbol('UNKNOWN')).toBe('SPX');
  });
});
