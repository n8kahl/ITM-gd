import { cacheGet, cacheSet } from '../../config/redis';
import { logger } from '../../lib/logger';
import { getFlowEvents } from './flowEngine';
import type { SPXFlowEvent } from './types';
import { round } from './utils';

export type SPXFlowWindowRange = '5m' | '15m' | '30m';
export type SPXFlowDirectionalBias = 'bullish' | 'bearish' | 'neutral';

export interface SPXFlowWindowSummary {
  window: SPXFlowWindowRange;
  startAt: string;
  endAt: string;
  eventCount: number;
  sweepCount: number;
  blockCount: number;
  bullishPremium: number;
  bearishPremium: number;
  totalPremium: number;
  flowScore: number;
  bias: SPXFlowDirectionalBias;
}

export interface SPXFlowWindowAggregation {
  generatedAt: string;
  source: 'computed' | 'cached' | 'fallback';
  directionalBias: SPXFlowDirectionalBias;
  primaryWindow: SPXFlowWindowRange;
  latestEventAt: string | null;
  windows: Record<SPXFlowWindowRange, SPXFlowWindowSummary>;
}

export interface SPXFlowWindowSignal {
  confirmed: boolean;
  alignmentPct: number | null;
  strength: number;
  window: SPXFlowWindowRange | null;
  eventCount: number;
  institutionalCount: number;
  totalPremium: number;
}

const FLOW_WINDOW_CACHE_KEY = 'spx_command_center:flow:windows:v1';
const FLOW_WINDOW_CACHE_TTL_SECONDS = 8;
const FLOW_WINDOW_EVENT_LIMIT = 1200;
const FLOW_SIGNAL_MIN_PREMIUM = 50_000;
const FLOW_SIGNAL_MIN_EVENTS = 2;

const WINDOW_MINUTES: Record<SPXFlowWindowRange, number> = {
  '5m': 5,
  '15m': 15,
  '30m': 30,
};

const WINDOW_ALIGNMENT_FLOOR: Record<SPXFlowWindowRange, number> = {
  '5m': 58,
  '15m': 56,
  '30m': 54,
};

let aggregationInFlight: Promise<SPXFlowWindowAggregation> | null = null;

