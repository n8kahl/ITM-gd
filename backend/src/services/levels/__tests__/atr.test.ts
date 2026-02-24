import { analyzeVolatility, calculateATR } from '../calculators/atr';
import { MassiveAggregate } from '../../../config/massive';

describe('ATR Calculator', () => {
  // Create sample data with 20 bars for testing
  const createSampleData = (): MassiveAggregate[] => {
    const data: MassiveAggregate[] = [];
    let basePrice = 5900;

    for (let i = 0; i < 20; i++) {
      const high = basePrice + 20;
      const low = basePrice - 20;
      const close = basePrice + (Math.random() * 20 - 10);

      data.push({
        o: basePrice,
        h: high,
        l: low,
        c: close,
        v: 1000000,
        t: Date.now() + i * 86400000
      });

      basePrice = close;
    }

    return data;
  };

  it('calculates ATR with sufficient data', () => {
    const data = createSampleData();
    const atr = calculateATR(data, 14);

    expect(atr).not.toBeNull();
    expect(typeof atr).toBe('number');
    expect(atr).toBeGreaterThan(0);
  });

  it('returns null with insufficient data', () => {
    const data = createSampleData().slice(0, 10); // Only 10 bars
    const atr = calculateATR(data, 14); // Need 15+ bars for ATR(14)

    expect(atr).toBeNull();
  });

  it('calculates ATR(14) correctly with known values', () => {
    // Create data with known true range values
    const data: MassiveAggregate[] = [
      { o: 5900, h: 5920, l: 5880, c: 5900, v: 1000000, t: Date.now() },
      { o: 5900, h: 5930, l: 5890, c: 5910, v: 1000000, t: Date.now() + 86400000 },
      { o: 5910, h: 5940, l: 5900, c: 5920, v: 1000000, t: Date.now() + 172800000 },
      { o: 5920, h: 5950, l: 5910, c: 5930, v: 1000000, t: Date.now() + 259200000 },
      { o: 5930, h: 5960, l: 5920, c: 5940, v: 1000000, t: Date.now() + 345600000 },
      { o: 5940, h: 5970, l: 5930, c: 5950, v: 1000000, t: Date.now() + 432000000 },
      { o: 5950, h: 5980, l: 5940, c: 5960, v: 1000000, t: Date.now() + 518400000 },
      { o: 5960, h: 5990, l: 5950, c: 5970, v: 1000000, t: Date.now() + 604800000 },
      { o: 5970, h: 6000, l: 5960, c: 5980, v: 1000000, t: Date.now() + 691200000 },
      { o: 5980, h: 6010, l: 5970, c: 5990, v: 1000000, t: Date.now() + 777600000 },
      { o: 5990, h: 6020, l: 5980, c: 6000, v: 1000000, t: Date.now() + 864000000 },
      { o: 6000, h: 6030, l: 5990, c: 6010, v: 1000000, t: Date.now() + 950400000 },
      { o: 6010, h: 6040, l: 6000, c: 6020, v: 1000000, t: Date.now() + 1036800000 },
      { o: 6020, h: 6050, l: 6010, c: 6030, v: 1000000, t: Date.now() + 1123200000 },
      { o: 6030, h: 6060, l: 6020, c: 6040, v: 1000000, t: Date.now() + 1209600000 }
    ];

    const atr = calculateATR(data, 14);

    expect(atr).not.toBeNull();
    // With consistent 40-point ranges, ATR should be around 40
    expect(atr).toBeGreaterThan(35);
    expect(atr).toBeLessThan(45);
  });

  it('calculates ATR(7) with shorter period', () => {
    const data = createSampleData();
    const atr = calculateATR(data, 7);

    expect(atr).not.toBeNull();
    expect(typeof atr).toBe('number');
    expect(atr).toBeGreaterThan(0);
  });

  it('handles minimal data correctly', () => {
    // Exactly 15 bars (minimum for ATR(14))
    const data = createSampleData().slice(0, 15);
    const atr = calculateATR(data, 14);

    expect(atr).not.toBeNull();
  });

  it('returns rounded to 2 decimal places', () => {
    const data = createSampleData();
    const atr = calculateATR(data, 14);

    expect(atr).not.toBeNull();
    if (atr !== null) {
      const decimalPlaces = (atr.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    }
  });

  describe('analyzeVolatility', () => {
    it('uses SPX thresholds by default', () => {
      expect(analyzeVolatility(25, 25).level).toBe('low');
      expect(analyzeVolatility(40, 40).level).toBe('moderate');
      expect(analyzeVolatility(60, 60).level).toBe('high');
      expect(analyzeVolatility(75, 75).level).toBe('extreme');
    });

    it('uses NDX thresholds when symbol is NDX', () => {
      expect(analyzeVolatility(35, 35, 'NDX').level).toBe('low');
      expect(analyzeVolatility(50, 50, 'NDX').level).toBe('moderate');
      expect(analyzeVolatility(80, 80, 'NDX').level).toBe('high');
      expect(analyzeVolatility(100, 100, 'NDX').level).toBe('extreme');
    });

    it('uses SPY thresholds when symbol is SPY', () => {
      expect(analyzeVolatility(2.5, 2.5, 'SPY').level).toBe('low');
      expect(analyzeVolatility(4, 4, 'SPY').level).toBe('moderate');
      expect(analyzeVolatility(6, 6, 'SPY').level).toBe('high');
      expect(analyzeVolatility(8, 8, 'SPY').level).toBe('extreme');
    });

    it('uses QQQ thresholds when symbol is QQQ', () => {
      expect(analyzeVolatility(3, 3, 'QQQ').level).toBe('low');
      expect(analyzeVolatility(6, 6, 'QQQ').level).toBe('moderate');
      expect(analyzeVolatility(9, 9, 'QQQ').level).toBe('high');
      expect(analyzeVolatility(11, 11, 'QQQ').level).toBe('extreme');
    });

    it('falls back to SPX thresholds for unknown symbols', () => {
      expect(analyzeVolatility(40, 40, 'RUT').level).toBe('moderate');
      expect(analyzeVolatility(72, 72, 'UNKNOWN').level).toBe('extreme');
    });
  });
});
