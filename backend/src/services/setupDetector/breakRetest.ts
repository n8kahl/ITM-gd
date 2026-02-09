import { buildTradeSuggestion } from './tradeBuilder';
import { DetectorSnapshot, SetupSignal, clampConfidence } from './types';

interface LevelRef {
  label: string;
  price: number;
}

function roundPrice(value: number): number {
  return Number(value.toFixed(2));
}

function uniqueLevels(levels: LevelRef[]): LevelRef[] {
  const seen = new Set<string>();
  const deduped: LevelRef[] = [];

  for (const level of levels) {
    const key = `${level.label}:${roundPrice(level.price)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(level);
  }

  return deduped;
}

function buildKeyLevels(snapshot: DetectorSnapshot): LevelRef[] {
  const levels: LevelRef[] = [];

  for (const level of snapshot.levels.levels.resistance.slice(0, 5)) {
    levels.push({ label: level.type, price: level.price });
  }

  for (const level of snapshot.levels.levels.support.slice(0, 5)) {
    levels.push({ label: level.type, price: level.price });
  }

  const vwap = snapshot.levels.levels.indicators.vwap;
  if (vwap && vwap > 0) {
    levels.push({ label: 'VWAP', price: vwap });
  }

  const currentPrice = snapshot.levels.currentPrice;
  const roundIncrement = currentPrice >= 1000 ? 25 : 5;
  const nearestRound = Math.round(currentPrice / roundIncrement) * roundIncrement;
  levels.push({ label: 'ROUND', price: nearestRound - roundIncrement });
  levels.push({ label: 'ROUND', price: nearestRound });
  levels.push({ label: 'ROUND', price: nearestRound + roundIncrement });

  return uniqueLevels(levels).filter((level) => Number.isFinite(level.price) && level.price > 0);
}

function detectRejectionPattern(
  bar: { o: number; h: number; l: number; c: number },
  direction: 'long' | 'short',
): string {
  const body = Math.abs(bar.c - bar.o);
  const range = Math.max(0.01, bar.h - bar.l);
  const upperWick = bar.h - Math.max(bar.o, bar.c);
  const lowerWick = Math.min(bar.o, bar.c) - bar.l;

  if (body / range <= 0.22) {
    return 'doji';
  }

  if (direction === 'long' && lowerWick > body * 1.5) {
    return 'hammer';
  }

  if (direction === 'short' && upperWick > body * 1.5) {
    return 'shooting_star';
  }

  return 'rejection';
}

export function detectBreakRetest(snapshot: DetectorSnapshot): SetupSignal | null {
  const bars = snapshot.intradayBars;
  if (bars.length < 25) return null;

  const atr = snapshot.levels.levels.indicators.atr14 ?? Math.max(snapshot.levels.currentPrice * 0.004, 1);
  const tolerance = Math.max(atr * 0.15, snapshot.levels.currentPrice * 0.0006);
  const lookbackBars = bars.slice(-60);
  const lastBar = lookbackBars[lookbackBars.length - 1];
  const levels = buildKeyLevels(snapshot);

  for (const level of levels) {
    for (let i = 2; i < lookbackBars.length - 3; i += 1) {
      const prior = lookbackBars[i - 1];
      const breakBar = lookbackBars[i];
      const remaining = lookbackBars.slice(i + 1);

      const longBreak = prior.c <= level.price && breakBar.c > level.price + tolerance * 0.2;
      if (longBreak) {
        const retestBar = remaining.find((bar) => bar.l <= level.price + tolerance && bar.l >= level.price - tolerance);
        if (!retestBar) continue;

        const retestIndex = remaining.indexOf(retestBar);
        const barsAfterRetest = remaining.slice(retestIndex + 1);
        const confirmationBar = barsAfterRetest[barsAfterRetest.length - 1] || lastBar;
        const confirmsBounce = confirmationBar.c > level.price + tolerance * 0.25;
        const volumeValid = retestBar.v <= breakBar.v * 1.1;

        if (!confirmsBounce || !volumeValid) {
          continue;
        }

        const rejectionPattern = detectRejectionPattern(retestBar, 'long');
        const confidence = clampConfidence(
          64 + Math.max(0, (breakBar.v - retestBar.v) / Math.max(1, breakBar.v)) * 20,
        );

        return {
          type: 'break_retest',
          symbol: snapshot.symbol,
          direction: 'long',
          confidence,
          currentPrice: roundPrice(confirmationBar.c),
          description: `${snapshot.symbol} broke and held ${level.label} at $${roundPrice(level.price)} with a clean retest`,
          dedupeKey: `break_retest:long:${level.label}:${roundPrice(level.price)}`,
          signalData: {
            level: level.label,
            levelPrice: roundPrice(level.price),
            breakBar: new Date(breakBar.t).toISOString(),
            retestBar: new Date(retestBar.t).toISOString(),
            rejectionPattern,
            tolerance: roundPrice(tolerance),
          },
          tradeSuggestion: buildTradeSuggestion({
            setupType: 'break_retest',
            direction: 'long',
            currentPrice: confirmationBar.c,
            atr,
            referenceLevel: level.price,
            range: Math.max(atr * 0.8, Math.abs(confirmationBar.c - level.price)),
          }),
          detectedAt: snapshot.detectedAt,
        };
      }

      const shortBreak = prior.c >= level.price && breakBar.c < level.price - tolerance * 0.2;
      if (!shortBreak) {
        continue;
      }

      const retestBar = remaining.find((bar) => bar.h >= level.price - tolerance && bar.h <= level.price + tolerance);
      if (!retestBar) {
        continue;
      }

      const retestIndex = remaining.indexOf(retestBar);
      const barsAfterRetest = remaining.slice(retestIndex + 1);
      const confirmationBar = barsAfterRetest[barsAfterRetest.length - 1] || lastBar;
      const confirmsReject = confirmationBar.c < level.price - tolerance * 0.25;
      const volumeValid = retestBar.v <= breakBar.v * 1.1;

      if (!confirmsReject || !volumeValid) {
        continue;
      }

      const rejectionPattern = detectRejectionPattern(retestBar, 'short');
      const confidence = clampConfidence(
        64 + Math.max(0, (breakBar.v - retestBar.v) / Math.max(1, breakBar.v)) * 20,
      );

      return {
        type: 'break_retest',
        symbol: snapshot.symbol,
        direction: 'short',
        confidence,
        currentPrice: roundPrice(confirmationBar.c),
        description: `${snapshot.symbol} broke below ${level.label} at $${roundPrice(level.price)} and rejected retest`,
        dedupeKey: `break_retest:short:${level.label}:${roundPrice(level.price)}`,
        signalData: {
          level: level.label,
          levelPrice: roundPrice(level.price),
          breakBar: new Date(breakBar.t).toISOString(),
          retestBar: new Date(retestBar.t).toISOString(),
          rejectionPattern,
          tolerance: roundPrice(tolerance),
        },
        tradeSuggestion: buildTradeSuggestion({
          setupType: 'break_retest',
          direction: 'short',
          currentPrice: confirmationBar.c,
          atr,
          referenceLevel: level.price,
          range: Math.max(atr * 0.8, Math.abs(confirmationBar.c - level.price)),
        }),
        detectedAt: snapshot.detectedAt,
      };
    }
  }

  return null;
}
