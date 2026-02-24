import { getMinuteAggregates, type MassiveAggregate } from '../../config/massive';
import { logger } from '../../lib/logger';
import { getEconomicCalendar } from '../economic';
import { toEasternTime } from '../marketHours';
import { getLatestTick } from '../tickCache';
import { calculateAtrFromBars, type AtrComputationBar } from './atrService';
import { getCalendarContext, shouldBlockStrategies } from './calendarService';
import { evaluateEventRiskGate, type SPXEventRiskGateDecision } from './eventRiskGate';
import { getSPXMarketSessionStatus, type SPXMarketSessionStatus } from './marketSessionService';
import { getSPXNewsSentiment, type SPXNewsSentimentSnapshot } from './newsSentimentService';
import type {
  Regime,
  RegimeState,
  Setup,
  SPXEnvironmentGateDecision,
  SPXStandbyGuidance,
  SPXStandbyNearestSetup,
  SPXStandbyWatchZone,
  SPXVixRegime,
} from './types';
import { round } from './utils';

const MAX_ACTIONABLE_VIX = 30;
const SESSION_LAST_ACTIONABLE_MINUTE_ET = (15 * 60) + 45;
const EXPECTED_MOVE_ATR_MULTIPLIER = 6;
const MIN_EXPECTED_MOVE_POINTS = 8;
const MAX_EXPECTED_MOVE_CONSUMPTION_PCT = 175;
const MACRO_BLACKOUT_MINUTES = 60;
const MACRO_CAUTION_MINUTES = 120;
const COMPRESSION_SPREAD_BLOCK_PCT = 8;
const COMPRESSION_SPREAD_CAUTION_PCT = 5;
const COMPRESSION_REALIZED_VOL_MAX_PCT = 14;
const REALIZED_VOL_LOOKBACK_BARS = 22;
const NEXT_CHECK_INTERVAL_MINUTES = 5;

export interface EvaluateEnvironmentGateInput {
  evaluationDate?: Date;
  currentPrice?: number | null;
  sessionOpenPrice?: number | null;
  atr14?: number | null;
  regime?: Regime | null;
  regimeState?: RegimeState | null;
  bars1m?: AtrComputationBar[] | MassiveAggregate[];
  vixValue?: number | null;
  disableMacroCalendar?: boolean;
  marketSession?: SPXMarketSessionStatus | null;
  newsSentiment?: SPXNewsSentimentSnapshot | null;
  eventRiskOverride?: SPXEventRiskGateDecision | null;
}

interface MacroCalendarEvaluation {
  passed: boolean;
  caution: boolean;
  reason?: string;
  nextEvent: {
    event: string;
    at: string;
    minutesUntil: number;
  } | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') return false;
  return fallback;
}

function parseDateAtEtMinute(dateStr: string, minuteEt: number): Date {
  const utcNoon = new Date(`${dateStr}T12:00:00.000Z`);
  const utcMs = utcNoon.getTime() + ((minuteEt - 12 * 60) * 60 * 1000);
  return new Date(utcMs);
}

function toAtrBars(bars: AtrComputationBar[] | MassiveAggregate[] | null): AtrComputationBar[] {
  if (!bars || bars.length === 0) return [];

  return bars
    .map((bar) => ({
      t: Number((bar as AtrComputationBar).t),
      o: Number((bar as AtrComputationBar).o),
      h: Number((bar as AtrComputationBar).h),
      l: Number((bar as AtrComputationBar).l),
      c: Number((bar as AtrComputationBar).c),
    }))
    .filter((bar) => Number.isFinite(bar.t) && Number.isFinite(bar.c));
}

function inferMacroEventMinuteEt(eventName: string): number {
  const normalized = eventName.toLowerCase();
  if (normalized.includes('fomc') || normalized.includes('federal reserve')) {
    return 14 * 60;
  }
  if (normalized.includes('payroll') || normalized.includes('employment') || normalized.includes('cpi')) {
    return (8 * 60) + 30;
  }
  return 10 * 60;
}

function isPriorityMacroEvent(eventName: string): boolean {
  const normalized = eventName.toLowerCase();
  return (
    normalized.includes('fomc')
    || normalized.includes('federal reserve')
    || normalized.includes('consumer price index')
    || normalized.includes('cpi')
    || normalized.includes('nonfarm payroll')
    || normalized.includes('employment situation')
    || normalized.includes('payroll')
  );
}

