import { buildTradeSuggestion } from './tradeBuilder';
import { DetectorSnapshot, SetupDirection, SetupSignal, clampConfidence } from './types';

interface LevelReference {
  label: string;
  price: number;
  side: 'support' | 'resistance';
}

interface LevelTestResult {
  level: LevelReference;
  testCount: number;
  touchIndexes: number[];
  proximityAtr: number;
}

function roundPrice(value: number): number {
  return Number(value.toFixed(2));
}

function buildLevelReferences(snapshot: DetectorSnapshot): LevelReference[] {
  const levels: LevelReference[] = [];

  for (const support of snapshot.levels.levels.support.slice(0, 4)) {
    levels.push({
      label: support.type,
      price: support.price,
      side: 'support',
    });
  }

  for (const resistance of snapshot.levels.levels.resistance.slice(0, 4)) {
    levels.push({
      label: resistance.type,
      price: resistance.price,
      side: 'resistance',
    });
  }

  const vwap = snapshot.levels.levels.indicators.vwap;
  if (vwap && Number.isFinite(vwap)) {
    const side = snapshot.levels.currentPrice >= vwap ? 'support' : 'resistance';
    levels.push({
      label: 'VWAP',
      price: vwap,
      side,
    });
  }

  const unique = new Map<string, LevelReference>();
  for (const level of levels) {
    if (!Number.isFinite(level.price) || level.price <= 0) continue;
    const key = `${level.label}:${roundPrice(level.price)}:${level.side}`;
    if (!unique.has(key)) {
      unique.set(key, level);
    }
  }

  return Array.from(unique.values());
}

function detectTouches(
  bars: DetectorSnapshot['intradayBars'],
  price: number,
  tolerance: number,
): number[] {
  const touches: number[] = [];

  for (let i = 1; i < bars.length - 1; i += 1) {
    const bar = bars[i];
    const touched = bar.l <= price + tolerance && bar.h >= price - tolerance;
    if (!touched) continue;

    const prevTouch = touches[touches.length - 1];
    if (prevTouch !== undefined && i - prevTouch < 3) {
      continue;
    }

    touches.push(i);
  }

  return touches;
}

function setupDirectionForLevel(level: LevelReference): SetupDirection {
  return level.side === 'resistance' ? 'long' : 'short';
}

export function detectLevelTest(snapshot: DetectorSnapshot): SetupSignal | null {
  const bars = snapshot.intradayBars;
  if (bars.length < 30) {
    return null;
  }

  const atr = snapshot.levels.levels.indicators.atr14 ?? Math.max(snapshot.levels.currentPrice * 0.004, 1);
  const tolerance = Math.max(atr * 0.12, snapshot.levels.currentPrice * 0.0007);
  const recentBars = bars.slice(-120);
  const levels = buildLevelReferences(snapshot);

  const candidates: LevelTestResult[] = [];

  for (const level of levels) {
    const proximityAtr = Math.abs(snapshot.levels.currentPrice - level.price) / Math.max(0.01, atr);
    if (proximityAtr > 0.3) {
      continue;
    }

    const touchIndexes = detectTouches(recentBars, level.price, tolerance);
    if (touchIndexes.length < 3) {
      continue;
    }

    const lastTouch = touchIndexes[touchIndexes.length - 1];
    const barsFromLastTouch = recentBars.length - 1 - lastTouch;

    if (barsFromLastTouch > 6) {
      continue;
    }

    candidates.push({
      level,
      testCount: touchIndexes.length,
      touchIndexes,
      proximityAtr,
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    if (a.proximityAtr !== b.proximityAtr) return a.proximityAtr - b.proximityAtr;
    if (b.testCount !== a.testCount) return b.testCount - a.testCount;

    const aLastTouch = a.touchIndexes[a.touchIndexes.length - 1];
    const bLastTouch = b.touchIndexes[b.touchIndexes.length - 1];
    return bLastTouch - aLastTouch;
  });

  const winner = candidates[0];
  const lastTouchIndex = winner.touchIndexes[winner.touchIndexes.length - 1];
  const lastTouchBar = recentBars[lastTouchIndex];
  const proximityAtr = winner.proximityAtr;
  const weakening = winner.testCount >= 3;

  const confidence = clampConfidence(
    64
      + Math.min(16, (winner.testCount - 3) * 5)
      + Math.min(10, Math.max(0, 1.5 - proximityAtr) * 7),
  );

  const direction = setupDirectionForLevel(winner.level);

  return {
    type: 'level_test',
    symbol: snapshot.symbol,
    direction,
    confidence,
    currentPrice: roundPrice(snapshot.levels.currentPrice),
    description: `${snapshot.symbol} ${winner.level.label} tested ${winner.testCount} times; level weakening`,
    dedupeKey: `level_test:${winner.level.side}:${winner.level.label}:${roundPrice(winner.level.price)}:${winner.testCount}`,
    signalData: {
      level: winner.level.label,
      levelPrice: roundPrice(winner.level.price),
      testCount: winner.testCount,
      levelType: winner.level.side,
      weakening,
      tolerance: roundPrice(tolerance),
      lastTestAt: new Date(lastTouchBar.t).toISOString(),
    },
    tradeSuggestion: buildTradeSuggestion({
      setupType: 'level_test',
      direction,
      currentPrice: snapshot.levels.currentPrice,
      atr,
      referenceLevel: winner.level.price,
      range: Math.max(atr * 0.9, Math.abs(snapshot.levels.currentPrice - winner.level.price) + atr * 0.3),
    }),
    detectedAt: snapshot.detectedAt,
  };
}