interface FlowEventWithTimestamp extends SPXFlowEvent {
  timestampMs: number;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function isDirectionalBias(score: number, totalPremium: number): SPXFlowDirectionalBias {
  if (totalPremium < FLOW_SIGNAL_MIN_PREMIUM * 0.5) return 'neutral';
  if (score >= 57) return 'bullish';
  if (score <= 43) return 'bearish';
  return 'neutral';
}

function toTimestampMs(value: string): number | null {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function normalizeFlowEvents(flowEvents: SPXFlowEvent[], nowMs: number): FlowEventWithTimestamp[] {
  return flowEvents
    .map((event) => {
      const timestampMs = toTimestampMs(event.timestamp);
      if (timestampMs == null || timestampMs > (nowMs + 2_000)) {
        return null;
      }
      return {
        ...event,
        timestampMs,
      } satisfies FlowEventWithTimestamp;
    })
    .filter((event): event is FlowEventWithTimestamp => event !== null)
    .sort((a, b) => b.timestampMs - a.timestampMs)
    .slice(0, FLOW_WINDOW_EVENT_LIMIT);
}

function summarizeWindow(input: {
  events: FlowEventWithTimestamp[];
  window: SPXFlowWindowRange;
  nowMs: number;
}): SPXFlowWindowSummary {
  const windowMs = WINDOW_MINUTES[input.window] * 60_000;
  const startMs = input.nowMs - windowMs;
  const scoped = input.events.filter((event) => event.timestampMs >= startMs && event.timestampMs <= input.nowMs);

  const bullishPremium = scoped
    .filter((event) => event.direction === 'bullish')
    .reduce((sum, event) => sum + event.premium, 0);
  const bearishPremium = scoped
    .filter((event) => event.direction === 'bearish')
    .reduce((sum, event) => sum + event.premium, 0);
  const totalPremium = bullishPremium + bearishPremium;

  const sweepCount = scoped.filter((event) => event.type === 'sweep').length;
  const blockCount = scoped.filter((event) => event.type === 'block').length;

  const flowScore = totalPremium > 0 ? round((bullishPremium / totalPremium) * 100, 2) : 0;
  const bias = isDirectionalBias(flowScore, totalPremium);

  return {
    window: input.window,
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(input.nowMs).toISOString(),
    eventCount: scoped.length,
    sweepCount,
    blockCount,
    bullishPremium: round(bullishPremium, 2),
    bearishPremium: round(bearishPremium, 2),
    totalPremium: round(totalPremium, 2),
    flowScore,
    bias,
  };
}

function selectPrimaryWindow(windows: Record<SPXFlowWindowRange, SPXFlowWindowSummary>): SPXFlowWindowRange {
  const preferredOrder: SPXFlowWindowRange[] = ['5m', '15m', '30m'];
  const active = preferredOrder.find((window) => {
    const summary = windows[window];
    return summary.eventCount >= FLOW_SIGNAL_MIN_EVENTS || summary.totalPremium >= FLOW_SIGNAL_MIN_PREMIUM;
  });
  return active || '30m';
}

function directionalBiasFromWindows(
  windows: Record<SPXFlowWindowRange, SPXFlowWindowSummary>,
): SPXFlowDirectionalBias {
  const summary15m = windows['15m'];
  if (summary15m.totalPremium >= FLOW_SIGNAL_MIN_PREMIUM * 0.5) {
    return summary15m.bias;
  }
  return windows['30m'].bias;
}

export function createNeutralFlowWindowAggregation(asOf: Date = new Date()): SPXFlowWindowAggregation {
  const nowMs = asOf.getTime();
  const windows = (['5m', '15m', '30m'] as SPXFlowWindowRange[]).reduce(
    (acc, window) => {
      acc[window] = summarizeWindow({
        events: [],
        window,
        nowMs,
      });
      return acc;
    },
    {} as Record<SPXFlowWindowRange, SPXFlowWindowSummary>,
  );
  return {
    generatedAt: asOf.toISOString(),
    source: 'fallback',
    directionalBias: 'neutral',
    primaryWindow: '30m',
    latestEventAt: null,
    windows,
  };
}

export function computeFlowWindowAggregation(input: {
  flowEvents: SPXFlowEvent[];
  asOf?: Date;
}): SPXFlowWindowAggregation {
  const asOf = input.asOf || new Date();
  const nowMs = asOf.getTime();
  const events = normalizeFlowEvents(input.flowEvents, nowMs);

  const windows = (['5m', '15m', '30m'] as SPXFlowWindowRange[]).reduce(
    (acc, window) => {
      acc[window] = summarizeWindow({
        events,
        window,
        nowMs,
      });
      return acc;
    },
    {} as Record<SPXFlowWindowRange, SPXFlowWindowSummary>,
  );

  const directionalBias = directionalBiasFromWindows(windows);
  const primaryWindow = selectPrimaryWindow(windows);

  return {
    generatedAt: asOf.toISOString(),
    source: 'computed',
    directionalBias,
    primaryWindow,
    latestEventAt: events[0]?.timestamp || null,
    windows,
  };
}

function isFlowWindowSummary(value: unknown): value is SPXFlowWindowSummary {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SPXFlowWindowSummary>;
  return (
    typeof candidate.window === 'string'
    && typeof candidate.startAt === 'string'
    && typeof candidate.endAt === 'string'
    && Number.isFinite(candidate.eventCount)
    && Number.isFinite(candidate.sweepCount)
    && Number.isFinite(candidate.blockCount)
    && Number.isFinite(candidate.totalPremium)
    && Number.isFinite(candidate.flowScore)
  );
}

function coerceCachedAggregation(value: unknown): SPXFlowWindowAggregation | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SPXFlowWindowAggregation>;
  if (
    typeof candidate.generatedAt !== 'string'
    || !candidate.windows
    || typeof candidate.windows !== 'object'
    || typeof candidate.directionalBias !== 'string'
    || typeof candidate.primaryWindow !== 'string'
  ) {
    return null;
  }
  const window5 = (candidate.windows as Record<string, unknown>)['5m'];
  const window15 = (candidate.windows as Record<string, unknown>)['15m'];
  const window30 = (candidate.windows as Record<string, unknown>)['30m'];
  if (!isFlowWindowSummary(window5) || !isFlowWindowSummary(window15) || !isFlowWindowSummary(window30)) {
    return null;
  }

  return {
    generatedAt: candidate.generatedAt,
    source: 'cached',
    directionalBias: candidate.directionalBias as SPXFlowDirectionalBias,
    primaryWindow: candidate.primaryWindow as SPXFlowWindowRange,
    latestEventAt: typeof candidate.latestEventAt === 'string' ? candidate.latestEventAt : null,
    windows: {
      '5m': window5,
      '15m': window15,
      '30m': window30,
    },
  };
}

export async function getFlowWindowAggregation(options?: {
  forceRefresh?: boolean;
  flowEvents?: SPXFlowEvent[];
  asOf?: Date;
}): Promise<SPXFlowWindowAggregation> {
  const forceRefresh = options?.forceRefresh === true;
  const asOf = options?.asOf || new Date();
  const flowEventsProvided = Array.isArray(options?.flowEvents);
  const shouldUseCache = !forceRefresh && !flowEventsProvided;

  if (shouldUseCache) {
    const cached = coerceCachedAggregation(await cacheGet(FLOW_WINDOW_CACHE_KEY));
    if (cached) {
      return cached;
    }
  }

  if (!forceRefresh && !flowEventsProvided && aggregationInFlight) {
    return aggregationInFlight;
  }

  const run = async (): Promise<SPXFlowWindowAggregation> => {
    try {
      const flowEvents = flowEventsProvided
        ? (options?.flowEvents || [])
        : await getFlowEvents({ forceRefresh });
      const aggregation = computeFlowWindowAggregation({
        flowEvents,
        asOf,
      });
      if (!flowEventsProvided) {
        await cacheSet(FLOW_WINDOW_CACHE_KEY, aggregation, FLOW_WINDOW_CACHE_TTL_SECONDS);
      }
      return aggregation;
    } catch (error) {
      logger.warn('Flow window aggregation failed; falling back', {
        error: error instanceof Error ? error.message : String(error),
      });
      const cached = coerceCachedAggregation(await cacheGet(FLOW_WINDOW_CACHE_KEY));
      if (cached) {
        return cached;
      }
      return createNeutralFlowWindowAggregation(asOf);
    }
  };

  if (flowEventsProvided || forceRefresh) {
    return run();
  }

  aggregationInFlight = run();
  try {
    return await aggregationInFlight;
  } finally {
    aggregationInFlight = null;
  }
}

function alignmentForDirection(flowScore: number, direction: 'bullish' | 'bearish'): number {
  return direction === 'bullish' ? flowScore : (100 - flowScore);
}

export function deriveFlowWindowSignal(input: {
  aggregation: SPXFlowWindowAggregation | null | undefined;
  direction: 'bullish' | 'bearish';
}): SPXFlowWindowSignal {
  if (!input.aggregation) {
    return {
      confirmed: false,
      alignmentPct: null,
      strength: 0,
      window: null,
      eventCount: 0,
      institutionalCount: 0,
      totalPremium: 0,
    };
  }

  const orderedWindows: SPXFlowWindowRange[] = [];
  const pushWindow = (window: SPXFlowWindowRange) => {
    if (!orderedWindows.includes(window)) orderedWindows.push(window);
  };
  pushWindow(input.aggregation.primaryWindow);
  pushWindow('5m');
  pushWindow('15m');
  pushWindow('30m');

  let bestSignal: SPXFlowWindowSignal = {
    confirmed: false,
    alignmentPct: null,
    strength: 0,
    window: null,
    eventCount: 0,
    institutionalCount: 0,
    totalPremium: 0,
  };

  for (const window of orderedWindows) {
    const summary = input.aggregation.windows[window];
    if (!summary) continue;

    const alignmentPct = round(alignmentForDirection(summary.flowScore, input.direction), 2);
    const institutionalCount = summary.sweepCount + summary.blockCount;
    const hasActivity = (
      summary.eventCount >= FLOW_SIGNAL_MIN_EVENTS
      || summary.totalPremium >= FLOW_SIGNAL_MIN_PREMIUM
    );
    const floor = WINDOW_ALIGNMENT_FLOOR[window];
    const confirmed = hasActivity && alignmentPct >= floor;
    const strength = clamp(
      alignmentPct
      + Math.min(18, institutionalCount * 3)
      + (hasActivity ? 6 : 0),
    );

    if (
      confirmed && !bestSignal.confirmed
      || (confirmed === bestSignal.confirmed && strength > bestSignal.strength)
    ) {
      bestSignal = {
        confirmed,
        alignmentPct,
        strength: round(strength, 2),
        window,
        eventCount: summary.eventCount,
        institutionalCount,
        totalPremium: summary.totalPremium,
      };
    }
  }

  return bestSignal;
}
