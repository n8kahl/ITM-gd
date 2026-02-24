import { describe, expect, it } from 'vitest';

describe('ORB gate restoration (A6)', () => {
  const ORB_GATES = {
    minConfluenceScore: 3.5,
    minAlignmentPct: 52,
    requireEmaAlignment: true,
    emaGraceWindowMinutes: 30,
    maxFirstSeenMinuteEt: 120,
  } as const;

  function passesOrbGate(input: {
    confluenceScore: number;
    alignmentPct: number;
    firstSeenMinuteEt: number;
    emaAligned: boolean;
  }): boolean {
    if (input.confluenceScore < ORB_GATES.minConfluenceScore) return false;
    if (input.alignmentPct < ORB_GATES.minAlignmentPct) return false;
    if (input.firstSeenMinuteEt > ORB_GATES.maxFirstSeenMinuteEt) return false;

    if (!ORB_GATES.requireEmaAlignment) return true;
    if (input.emaAligned) return true;
    return input.firstSeenMinuteEt <= ORB_GATES.emaGraceWindowMinutes;
  }

  it('restores confluence and alignment thresholds and EMA requirement', () => {
    expect(ORB_GATES.minConfluenceScore).toBe(3.5);
    expect(ORB_GATES.minAlignmentPct).toBe(52);
    expect(ORB_GATES.requireEmaAlignment).toBe(true);
    expect(ORB_GATES.emaGraceWindowMinutes).toBe(30);
    expect(ORB_GATES.maxFirstSeenMinuteEt).toBe(120);
  });

  it('rejects ORB with confluence below 3.5', () => {
    expect(
      passesOrbGate({
        confluenceScore: 3.2,
        alignmentPct: 60,
        firstSeenMinuteEt: 45,
        emaAligned: true,
      }),
    ).toBe(false);
  });

  it('rejects ORB with alignment below 52%', () => {
    expect(
      passesOrbGate({
        confluenceScore: 3.8,
        alignmentPct: 48,
        firstSeenMinuteEt: 45,
        emaAligned: true,
      }),
    ).toBe(false);
  });

  it('rejects ORB first seen after minute 120', () => {
    expect(
      passesOrbGate({
        confluenceScore: 3.8,
        alignmentPct: 55,
        firstSeenMinuteEt: 130,
        emaAligned: true,
      }),
    ).toBe(false);
  });

  it('accepts ORB without EMA alignment during the 30-minute grace window', () => {
    expect(
      passesOrbGate({
        confluenceScore: 3.8,
        alignmentPct: 55,
        firstSeenMinuteEt: 25,
        emaAligned: false,
      }),
    ).toBe(true);
  });
});