function isFedCalendarEvent(eventName: string): boolean {
  const normalized = eventName.toLowerCase();
  return (
    normalized.includes('fomc')
    || normalized.includes('federal reserve')
    || normalized.includes('federal open market')
  );
}

function reasonForVixGate(vixValue: number): string {
  return `VIX ${round(vixValue, 2)} above actionable cap (${MAX_ACTIONABLE_VIX})`;
}

export function classifyVixRegime(vixValue: number | null | undefined): SPXVixRegime {
  if (vixValue == null || !Number.isFinite(vixValue)) return 'unknown';
  if (vixValue < 18) return 'normal';
  if (vixValue < 25) return 'elevated';
  return 'extreme';
}

export function calculateRealizedVolatilityPct(
  bars: AtrComputationBar[] | MassiveAggregate[] | null,
  lookbackBars = REALIZED_VOL_LOOKBACK_BARS,
): number | null {
  const atrBars = toAtrBars(bars)
    .sort((a, b) => a.t - b.t)
    .slice(-(lookbackBars + 1));

  if (atrBars.length < lookbackBars + 1) return null;

  const returns: number[] = [];
  for (let i = 1; i < atrBars.length; i += 1) {
    const prev = atrBars[i - 1]?.c;
    const current = atrBars[i]?.c;
    if (!Number.isFinite(prev) || !Number.isFinite(current) || prev <= 0 || current <= 0) continue;
    returns.push(Math.log(current / prev));
  }

  if (returns.length < 2) return null;

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (returns.length - 1);
  const stdev = Math.sqrt(Math.max(variance, 0));

  const annualizedPct = stdev * Math.sqrt(252 * 390) * 100;
  if (!Number.isFinite(annualizedPct)) return null;

  return round(annualizedPct, 2);
}

export function calculateExpectedMoveConsumption(input: {
  currentPrice: number | null;
  sessionOpenPrice: number | null;
  atr14: number | null;
  regime: Regime | null;
}): { value: number | null; expectedMovePoints: number | null; passed: boolean; reason?: string } {
  const { currentPrice, sessionOpenPrice, atr14, regime } = input;
  if (
    currentPrice == null
    || sessionOpenPrice == null
    || atr14 == null
    || !Number.isFinite(currentPrice)
    || !Number.isFinite(sessionOpenPrice)
    || !Number.isFinite(atr14)
    || atr14 <= 0
  ) {
    return {
      value: null,
      expectedMovePoints: null,
      passed: true,
    };
  }

  const expectedMovePoints = Math.max(atr14 * EXPECTED_MOVE_ATR_MULTIPLIER, MIN_EXPECTED_MOVE_POINTS);
  const traveled = Math.abs(currentPrice - sessionOpenPrice);
  const consumedPct = round((traveled / expectedMovePoints) * 100, 2);

  const passed = consumedPct <= MAX_EXPECTED_MOVE_CONSUMPTION_PCT || regime === 'breakout';
  const reason = passed
    ? undefined
    : `Expected move ${consumedPct}% consumed (${round(traveled, 2)} / ${round(expectedMovePoints, 2)} pts)`;

  return {
    value: consumedPct,
    expectedMovePoints: round(expectedMovePoints, 2),
    passed,
    reason,
  };
}

export function calculateDynamicReadyThreshold(input: {
  baseThreshold?: number;
  vixValue: number | null;
  minuteEt: number;
  regimeState?: RegimeState | null;
  compressionSpreadPct?: number | null;
  macroCaution?: boolean;
}): number {
  const base = Number.isFinite(input.baseThreshold) ? (input.baseThreshold as number) : 3;
  let threshold = base;

  if (input.vixValue != null && Number.isFinite(input.vixValue)) {
    threshold += Math.max(0, (input.vixValue - 20) * 0.03);
    if (input.vixValue >= 25) threshold += 0.15;
  }

  if (input.minuteEt >= (15 * 60) + 30) {
    threshold += 0.3;
  }

  if (input.compressionSpreadPct != null && Number.isFinite(input.compressionSpreadPct)) {
    if (input.compressionSpreadPct > COMPRESSION_SPREAD_BLOCK_PCT) threshold += 0.45;
    else if (input.compressionSpreadPct > COMPRESSION_SPREAD_CAUTION_PCT) threshold += 0.2;
  }

  if (input.macroCaution) {
    threshold += 0.25;
  }

  const regime = input.regimeState?.regime;
  const confidence = input.regimeState?.confidence ?? 0;
  if ((regime === 'trending' || regime === 'breakout') && confidence >= 72) {
    threshold -= 0.2;
  }

  if (regime === 'compression' && confidence >= 65) {
    threshold += 0.15;
  }

  return round(clamp(threshold, 2.5, 4.25), 2);
}

