import { MoneyMakerSignal } from './types';
/**
 * Ranks an array of signals and assigns their signalRank property directly.
 * Sorting priority:
 * 1. Confluence score (descending)
 * 2. Risk:Reward ratio (descending)
 * 3. Trend strength (descending)
 */
export declare function rankSignals(signals: MoneyMakerSignal[]): MoneyMakerSignal[];
//# sourceMappingURL=signal-ranker.d.ts.map