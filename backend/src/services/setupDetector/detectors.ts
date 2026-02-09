import { detectBreakRetest } from './breakRetest';
import { detectGapFill } from './gapFill';
import { detectOrbBreakout } from './orb';
import { DetectorSnapshot, SetupSignal } from './types';
import { detectVWAPPlay } from './vwap';

/**
 * Run all active setup detectors and return detected signals sorted by confidence.
 */
export function detectSetupsFromSnapshot(snapshot: DetectorSnapshot): SetupSignal[] {
  const detections: Array<SetupSignal | null> = [
    detectOrbBreakout(snapshot),
    detectBreakRetest(snapshot),
    detectVWAPPlay(snapshot),
    detectGapFill(snapshot),
  ];

  return detections
    .filter((signal): signal is SetupSignal => signal !== null)
    .sort((a, b) => b.confidence - a.confidence);
}