async function evaluateMacroCalendarGate(input: {
  evaluationDate: Date;
  minuteEt: number;
  disableMacroCalendar: boolean;
}): Promise<MacroCalendarEvaluation> {
  if (input.disableMacroCalendar) {
    return {
      passed: true,
      caution: false,
      nextEvent: null,
    };
  }

  const et = toEasternTime(input.evaluationDate);

  try {
    const events = await getEconomicCalendar(2, 'HIGH');
    const nowMs = input.evaluationDate.getTime();
    const fedAnnouncementDates = new Set(
      events
        .filter((event) => isFedCalendarEvent(event.event))
        .map((event) => event.date),
    );

    const calendar = getCalendarContext(et.dateStr, {
      fomcMeetingDates: fedAnnouncementDates,
      fomcAnnouncementDates: fedAnnouncementDates,
    });
    const legacyGate = shouldBlockStrategies(calendar, input.minuteEt);
    if (legacyGate.blocked) {
      const fedEventName = events.find(
        (event) => event.date === et.dateStr && isFedCalendarEvent(event.event),
      )?.event || 'Federal Reserve event';
      return {
        passed: false,
        caution: false,
        reason: legacyGate.reason || 'Calendar blackout in effect',
        nextEvent: {
          event: fedEventName,
          at: parseDateAtEtMinute(et.dateStr, 14 * 60).toISOString(),
          minutesUntil: Math.max(0, (14 * 60) - input.minuteEt),
        },
      };
    }

    const candidates = events
      .filter((event) => isPriorityMacroEvent(event.event))
      .map((event) => {
        const minuteEt = inferMacroEventMinuteEt(event.event);
        const atDate = parseDateAtEtMinute(event.date, minuteEt);
        const minutesUntil = Math.floor((atDate.getTime() - nowMs) / 60000);
        return {
          event: event.event,
          at: atDate,
          minutesUntil,
        };
      })
      .filter((event) => event.minutesUntil >= 0)
      .sort((a, b) => a.minutesUntil - b.minutesUntil);

    const nextEvent = candidates[0] || null;
    if (!nextEvent) {
      return {
        passed: true,
        caution: false,
        nextEvent: null,
      };
    }

    const normalizedNextEvent = {
      event: nextEvent.event,
      at: nextEvent.at.toISOString(),
      minutesUntil: nextEvent.minutesUntil,
    };

    if (nextEvent.minutesUntil <= MACRO_BLACKOUT_MINUTES) {
      return {
        passed: false,
        caution: false,
        reason: `${nextEvent.event} in ${nextEvent.minutesUntil}m (blackout window)`,
        nextEvent: normalizedNextEvent,
      };
    }

    if (nextEvent.minutesUntil <= MACRO_CAUTION_MINUTES) {
      return {
        passed: true,
        caution: true,
        reason: `${nextEvent.event} in ${nextEvent.minutesUntil}m (caution window)`,
        nextEvent: normalizedNextEvent,
      };
    }

    return {
      passed: true,
      caution: false,
      nextEvent: normalizedNextEvent,
    };
  } catch (error) {
    logger.debug('Environment gate macro calendar fetch unavailable', {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      passed: true,
      caution: false,
      nextEvent: null,
    };
  }
}

function toWaitingCondition(reason: string): string {
  const normalized = reason.toLowerCase();
  if (normalized.includes('vix')) return 'VIX volatility needs to cool';
  if (normalized.includes('blackout') || normalized.includes('fomc') || normalized.includes('cpi') || normalized.includes('payroll')) {
    return 'Wait for macro event window to clear';
  }
  if (normalized.includes('high-impact news') || normalized.includes('news flow') || normalized.includes('breaking news')) {
    return 'Wait for high-impact news flow to stabilize';
  }
  if (normalized.includes('last 15 minutes')) return 'Wait for a fresh session window';
  if (normalized.includes('expected move')) return 'Wait for cleaner intraday structure';
  if (normalized.includes('compression')) return 'Need stronger realized volatility expansion';
  return reason;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    next.push(trimmed);
  }
  return next;
}

