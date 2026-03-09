import { getEconomicCalendar } from '../economic';
import { getMarketHealthSnapshot } from '../marketAnalytics';
import { analyzeIVProfile } from '../options/ivAnalysis';
import { logger } from '../../lib/logger';
import { getSwingSniperWatchlistState } from './persistence';
import type { SwingSniperBriefResponse, SwingSniperSavedThesisSnapshot } from './types';
import { buildEdgeState } from './utils';

function buildMemo(regimeLabel: string, regimeDescription: string, macroEvents: string[]): string {
  const macroFragment = macroEvents.length > 0
    ? `Nearest macro pressure points: ${macroEvents.join(', ')}.`
    : 'Macro calendar is relatively light, so single-name catalysts should matter more than usual.';

  return `Regime: ${regimeLabel}. ${regimeDescription} ${macroFragment}`;
}

export async function buildSwingSniperBrief(userId: string): Promise<SwingSniperBriefResponse> {
  const [watchlistState, marketHealth, economicEvents] = await Promise.all([
    getSwingSniperWatchlistState(userId),
    getMarketHealthSnapshot().catch(() => null),
    getEconomicCalendar(7, 'HIGH').catch(() => []),
  ]);

  const enrichedSavedTheses = await Promise.all(
    watchlistState.savedTheses.slice(0, 5).map(async (saved): Promise<SwingSniperSavedThesisSnapshot> => {
      let ivRankNow: number | null = null;

      try {
        const ivProfile = await analyzeIVProfile(saved.symbol, {
          strikeRange: 12,
          maxExpirations: 3,
        });
        ivRankNow = ivProfile.ivRank.ivRank;
      } catch (error) {
        logger.warn('Swing Sniper saved thesis IV refresh failed', {
          symbol: saved.symbol,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const edgeState = buildEdgeState(saved.direction, saved.ivRankAtSave, ivRankNow);

      return {
        symbol: saved.symbol,
        savedAt: saved.savedAt,
        score: saved.score,
        setupLabel: saved.setupLabel,
        direction: saved.direction,
        thesis: saved.thesis,
        ivRankAtSave: saved.ivRankAtSave,
        ivRankNow,
        edgeState,
        monitorNote: saved.monitorNote,
      };
    }),
  );

  const marketRegime = marketHealth?.regime ?? {
    label: 'Neutral',
    description: 'Mixed signals keep the tape balanced for now.',
    signals: ['Market analytics unavailable'],
  };

  const macroLabels = economicEvents.slice(0, 3).map((event) => `${event.event} ${event.date.slice(5)}`);

  const actionQueue = enrichedSavedTheses.length > 0
    ? enrichedSavedTheses.slice(0, 3).map((thesis) => {
      const drift = thesis.ivRankAtSave != null && thesis.ivRankNow != null
        ? `${thesis.ivRankAtSave.toFixed(0)} -> ${thesis.ivRankNow.toFixed(0)}`
        : 'IV drift unavailable';
      return `${thesis.symbol}: ${thesis.edgeState.replace('_', ' ')} edge (${drift}).`;
    })
    : [
      'Scan the top board names and save only ideas where the IV vs RV gap is obvious.',
      'Use the catalyst density strip to separate clustered setups from slow-burn names.',
      'Do not structure a trade yet if the thesis reads balanced instead of mispriced.',
    ];

  return {
    generatedAt: new Date().toISOString(),
    regime: {
      label: marketRegime.label,
      description: marketRegime.description,
      signals: marketRegime.signals,
    },
    memo: buildMemo(marketRegime.label, marketRegime.description, macroLabels),
    actionQueue,
    savedTheses: enrichedSavedTheses,
  };
}
