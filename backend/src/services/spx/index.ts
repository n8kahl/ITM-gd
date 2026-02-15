import { getPredictionState } from './aiPredictor';
import { getCoachState } from './aiCoach';
import { getContractRecommendation } from './contractSelector';
import { getBasisState } from './crossReference';
import { getFibLevels } from './fibEngine';
import { getFlowEvents } from './flowEngine';
import { computeUnifiedGEXLandscape } from './gexEngine';
import { getMergedLevels } from './levelEngine';
import { classifyCurrentRegime } from './regimeClassifier';
import { detectActiveSetups } from './setupDetector';
import type { SPXSnapshot } from './types';
import { nowIso } from './utils';

export async function getSPXSnapshot(options?: { forceRefresh?: boolean }): Promise<SPXSnapshot> {
  const forceRefresh = options?.forceRefresh === true;

  const [levelData, fibLevels, gex, basis, setupsRaw, regime, prediction, flow, coachState] = await Promise.all([
    getMergedLevels({ forceRefresh }),
    getFibLevels({ forceRefresh }),
    computeUnifiedGEXLandscape({ forceRefresh }),
    getBasisState({ forceRefresh }),
    detectActiveSetups({ forceRefresh }),
    classifyCurrentRegime({ forceRefresh }),
    getPredictionState({ forceRefresh }),
    getFlowEvents({ forceRefresh }),
    getCoachState({ forceRefresh }),
  ]);

  const setups = await Promise.all(
    setupsRaw.map(async (setup, index) => {
      if (index > 2 || setup.status !== 'ready') return setup;
      const recommendation = await getContractRecommendation({ setupId: setup.id, forceRefresh });
      return {
        ...setup,
        recommendedContract: recommendation,
      };
    }),
  );

  return {
    levels: levelData.levels,
    clusters: levelData.clusters,
    fibLevels,
    gex,
    basis,
    setups,
    regime,
    prediction,
    flow,
    coachMessages: coachState.messages,
    generatedAt: nowIso(),
  };
}