function toStandbyNearestSetup(setup: Setup, threshold: number, waitReasons: string[]): SPXStandbyNearestSetup {
  const entryLevel = round((setup.entryZone.low + setup.entryZone.high) / 2, 2);
  const confluenceGap = Math.max(0, round(threshold - setup.confluenceScore, 2));
  const conditions = [
    ...waitReasons,
    ...(confluenceGap > 0 ? [`Need +${confluenceGap} confluence`] : []),
    ...(!setup.flowConfirmed ? ['Need options flow alignment'] : []),
  ];

  return {
    setupId: setup.id,
    setupType: setup.type,
    direction: setup.direction,
    entryLevel,
    stop: setup.stop,
    target1: setup.target1.price,
    target2: setup.target2.price,
    estimatedProbability: setup.probability,
    conditionsNeeded: uniqueStrings(conditions).slice(0, 3),
  };
}

function toStandbyWatchZones(setups: Setup[], threshold: number): SPXStandbyWatchZone[] {
  const watchCandidates = [...setups]
    .filter((setup) => setup.status === 'forming' || setup.status === 'ready' || setup.status === 'triggered')
    .sort((a, b) => {
      if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
      return b.confluenceScore - a.confluenceScore;
    })
    .slice(0, 3);

  return watchCandidates.map((setup) => ({
    level: round((setup.entryZone.low + setup.entryZone.high) / 2, 2),
    direction: setup.direction,
    reason: `${setup.type} setup becomes actionable with alignment`,
    confluenceRequired: round(Math.max(threshold, 2), 2),
  }));
}

export function applyEnvironmentGateToSetups(input: {
  setups: Setup[];
  gate: SPXEnvironmentGateDecision;
}): Setup[] {
  if (input.gate.passed) return input.setups;

  return input.setups.map((setup) => {
    if (setup.status !== 'ready' && setup.status !== 'triggered') {
      return setup;
    }

    const reason = input.gate.reason || 'Environment gate blocked actionable setup';
    const existingReasons = Array.isArray(setup.gateReasons) ? setup.gateReasons : [];
    const gateReasons = uniqueStrings([...existingReasons, `environment_gate:${reason}`]);

    return {
      ...setup,
      status: 'forming',
      gateStatus: 'blocked',
      gateReasons,
      tier: setup.tier === 'sniper_primary' || setup.tier === 'sniper_secondary' ? 'watchlist' : setup.tier,
      statusUpdatedAt: new Date().toISOString(),
    };
  });
}

export function buildStandbyGuidance(input: {
  gate: SPXEnvironmentGateDecision;
  setups: Setup[];
  asOfTimestamp: string;
}): SPXStandbyGuidance | null {
  if (input.gate.passed) return null;

  const waitingFor = uniqueStrings(input.gate.reasons.map((reason) => toWaitingCondition(reason))).slice(0, 3);
  const nearestCandidate = [...input.setups]
    .filter((setup) => setup.status !== 'invalidated' && setup.status !== 'expired')
    .sort((a, b) => {
      const aPriority = a.status === 'triggered' ? 0 : a.status === 'ready' ? 1 : 2;
      const bPriority = b.status === 'triggered' ? 0 : b.status === 'ready' ? 1 : 2;
      if (aPriority !== bPriority) return aPriority - bPriority;
      if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
      return b.confluenceScore - a.confluenceScore;
    })[0];

  const nearestSetup = nearestCandidate
    ? toStandbyNearestSetup(nearestCandidate, input.gate.dynamicReadyThreshold, waitingFor)
    : null;

  const watchZones = toStandbyWatchZones(input.setups, input.gate.dynamicReadyThreshold);
  const nextCheckDate = new Date(input.asOfTimestamp);
  if (Number.isFinite(nextCheckDate.getTime())) {
    nextCheckDate.setUTCMinutes(nextCheckDate.getUTCMinutes() + NEXT_CHECK_INTERVAL_MINUTES);
  }

  return {
    status: 'STANDBY',
    reason: input.gate.reason || 'Market environment not suitable for high-conviction entries',
    waitingFor: waitingFor.length > 0 ? waitingFor : ['Waiting for environment gate checks to pass'],
    nearestSetup,
    watchZones,
    nextCheckTime: Number.isFinite(nextCheckDate.getTime())
      ? nextCheckDate.toISOString()
      : new Date(Date.now() + (NEXT_CHECK_INTERVAL_MINUTES * 60 * 1000)).toISOString(),
    environment: {
      vixRegime: input.gate.vixRegime,
      dynamicReadyThreshold: input.gate.dynamicReadyThreshold,
      caution: input.gate.caution,
    },
  };
}

