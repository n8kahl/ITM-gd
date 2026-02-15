import { cacheGet, cacheSet } from '../../config/redis';
import { logger } from '../../lib/logger';
import { getContractRecommendation } from './contractSelector';
import { getPredictionState } from './aiPredictor';
import { detectActiveSetups } from './setupDetector';
import type { CoachMessage, Setup } from './types';
import { nowIso, round, uuid } from './utils';

const COACH_CACHE_KEY = 'spx_command_center:coach_state';
const COACH_CACHE_TTL_SECONDS = 5;

function setupHeadline(setup: Setup): string {
  return `${setup.type.replace(/_/g, ' ')} at ${round((setup.entryZone.low + setup.entryZone.high) / 2, 2)}`;
}

function createPreTradeMessage(setup: Setup): CoachMessage {
  return {
    id: uuid('coach_pre_trade'),
    type: 'pre_trade',
    priority: setup.confluenceScore >= 4 ? 'setup' : 'guidance',
    setupId: setup.id,
    content: `Pre-trade brief: ${setupHeadline(setup)} | confluence ${setup.confluenceScore}/5 | stop ${setup.stop.toFixed(2)} | target1 ${setup.target1.price.toFixed(2)} | target2 ${setup.target2.price.toFixed(2)}`,
    structuredData: {
      setupId: setup.id,
      setupType: setup.type,
      confluenceScore: setup.confluenceScore,
      entry: setup.entryZone,
      stop: setup.stop,
      target1: setup.target1,
      target2: setup.target2,
      probability: setup.probability,
    },
    timestamp: nowIso(),
  };
}

function createRegimeMessage(input: {
  regime: string;
  confidence: number;
  directionBullish: number;
  directionBearish: number;
}): CoachMessage {
  const directionalLabel = input.directionBullish >= input.directionBearish ? 'bullish' : 'bearish';

  return {
    id: uuid('coach_regime'),
    type: 'behavioral',
    priority: input.confidence >= 75 ? 'guidance' : 'behavioral',
    setupId: null,
    content: `Regime update: ${input.regime} (${input.confidence.toFixed(0)}% confidence). Bias is ${directionalLabel}. Favor setups aligned with regime; avoid forcing counter-regime trades.`,
    structuredData: {
      regime: input.regime,
      confidence: input.confidence,
      bullish: input.directionBullish,
      bearish: input.directionBearish,
    },
    timestamp: nowIso(),
  };
}

function createRiskMessage(setups: Setup[]): CoachMessage {
  const lowConfluenceCount = setups.filter((setup) => setup.confluenceScore < 3).length;

  return {
    id: uuid('coach_risk'),
    type: 'alert',
    priority: lowConfluenceCount > 0 ? 'alert' : 'guidance',
    setupId: null,
    content: lowConfluenceCount > 0
      ? `Risk reminder: ${lowConfluenceCount} detected setup(s) are below 3/5 confluence. Skip weak signals and preserve capital for A+ structures.`
      : 'Risk reminder: setup quality is acceptable. Keep execution strict: predefined stop, scale-out plan, and max daily loss guardrail.',
    structuredData: {
      lowConfluenceCount,
      setupCount: setups.length,
    },
    timestamp: nowIso(),
  };
}

export async function getCoachState(options?: { forceRefresh?: boolean }): Promise<{
  messages: CoachMessage[];
  generatedAt: string;
}> {
  const forceRefresh = options?.forceRefresh === true;

  if (!forceRefresh) {
    const cached = await cacheGet<{ messages: CoachMessage[]; generatedAt: string }>(COACH_CACHE_KEY);
    if (cached) {
      return cached;
    }
  }

  const [setups, prediction] = await Promise.all([
    detectActiveSetups({ forceRefresh }),
    getPredictionState({ forceRefresh }),
  ]);

  const readySetup = setups.find((setup) => setup.status === 'ready') || setups[0] || null;
  const messages: CoachMessage[] = [];

  if (readySetup) {
    const contract = await getContractRecommendation({ setupId: readySetup.id, forceRefresh });

    const setupMessage = createPreTradeMessage({
      ...readySetup,
      recommendedContract: contract,
    });

    if (contract) {
      setupMessage.structuredData.contract = contract;
      setupMessage.content += ` | contract ${contract.description} (R:R ${contract.riskReward.toFixed(2)})`;
    }

    messages.push(setupMessage);
  }

  messages.push(createRegimeMessage({
    regime: prediction.regime,
    confidence: prediction.confidence,
    directionBullish: prediction.direction.bullish,
    directionBearish: prediction.direction.bearish,
  }));

  messages.push(createRiskMessage(setups));

  const payload = {
    messages,
    generatedAt: nowIso(),
  };

  await cacheSet(COACH_CACHE_KEY, payload, COACH_CACHE_TTL_SECONDS);

  logger.info('SPX coach state refreshed', {
    messageCount: messages.length,
    hasReadySetup: Boolean(readySetup),
  });

  return payload;
}

export async function generateCoachResponse(input: {
  prompt?: string;
  setupId?: string;
  forceRefresh?: boolean;
}): Promise<CoachMessage> {
  const state = await getCoachState({ forceRefresh: input.forceRefresh });
  const setupMessage = state.messages.find((message) => message.type === 'pre_trade');

  if (!input.prompt || input.prompt.trim().length === 0) {
    return setupMessage || state.messages[0];
  }

  const lower = input.prompt.toLowerCase();

  if (lower.includes('regime') || lower.includes('probability')) {
    return state.messages.find((message) => message.type === 'behavioral') || state.messages[0];
  }

  if (lower.includes('risk') || lower.includes('stop') || lower.includes('loss')) {
    return state.messages.find((message) => message.type === 'alert') || state.messages[0];
  }

  return setupMessage || state.messages[0];
}
