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

let snapshotInFlight: Promise<SPXSnapshot> | null = null;

export async function getSPXSnapshot(options?: { forceRefresh?: boolean }): Promise<SPXSnapshot> {
  const forceRefresh = options?.forceRefresh === true;
  if (!forceRefresh && snapshotInFlight) {
    return snapshotInFlight;
  }

  const run = async (): Promise<SPXSnapshot> => {
    // Build snapshot dependencies once in a deterministic order to avoid recursive fan-out.
    const gex = await computeUnifiedGEXLandscape({ forceRefresh });
    const basis = await getBasisState({ forceRefresh, gexLandscape: gex });
    const fibLevels = await getFibLevels({ forceRefresh, basisState: basis });
    const levelData = await getMergedLevels({ forceRefresh, basisState: basis, gexLandscape: gex, fibLevels });
    const regime = await classifyCurrentRegime({ forceRefresh, gexLandscape: gex, levelData });
    const setupsRaw = await detectActiveSetups({
      forceRefresh,
      levelData,
      gexLandscape: gex,
      fibLevels,
      regimeState: regime,
    });
    const prediction = await getPredictionState({
      forceRefresh,
      regimeState: regime,
      levelData,
      gexLandscape: gex,
    });

    const [flow, coachState] = await Promise.all([
      getFlowEvents({ forceRefresh, fallbackSetups: setupsRaw, fallbackGex: gex }),
      getCoachState({ forceRefresh, setups: setupsRaw, prediction }),
    ]);

    const setups = await Promise.all(
      setupsRaw.map(async (setup, index) => {
        if (index > 2 || setup.status !== 'ready') return setup;
        const recommendation = await getContractRecommendation({ setupId: setup.id, setup, forceRefresh });
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
  };

  if (forceRefresh) {
    return run();
  }

  snapshotInFlight = run();
  try {
    return await snapshotInFlight;
  } finally {
    snapshotInFlight = null;
  }
}
