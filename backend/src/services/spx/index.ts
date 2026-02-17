import { getPredictionState } from './aiPredictor';
import { getCoachState } from './aiCoach';
import { getContractRecommendation } from './contractSelector';
import { getBasisState } from './crossReference';
import { getFibLevels } from './fibEngine';
import { getFlowEvents } from './flowEngine';
import { computeUnifiedGEXLandscape } from './gexEngine';
import { getMergedLevels } from './levelEngine';
import { logger } from '../../lib/logger';
import { classifyCurrentRegime } from './regimeClassifier';
import { detectActiveSetups } from './setupDetector';
import type { SPXSnapshot } from './types';
import { nowIso } from './utils';

let snapshotInFlight: Promise<SPXSnapshot> | null = null;
const SNAPSHOT_CONTRACT_ENRICHMENT_BUDGET_MS = 2500;
const SNAPSHOT_MAX_INLINE_RECOMMENDATIONS = 2;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error('Timed out')), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export async function getSPXSnapshot(options?: { forceRefresh?: boolean }): Promise<SPXSnapshot> {
  const forceRefresh = options?.forceRefresh === true;
  if (!forceRefresh && snapshotInFlight) {
    return snapshotInFlight;
  }

  const run = async (): Promise<SPXSnapshot> => {
    // Flow events are independent of GEX — fetch them concurrently.
    const [gex, flow] = await Promise.all([
      computeUnifiedGEXLandscape({ forceRefresh }),
      getFlowEvents({ forceRefresh }),
    ]);
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
      flowEvents: flow,
    });
    const prediction = await getPredictionState({
      forceRefresh,
      regimeState: regime,
      levelData,
      gexLandscape: gex,
    });

    const coachState = await getCoachState({ forceRefresh, setups: setupsRaw, prediction });

    const deadline = Date.now() + SNAPSHOT_CONTRACT_ENRICHMENT_BUDGET_MS;
    let inlineRecommendations = 0;
    const setups = await Promise.all(
      setupsRaw.map(async (setup) => {
        if (setup.status !== 'ready') return setup;
        if (inlineRecommendations >= SNAPSHOT_MAX_INLINE_RECOMMENDATIONS) return setup;

        const timeRemainingMs = deadline - Date.now();
        if (timeRemainingMs <= 300) return setup;

        inlineRecommendations += 1;
        try {
          const recommendation = await withTimeout(
            getContractRecommendation({ setupId: setup.id, setup, forceRefresh }),
            Math.max(300, timeRemainingMs),
          );
          return {
            ...setup,
            recommendedContract: recommendation,
          };
        } catch (error) {
          logger.warn('Skipping inline contract recommendation during snapshot due to latency', {
            setupId: setup.id,
            error: error instanceof Error ? error.message : String(error),
          });
          return setup;
        }
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