export async function evaluateEnvironmentGate(input: EvaluateEnvironmentGateInput = {}): Promise<SPXEnvironmentGateDecision> {
  const evaluationDate = input.evaluationDate ?? new Date();
  const et = toEasternTime(evaluationDate);
  const minuteEt = (et.hour * 60) + et.minute;

  const bars = toAtrBars(input.bars1m || null);
  const barsForComputation = bars.length > 0
    ? bars
    : toAtrBars(await getMinuteAggregates('I:SPX', et.dateStr).catch(() => []));

  const latestVixTick = getLatestTick('VIX');
  const vixValue = (
    input.vixValue != null
    && Number.isFinite(input.vixValue)
      ? input.vixValue
      : latestVixTick?.price
  ) ?? null;
  const vixRegime = classifyVixRegime(vixValue);

  const sessionStatus = (
    input.marketSession
    || await getSPXMarketSessionStatus({
      evaluationDate,
      preferLive: parseBooleanEnv(process.env.SPX_ENVIRONMENT_LIVE_SESSION_ENABLED, false),
    })
  );
  const minutesUntilClose = sessionStatus.minutesUntilClose;
  const sessionPassed = (
    sessionStatus.status === 'open'
    && (minutesUntilClose == null ? minuteEt <= SESSION_LAST_ACTIONABLE_MINUTE_ET : minutesUntilClose > 15)
  );
  const sessionReason = sessionPassed
    ? undefined
    : sessionStatus.status !== 'open'
      ? `Session ${sessionStatus.status.replace('_', ' ')} is not tradable`
      : 'Last 15 minutes of regular session';

  const atr14 = (
    input.atr14 != null
    && Number.isFinite(input.atr14)
      ? input.atr14
      : calculateAtrFromBars(barsForComputation, 14)
  ) ?? null;

  const sessionOpenPrice = (
    input.sessionOpenPrice != null
    && Number.isFinite(input.sessionOpenPrice)
      ? input.sessionOpenPrice
      : barsForComputation[0]?.o ?? barsForComputation[0]?.c ?? null
  );

  const expectedMove = calculateExpectedMoveConsumption({
    currentPrice: input.currentPrice ?? barsForComputation.at(-1)?.c ?? null,
    sessionOpenPrice,
    atr14,
    regime: input.regime ?? input.regimeState?.regime ?? null,
  });

  const realizedVolPct = calculateRealizedVolatilityPct(barsForComputation);
  const impliedVolPct = vixValue;
  const spreadPct = (
    realizedVolPct != null
    && impliedVolPct != null
      ? round(impliedVolPct - realizedVolPct, 2)
      : null
  );

  const compressionPassed = !(
    spreadPct != null
    && spreadPct > COMPRESSION_SPREAD_BLOCK_PCT
    && (realizedVolPct == null || realizedVolPct < COMPRESSION_REALIZED_VOL_MAX_PCT)
  );
  const compressionReason = compressionPassed
    ? undefined
    : `Volatility compression detected (IV-RV spread ${spreadPct}%)`;
  const compressionCaution = (
    compressionPassed
    && spreadPct != null
    && spreadPct > COMPRESSION_SPREAD_CAUTION_PCT
  );

  const macroCalendar = await evaluateMacroCalendarGate({
    evaluationDate,
    minuteEt,
    disableMacroCalendar: input.disableMacroCalendar === true,
  });
  const eventRiskGateEnabled = parseBooleanEnv(process.env.SPX_EVENT_RISK_GATE_ENABLED, false);
  const newsSentimentEnabled = parseBooleanEnv(process.env.SPX_NEWS_SENTIMENT_ENABLED, false);
  const shouldLoadNewsSentiment = (
    newsSentimentEnabled
    && input.eventRiskOverride == null
  );
  const newsSentiment = input.newsSentiment
    || (
      shouldLoadNewsSentiment
        ? await getSPXNewsSentiment({
          asOf: evaluationDate,
        })
        : null
    );
  const eventRisk = input.eventRiskOverride
    || (eventRiskGateEnabled
      ? evaluateEventRiskGate({
        evaluationDate,
        macroCalendar,
        newsSentiment,
      })
    : {
      passed: true,
      caution: false,
      blackout: false,
      riskScore: 0,
      source: 'none' as const,
      nextEvent: macroCalendar.nextEvent,
      reason: undefined,
      newsSentimentScore: newsSentiment?.score ?? null,
      marketMovingArticleCount: newsSentiment?.marketMovingCount ?? 0,
      recentHighImpactCount: newsSentiment?.recentHighImpactCount ?? 0,
      latestArticleAt: newsSentiment?.latestPublishedAt ?? null,
    });

  const vixPassed = !(vixValue != null && vixValue >= MAX_ACTIONABLE_VIX);
  const vixReason = vixPassed || vixValue == null ? undefined : reasonForVixGate(vixValue);

  const reasons = uniqueStrings([
    ...(vixPassed || !vixReason ? [] : [vixReason]),
    ...(expectedMove.passed || !expectedMove.reason ? [] : [expectedMove.reason]),
    ...(macroCalendar.passed || !macroCalendar.reason ? [] : [macroCalendar.reason]),
    ...(sessionPassed || !sessionReason ? [] : [sessionReason]),
    ...(compressionPassed || !compressionReason ? [] : [compressionReason]),
    ...(eventRisk.passed || !eventRisk.reason ? [] : [eventRisk.reason]),
  ]);

  const dynamicReadyThreshold = calculateDynamicReadyThreshold({
    vixValue,
    minuteEt,
    regimeState: input.regimeState,
    compressionSpreadPct: spreadPct,
    macroCaution: macroCalendar.caution || eventRisk.caution,
  });

  const passed = (
    vixPassed
    && expectedMove.passed
    && macroCalendar.passed
    && sessionPassed
    && compressionPassed
    && eventRisk.passed
  );

  const decision: SPXEnvironmentGateDecision = {
    passed,
    reason: reasons[0] || null,
    reasons,
    vixRegime,
    dynamicReadyThreshold,
    caution: macroCalendar.caution || compressionCaution || eventRisk.caution,
    breakdown: {
      vixRegime: {
        passed: vixPassed,
        regime: vixRegime,
        value: vixValue,
        reason: vixReason,
      },
      expectedMoveConsumption: {
        passed: expectedMove.passed,
        value: expectedMove.value,
        expectedMovePoints: expectedMove.expectedMovePoints,
        reason: expectedMove.reason,
      },
      macroCalendar: {
        passed: macroCalendar.passed,
        caution: macroCalendar.caution,
        reason: macroCalendar.reason,
        nextEvent: macroCalendar.nextEvent,
      },
      sessionTime: {
        passed: sessionPassed,
        minuteEt: sessionStatus.minuteEt,
        minutesUntilClose,
        source: sessionStatus.source,
        reason: sessionReason,
      },
      compression: {
        passed: compressionPassed,
        realizedVolPct,
        impliedVolPct,
        spreadPct,
        reason: compressionReason,
      },
      eventRisk: {
        passed: eventRisk.passed,
        caution: eventRisk.caution,
        blackout: eventRisk.blackout,
        riskScore: eventRisk.riskScore,
        source: eventRisk.source,
        nextEvent: eventRisk.nextEvent,
        newsSentimentScore: eventRisk.newsSentimentScore,
        marketMovingArticleCount: eventRisk.marketMovingArticleCount,
        recentHighImpactCount: eventRisk.recentHighImpactCount,
        latestArticleAt: eventRisk.latestArticleAt,
        reason: eventRisk.reason,
      },
    },
  };

  logger.debug('SPX environment gate evaluated', {
    passed: decision.passed,
    reason: decision.reason,
    vixRegime: decision.vixRegime,
    dynamicReadyThreshold: decision.dynamicReadyThreshold,
    caution: decision.caution,
    eventRiskScore: decision.breakdown.eventRisk?.riskScore ?? 0,
    eventRiskSource: decision.breakdown.eventRisk?.source ?? 'none',
  });

  return decision;
}
