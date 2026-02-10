import type { MassiveAggregate } from '../../../../config/massive';
import { calculatePreviousDayLevels } from '../previousDay';

function buildBar(daysOffset: number, high: number, low: number, close: number): MassiveAggregate {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return {
    o: close,
    h: high,
    l: low,
    c: close,
    v: 100_000,
    t: date.getTime(),
  };
}

describe('calculatePreviousDayLevels', () => {
  it('uses prior completed session when today bar is present', () => {
    const dailyData: MassiveAggregate[] = [
      buildBar(-2, 100, 90, 95),
      buildBar(-1, 110, 101, 106),
      buildBar(0, 120, 111, 116), // today (potentially partial)
    ];

    const levels = calculatePreviousDayLevels(dailyData);
    expect(levels.PDH).toBe(110);
    expect(levels.PDL).toBe(101);
    expect(levels.PDC).toBe(106);
  });

  it('uses latest bar when today bar is not present', () => {
    const dailyData: MassiveAggregate[] = [
      buildBar(-3, 100, 90, 95),
      buildBar(-2, 106, 96, 101),
      buildBar(-1, 112, 102, 107),
    ];

    const levels = calculatePreviousDayLevels(dailyData);
    expect(levels.PDH).toBe(112);
    expect(levels.PDL).toBe(102);
    expect(levels.PDC).toBe(107);
  });

  it('calculates weekly high/low from the last five completed sessions', () => {
    const dailyData: MassiveAggregate[] = [
      buildBar(-6, 90, 80, 85),
      buildBar(-5, 120, 92, 100),
      buildBar(-4, 150, 95, 120),
      buildBar(-3, 130, 88, 110),
      buildBar(-2, 140, 90, 115),
      buildBar(-1, 135, 87, 112),
      buildBar(0, 1000, 1, 999), // today (partial) should not be included
    ];

    const levels = calculatePreviousDayLevels(dailyData);
    expect(levels.PWH).toBe(150);
    expect(levels.PWL).toBe(87);
  });
});
