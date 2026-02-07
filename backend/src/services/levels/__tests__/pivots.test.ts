import { calculateStandardPivots, calculateCamarillaPivots, calculateFibonacciPivots } from '../calculators/pivots';
import { MassiveAggregate } from '../../../config/massive';

describe('Standard Pivots Calculator', () => {
  const sampleData: MassiveAggregate = {
    o: 5890,
    h: 5920,
    l: 5880,
    c: 5900,
    v: 1000000,
    t: Date.now()
  };

  it('calculates pivot point correctly', () => {
    const pivots = calculateStandardPivots(sampleData);

    // PP = (High + Low + Close) / 3
    // PP = (5920 + 5880 + 5900) / 3 = 17700 / 3 = 5900
    expect(pivots.pp).toBe(5900.00);
  });

  it('calculates resistance 1 correctly', () => {
    const pivots = calculateStandardPivots(sampleData);

    // R1 = (2 * PP) - Low
    // R1 = (2 * 5900) - 5880 = 11800 - 5880 = 5920
    expect(pivots.r1).toBe(5920.00);
  });

  it('calculates resistance 2 correctly', () => {
    const pivots = calculateStandardPivots(sampleData);

    // R2 = PP + (High - Low)
    // R2 = 5900 + (5920 - 5880) = 5900 + 40 = 5940
    expect(pivots.r2).toBe(5940.00);
  });

  it('calculates resistance 3 correctly', () => {
    const pivots = calculateStandardPivots(sampleData);

    // R3 = High + 2 * (PP - Low)
    // R3 = 5920 + 2 * (5900 - 5880) = 5920 + 2 * 20 = 5920 + 40 = 5960
    expect(pivots.r3).toBe(5960.00);
  });

  it('calculates support 1 correctly', () => {
    const pivots = calculateStandardPivots(sampleData);

    // S1 = (2 * PP) - High
    // S1 = (2 * 5900) - 5920 = 11800 - 5920 = 5880
    expect(pivots.s1).toBe(5880.00);
  });

  it('calculates support 2 correctly', () => {
    const pivots = calculateStandardPivots(sampleData);

    // S2 = PP - (High - Low)
    // S2 = 5900 - (5920 - 5880) = 5900 - 40 = 5860
    expect(pivots.s2).toBe(5860.00);
  });

  it('calculates support 3 correctly', () => {
    const pivots = calculateStandardPivots(sampleData);

    // S3 = Low - 2 * (High - PP)
    // S3 = 5880 - 2 * (5920 - 5900) = 5880 - 2 * 20 = 5880 - 40 = 5840
    expect(pivots.s3).toBe(5840.00);
  });

  it('returns all 7 levels', () => {
    const pivots = calculateStandardPivots(sampleData);

    expect(pivots).toHaveProperty('pp');
    expect(pivots).toHaveProperty('r1');
    expect(pivots).toHaveProperty('r2');
    expect(pivots).toHaveProperty('r3');
    expect(pivots).toHaveProperty('s1');
    expect(pivots).toHaveProperty('s2');
    expect(pivots).toHaveProperty('s3');
  });

  it('handles different price ranges', () => {
    const wideRangeData: MassiveAggregate = {
      o: 5850,
      h: 6000,
      l: 5800,
      c: 5900,
      v: 1000000,
      t: Date.now()
    };

    const pivots = calculateStandardPivots(wideRangeData);

    // PP = (6000 + 5800 + 5900) / 3 = 17700 / 3 = 5900
    expect(pivots.pp).toBe(5900.00);

    // R2 = PP + (High - Low) = 5900 + 200 = 6100
    expect(pivots.r2).toBe(6100.00);

    // S2 = PP - (High - Low) = 5900 - 200 = 5700
    expect(pivots.s2).toBe(5700.00);
  });
});

describe('Camarilla Pivots Calculator', () => {
  const sampleData: MassiveAggregate = {
    o: 5890,
    h: 5920,
    l: 5880,
    c: 5900,
    v: 1000000,
    t: Date.now()
  };

  it('calculates H4 correctly', () => {
    const pivots = calculateCamarillaPivots(sampleData);

    // H4 = Close + (High - Low) * 1.1 / 2
    // H4 = 5900 + (5920 - 5880) * 1.1 / 2 = 5900 + 40 * 1.1 / 2 = 5900 + 22 = 5922
    expect(pivots.h4).toBe(5922.00);
  });

  it('calculates H3 correctly', () => {
    const pivots = calculateCamarillaPivots(sampleData);

    // H3 = Close + (High - Low) * 1.1 / 4
    // H3 = 5900 + (5920 - 5880) * 1.1 / 4 = 5900 + 40 * 1.1 / 4 = 5900 + 11 = 5911
    expect(pivots.h3).toBe(5911.00);
  });

  it('calculates L3 correctly', () => {
    const pivots = calculateCamarillaPivots(sampleData);

    // L3 = Close - (High - Low) * 1.1 / 4
    // L3 = 5900 - (5920 - 5880) * 1.1 / 4 = 5900 - 11 = 5889
    expect(pivots.l3).toBe(5889.00);
  });

  it('calculates L4 correctly', () => {
    const pivots = calculateCamarillaPivots(sampleData);

    // L4 = Close - (High - Low) * 1.1 / 2
    // L4 = 5900 - (5920 - 5880) * 1.1 / 2 = 5900 - 22 = 5878
    expect(pivots.l4).toBe(5878.00);
  });
});

describe('Fibonacci Pivots Calculator', () => {
  const sampleData: MassiveAggregate = {
    o: 5890,
    h: 5920,
    l: 5880,
    c: 5900,
    v: 1000000,
    t: Date.now()
  };

  it('calculates R1 correctly', () => {
    const pivots = calculateFibonacciPivots(sampleData);

    // PP = (5920 + 5880 + 5900) / 3 = 5900
    // R1 = PP + 0.382 * (High - Low) = 5900 + 0.382 * 40 = 5900 + 15.28 = 5915.28
    expect(pivots.r1).toBeCloseTo(5915.28, 1);
  });

  it('calculates R2 correctly', () => {
    const pivots = calculateFibonacciPivots(sampleData);

    // R2 = PP + 0.618 * (High - Low) = 5900 + 0.618 * 40 = 5900 + 24.72 = 5924.72
    expect(pivots.r2).toBeCloseTo(5924.72, 1);
  });

  it('calculates R3 correctly', () => {
    const pivots = calculateFibonacciPivots(sampleData);

    // R3 = PP + 1.000 * (High - Low) = 5900 + 1.0 * 40 = 5900 + 40 = 5940
    expect(pivots.r3).toBe(5940.00);
  });

  it('calculates S1 correctly', () => {
    const pivots = calculateFibonacciPivots(sampleData);

    // S1 = PP - 0.382 * (High - Low) = 5900 - 0.382 * 40 = 5900 - 15.28 = 5884.72
    expect(pivots.s1).toBeCloseTo(5884.72, 1);
  });

  it('calculates S2 correctly', () => {
    const pivots = calculateFibonacciPivots(sampleData);

    // S2 = PP - 0.618 * (High - Low) = 5900 - 0.618 * 40 = 5900 - 24.72 = 5875.28
    expect(pivots.s2).toBeCloseTo(5875.28, 1);
  });

  it('calculates S3 correctly', () => {
    const pivots = calculateFibonacciPivots(sampleData);

    // S3 = PP - 1.000 * (High - Low) = 5900 - 1.0 * 40 = 5900 - 40 = 5860
    expect(pivots.s3).toBe(5860.00);
  });
});
