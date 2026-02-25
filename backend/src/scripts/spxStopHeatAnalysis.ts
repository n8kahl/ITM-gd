import { getAggregates, type MassiveAggregate } from '../config/massive';
import { supabase } from '../config/database';
import { toEasternTime } from '../services/marketHours';
import type { Regime } from '../services/spx/types';

type Direction = 'bullish' | 'bearish';

type StopHeatRow = {
  engine_setup_id: string;
  session_date: string;
  setup_type: string;
  direction: Direction | null;
  regime: string | null;
  entry_zone_low: number | string | null;
  entry_zone_high: number | string | null;
  stop_price: number | string | null;
  target_1_price: number | string | null;
  triggered_at: string | null;
  stop_hit_at: string | null;
  metadata: Record<string, unknown> | null;
};

type KnownRegime = Regime | 'unknown';

interface ParsedStopTrade {
  engineSetupId: string;
  sessionDate: string;
  setupType: string;
  direction: Direction;
  regime: KnownRegime;
  entryPrice: number;
  stopPrice: number;
  target1Price: number;
  triggeredAtMs: number | null;
  stopHitAt: string;
  stopHitAtMs: number;
  metadata: Record<string, unknown> | null;
}

interface AnalyzedStopTrade {
  engineSetupId: string;
  sessionDate: string;
  setupType: string;
  direction: Direction;
  regime: KnownRegime;
  entryPrice: number;
  stopPrice: number;
  target1Price: number;
  stopHitAt: string;
  postStopExtreme: number;
  postStopT1TravelPct: number;
  postStopT1Reached: boolean;
  distanceStopToT1Points: number;
  distanceStopToReversalPoints: number;
  additionalStopPointsNeeded: number;
  effectiveAtrMultiplier: number | null;
  requiredAtrMultiplierToAvoid: number | null;
  atr14: number | null;
  marginalStop: boolean;
  shakeout: boolean;
  bucket: HistogramBucketLabel;
}

type AnalyzedStopTradeWithRequiredMultiplier = AnalyzedStopTrade & {
  requiredAtrMultiplierToAvoid: number;
};

type HistogramBucketLabel = '0-10%' | '10-25%' | '25-50%' | '50-75%' | '75-100%+';

const HISTOGRAM_BUCKET_ORDER: HistogramBucketLabel[] = [
  '0-10%',
  '10-25%',
  '25-50%',
  '50-75%',
  '75-100%+',
];

const REGIME_ORDER: Regime[] = ['compression', 'ranging', 'trending', 'breakout'];
const DEFAULT_TTL_TRIGGERED_MS = 90 * 60 * 1000;

function parseArg(name: string): string | null {
  const eqPrefix = `--${name}=`;
  const eqArg = process.argv.find((arg) => arg.startsWith(eqPrefix));
  if (eqArg) {
    const value = eqArg.slice(eqPrefix.length).trim();
    return value.length > 0 ? value : null;
  }

  const flag = `--${name}`;
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) return null;
  return value.trim();
}

function parseIntArg(name: string, fallback: number, min: number, max: number): number {
  const raw = parseArg(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function daysAgo(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function defaultDateRangeEt(): { from: string; to: string } {
  const et = toEasternTime(new Date());
  const to = et.dateStr;
  const from = daysAgo(to, 45);
  return { from, to };
}

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toEpochMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRegime(value: string | null): KnownRegime {
  if (value === 'compression' || value === 'ranging' || value === 'trending' || value === 'breakout') {
    return value;
  }
  return 'unknown';
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (percentileValue / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower];
  const weight = rank - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function hasRequiredMultiplier(
  trade: AnalyzedStopTrade,
): trade is AnalyzedStopTradeWithRequiredMultiplier {
  return typeof trade.requiredAtrMultiplierToAvoid === 'number'
    && Number.isFinite(trade.requiredAtrMultiplierToAvoid);
}

function toBucketLabel(postStopT1TravelPct: number): HistogramBucketLabel {
  if (postStopT1TravelPct <= 10) return '0-10%';
  if (postStopT1TravelPct <= 25) return '10-25%';
  if (postStopT1TravelPct <= 50) return '25-50%';
  if (postStopT1TravelPct <= 75) return '50-75%';
  return '75-100%+';
}

function barContainsAmbiguity(input: {
  direction: Direction;
  stopPrice: number;
  target1Price: number;
  bar: MassiveAggregate;
}): boolean {
  if (input.direction === 'bullish') {
    const stopTouched = input.bar.l <= input.stopPrice;
    const targetTouched = input.bar.h >= input.target1Price;
    return stopTouched && targetTouched;
  }
  const stopTouched = input.bar.h >= input.stopPrice;
  const targetTouched = input.bar.l <= input.target1Price;
  return stopTouched && targetTouched;
}

function getRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function findNestedNumberByKey(value: unknown, key: string, depth: number): number | null {
  if (depth < 0) return null;
  const record = getRecord(value);
  if (!record) return null;

  const direct = toFiniteNumber(record[key]);
  if (direct != null) return direct;
  if (depth === 0) return null;

  for (const child of Object.values(record)) {
    const nested = findNestedNumberByKey(child, key, depth - 1);
    if (nested != null) return nested;
  }
  return null;
}

function findNestedStringByKey(value: unknown, key: string, depth: number): string | null {
  if (depth < 0) return null;
  const record = getRecord(value);
  if (!record) return null;

  const direct = record[key];
  if (typeof direct === 'string' && direct.trim().length > 0) return direct.trim();
  if (depth === 0) return null;

  for (const child of Object.values(record)) {
    const nested = findNestedStringByKey(child, key, depth - 1);
    if (nested) return nested;
  }
  return null;
}

function extractAtr14(metadata: Record<string, unknown> | null): number | null {
  if (!metadata) return null;
  const explicitCandidates: unknown[] = [
    metadata.atr14,
    getRecord(metadata.indicatorContext)?.atr14,
    getRecord(metadata.indicators)?.atr14,
    getRecord(metadata.stopContext)?.atr14,
  ];
  for (const candidate of explicitCandidates) {
    const parsed = toFiniteNumber(candidate);
    if (parsed != null && parsed > 0) return parsed;
  }
  const nested = findNestedNumberByKey(metadata, 'atr14', 4);
  return nested != null && nested > 0 ? nested : null;
}

function resolveTtlRemainingMs(input: {
  metadata: Record<string, unknown> | null;
  triggeredAtMs: number | null;
  stopHitAtMs: number;
  defaultTtlTriggeredMs: number;
}): number | null {
  const ttlExpiresAtRaw = findNestedStringByKey(input.metadata, 'ttlExpiresAt', 4);
  const ttlExpiresAtMs = toEpochMs(ttlExpiresAtRaw);
  if (ttlExpiresAtMs != null) {
    return Math.max(0, ttlExpiresAtMs - input.stopHitAtMs);
  }

  if (input.triggeredAtMs == null) return null;

  const ttlTriggeredMs = (() => {
    const nestedCandidate = findNestedNumberByKey(input.metadata, 'ttlTriggeredMs', 4);
    if (nestedCandidate != null && nestedCandidate > 0) return nestedCandidate;
    const explicitCandidate = findNestedNumberByKey(input.metadata, 'setupTtlTriggeredMs', 4);
    if (explicitCandidate != null && explicitCandidate > 0) return explicitCandidate;
    return input.defaultTtlTriggeredMs;
  })();

  return Math.max(0, (input.triggeredAtMs + ttlTriggeredMs) - input.stopHitAtMs);
}

function pushExclusion(counter: Map<string, number>, reason: string): void {
  counter.set(reason, (counter.get(reason) || 0) + 1);
}

async function loadSessionSecondBars(sessionDates: string[]): Promise<{
  barsBySession: Map<string, MassiveAggregate[]>;
  missingSessions: string[];
}> {
  const uniqueDates = Array.from(new Set(sessionDates)).sort();
  const barsBySession = new Map<string, MassiveAggregate[]>();
  const missingSessions: string[] = [];

  for (const sessionDate of uniqueDates) {
    try {
      const response = await getAggregates('I:SPX', 1, 'second', sessionDate, sessionDate);
      const bars = Array.isArray(response.results) ? response.results : [];
      if (bars.length === 0) {
        missingSessions.push(sessionDate);
        barsBySession.set(sessionDate, []);
        continue;
      }
      barsBySession.set(sessionDate, [...bars].sort((a, b) => a.t - b.t));
    } catch {
      missingSessions.push(sessionDate);
      barsBySession.set(sessionDate, []);
    }
  }

  return { barsBySession, missingSessions };
}

function buildSessionRegimeSummary(rows: AnalyzedStopTrade[]): Record<string, number> {
  const summary: Record<string, number> = {
    compression: 0,
    ranging: 0,
    trending: 0,
    breakout: 0,
    unknown: 0,
  };

  for (const row of rows) {
    summary[row.regime] = (summary[row.regime] || 0) + 1;
  }

  return summary;
}

function parseRow(raw: StopHeatRow): ParsedStopTrade | null {
  const direction = raw.direction;
  if (direction !== 'bullish' && direction !== 'bearish') return null;

  const entryLow = toFiniteNumber(raw.entry_zone_low);
  const entryHigh = toFiniteNumber(raw.entry_zone_high);
  const stopPrice = toFiniteNumber(raw.stop_price);
  const target1Price = toFiniteNumber(raw.target_1_price);
  const stopHitAtMs = toEpochMs(raw.stop_hit_at);

  if (
    entryLow == null
    || entryHigh == null
    || stopPrice == null
    || target1Price == null
    || stopHitAtMs == null
  ) {
    return null;
  }

  const entryPrice = (entryLow + entryHigh) / 2;
  const stopToTargetDistance = Math.abs(target1Price - stopPrice);
  if (stopToTargetDistance <= 0.0001) return null;

  const metadata = getRecord(raw.metadata);

  return {
    engineSetupId: raw.engine_setup_id,
    sessionDate: raw.session_date,
    setupType: raw.setup_type,
    direction,
    regime: normalizeRegime(raw.regime),
    entryPrice,
    stopPrice,
    target1Price,
    triggeredAtMs: toEpochMs(raw.triggered_at),
    stopHitAt: new Date(stopHitAtMs).toISOString(),
    stopHitAtMs,
    metadata,
  };
}

function hasAmbiguousPreStopBar(input: {
  trade: ParsedStopTrade;
  bars: MassiveAggregate[];
}): boolean {
  const startMs = input.trade.triggeredAtMs ?? input.trade.stopHitAtMs;
  const endMs = input.trade.stopHitAtMs;
  if (startMs > endMs) return false;

  for (const bar of input.bars) {
    if (bar.t < startMs || bar.t > endMs) continue;
    if (barContainsAmbiguity({
      direction: input.trade.direction,
      stopPrice: input.trade.stopPrice,
      target1Price: input.trade.target1Price,
      bar,
    })) {
      return true;
    }
  }

  return false;
}

function getPostStopWindowBars(input: {
  bars: MassiveAggregate[];
  stopHitAtMs: number;
  windowMs: number;
}): MassiveAggregate[] {
  const endMs = input.stopHitAtMs + input.windowMs;
  const selected: MassiveAggregate[] = [];
  for (const bar of input.bars) {
    if (bar.t <= input.stopHitAtMs) continue;
    if (bar.t > endMs) break;
    selected.push(bar);
  }
  return selected;
}

async function main(): Promise<void> {
  const defaults = defaultDateRangeEt();
  const from = parseArg('from') || defaults.from;
  const to = parseArg('to') || defaults.to;
  const postStopWindowMinutes = parseIntArg('post-stop-window-minutes', 30, 1, 180);

  if (!isIsoDate(from) || !isIsoDate(to)) {
    throw new Error('Invalid date format. Use YYYY-MM-DD for --from and --to.');
  }
  if (from > to) {
    throw new Error(`Invalid date range: from ${from} is after to ${to}.`);
  }

  const defaultTtlTriggeredMs = parseIntArg(
    'ttl-triggered-ms',
    toFiniteNumber(process.env.SPX_SETUP_TTL_TRIGGERED_MS) ?? DEFAULT_TTL_TRIGGERED_MS,
    60_000,
    24 * 60 * 60 * 1000,
  );
  const postStopWindowMs = postStopWindowMinutes * 60_000;

  const { data, error } = await supabase
    .from('spx_setup_instances')
    .select(
      [
        'engine_setup_id',
        'session_date',
        'setup_type',
        'direction',
        'regime',
        'entry_zone_low',
        'entry_zone_high',
        'stop_price',
        'target_1_price',
        'triggered_at',
        'stop_hit_at',
        'metadata',
      ].join(','),
    )
    .eq('final_outcome', 'stop_before_t1')
    .gte('session_date', from)
    .lte('session_date', to)
    .order('session_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to load stopped-out setups: ${error.message}`);
  }

  const rows = (Array.isArray(data) ? data : []) as unknown as StopHeatRow[];
  const { barsBySession, missingSessions } = await loadSessionSecondBars(rows.map((row) => row.session_date));

  const exclusionReasons = new Map<string, number>();
  const analyzed: AnalyzedStopTrade[] = [];

  for (const raw of rows) {
    const parsed = parseRow(raw);
    if (!parsed) {
      pushExclusion(exclusionReasons, 'malformed_trade_row');
      continue;
    }

    const bars = barsBySession.get(parsed.sessionDate) || [];
    if (bars.length === 0) {
      pushExclusion(exclusionReasons, 'missing_session_second_bars');
      continue;
    }

    const ttlRemainingMs = resolveTtlRemainingMs({
      metadata: parsed.metadata,
      triggeredAtMs: parsed.triggeredAtMs,
      stopHitAtMs: parsed.stopHitAtMs,
      defaultTtlTriggeredMs,
    });
    if (ttlRemainingMs == null) {
      pushExclusion(exclusionReasons, 'missing_ttl_reference');
      continue;
    }

    const analysisWindowMs = Math.min(postStopWindowMs, ttlRemainingMs);
    if (analysisWindowMs <= 0) {
      pushExclusion(exclusionReasons, 'ttl_window_elapsed');
      continue;
    }

    if (hasAmbiguousPreStopBar({ trade: parsed, bars })) {
      pushExclusion(exclusionReasons, 'ambiguous_pre_stop_bar');
      continue;
    }

    const postStopBars = getPostStopWindowBars({
      bars,
      stopHitAtMs: parsed.stopHitAtMs,
      windowMs: analysisWindowMs,
    });

    if (postStopBars.length === 0) {
      pushExclusion(exclusionReasons, 'no_post_stop_bars_within_window');
      continue;
    }

    let favorableExtreme = parsed.direction === 'bullish' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
    let adverseExtreme = parsed.direction === 'bullish' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    for (const bar of postStopBars) {
      if (parsed.direction === 'bullish') {
        favorableExtreme = Math.max(favorableExtreme, bar.h);
        adverseExtreme = Math.min(adverseExtreme, bar.l);
      } else {
        favorableExtreme = Math.min(favorableExtreme, bar.l);
        adverseExtreme = Math.max(adverseExtreme, bar.h);
      }
    }

    if (!Number.isFinite(favorableExtreme) || !Number.isFinite(adverseExtreme)) {
      pushExclusion(exclusionReasons, 'invalid_post_stop_extremes');
      continue;
    }

    const denominator = parsed.target1Price - parsed.stopPrice;
    if (!Number.isFinite(denominator) || Math.abs(denominator) <= 0.0001) {
      pushExclusion(exclusionReasons, 'invalid_stop_to_target_distance');
      continue;
    }

    const postStopT1TravelPct = ((favorableExtreme - parsed.stopPrice) / denominator) * 100;
    const distanceStopToT1Points = Math.abs(parsed.target1Price - parsed.stopPrice);
    const distanceStopToReversalPoints = Math.abs(favorableExtreme - parsed.stopPrice);
    const additionalStopPointsNeeded = parsed.direction === 'bullish'
      ? Math.max(0, parsed.stopPrice - adverseExtreme)
      : Math.max(0, adverseExtreme - parsed.stopPrice);

    const reversalTowardTarget = parsed.direction === 'bullish'
      ? favorableExtreme > parsed.stopPrice
      : favorableExtreme < parsed.stopPrice;
    const marginalStop = additionalStopPointsNeeded > 0
      && additionalStopPointsNeeded < 0.5
      && reversalTowardTarget;

    const postStopT1Reached = parsed.direction === 'bullish'
      ? favorableExtreme >= parsed.target1Price
      : favorableExtreme <= parsed.target1Price;

    const atr14 = extractAtr14(parsed.metadata);
    const stopDistancePoints = Math.abs(parsed.entryPrice - parsed.stopPrice);
    const effectiveAtrMultiplier = atr14 != null && atr14 > 0
      ? stopDistancePoints / atr14
      : null;
    const requiredAtrMultiplierToAvoid = atr14 != null && atr14 > 0
      ? (stopDistancePoints + additionalStopPointsNeeded) / atr14
      : null;

    const bucket = toBucketLabel(postStopT1TravelPct);
    const shakeout = postStopT1TravelPct >= 50;

    analyzed.push({
      engineSetupId: parsed.engineSetupId,
      sessionDate: parsed.sessionDate,
      setupType: parsed.setupType,
      direction: parsed.direction,
      regime: parsed.regime,
      entryPrice: round(parsed.entryPrice, 4),
      stopPrice: round(parsed.stopPrice, 4),
      target1Price: round(parsed.target1Price, 4),
      stopHitAt: parsed.stopHitAt,
      postStopExtreme: round(favorableExtreme, 4),
      postStopT1TravelPct: round(postStopT1TravelPct, 2),
      postStopT1Reached,
      distanceStopToT1Points: round(distanceStopToT1Points, 4),
      distanceStopToReversalPoints: round(distanceStopToReversalPoints, 4),
      additionalStopPointsNeeded: round(additionalStopPointsNeeded, 4),
      effectiveAtrMultiplier: effectiveAtrMultiplier == null ? null : round(effectiveAtrMultiplier, 4),
      requiredAtrMultiplierToAvoid: requiredAtrMultiplierToAvoid == null ? null : round(requiredAtrMultiplierToAvoid, 4),
      atr14: atr14 == null ? null : round(atr14, 4),
      marginalStop,
      shakeout,
      bucket,
    });
  }

  const sampleSize = analyzed.length;
  const shakeouts = analyzed.filter((trade) => trade.shakeout);
  const marginalStopCount = analyzed.filter((trade) => trade.marginalStop).length;

  const histogramCounts = new Map<HistogramBucketLabel, number>(
    HISTOGRAM_BUCKET_ORDER.map((label) => [label, 0]),
  );
  for (const trade of analyzed) {
    histogramCounts.set(trade.bucket, (histogramCounts.get(trade.bucket) || 0) + 1);
  }

  const histogram = HISTOGRAM_BUCKET_ORDER.map((bucket) => {
    const count = histogramCounts.get(bucket) || 0;
    return {
      bucket,
      count,
      pct: sampleSize > 0 ? round((count / sampleSize) * 100, 2) : 0,
    };
  });

  const shakeoutAdditionalPoints = shakeouts.map((trade) => trade.additionalStopPointsNeeded);
  const output2Stats = shakeoutAdditionalPoints.length > 0
    ? {
      count: shakeoutAdditionalPoints.length,
      mean: round(mean(shakeoutAdditionalPoints), 4),
      median: round(median(shakeoutAdditionalPoints), 4),
      p75: round(percentile(shakeoutAdditionalPoints, 75), 4),
      p90: round(percentile(shakeoutAdditionalPoints, 90), 4),
    }
    : {
      count: 0,
      mean: null,
      median: null,
      p75: null,
      p90: null,
    };

  const regimeRates = REGIME_ORDER.map((regime) => {
    const regimeRows = analyzed.filter((row) => row.regime === regime);
    const regimeShakeouts = regimeRows.filter((row) => row.shakeout);
    const regimeAdditional = regimeShakeouts.map((row) => row.additionalStopPointsNeeded);
    return {
      regime,
      totalStops: regimeRows.length,
      shakeouts: regimeShakeouts.length,
      shakeoutRatePct: regimeRows.length > 0 ? round((regimeShakeouts.length / regimeRows.length) * 100, 2) : 0,
      medianAdditionalPointsNeeded: regimeAdditional.length > 0 ? round(median(regimeAdditional), 4) : null,
    };
  });

  const shakeoutsWithAtr = shakeouts.filter(hasRequiredMultiplier);
  const sensitivityCurve: Array<{ multiplier: number; avoidedPct: number }> = [];
  for (let step = 5; step <= 30; step += 1) {
    const multiplier = step / 10;
    const avoidedCount = shakeoutsWithAtr.filter(
      (trade) => trade.requiredAtrMultiplierToAvoid <= multiplier,
    ).length;
    sensitivityCurve.push({
      multiplier: round(multiplier, 1),
      avoidedPct: shakeoutsWithAtr.length > 0 ? round((avoidedCount / shakeoutsWithAtr.length) * 100, 2) : 0,
    });
  }

  const atrAvailableCount = analyzed.filter((trade) => trade.atr14 != null).length;
  const exclusionsTotal = Array.from(exclusionReasons.values()).reduce((sum, count) => sum + count, 0);

  const output = {
    summary: {
      generatedAt: new Date().toISOString(),
      dateRange: { from, to },
      config: {
        postStopWindowMinutes,
        ttlTriggeredMinutesDefault: round(defaultTtlTriggeredMs / 60_000, 2),
      },
      totals: {
        totalStoppedTrades: rows.length,
        exclusions: exclusionsTotal,
        analysisSampleSize: sampleSize,
      },
      sampleSizePerRegime: buildSessionRegimeSummary(analyzed),
      exclusionsByReason: Object.fromEntries(
        Array.from(exclusionReasons.entries()).sort((a, b) => b[1] - a[1]),
      ),
      dataQuality: {
        missingSecondBarSessions: missingSessions,
        atrAvailableCount,
        atrMissingCount: sampleSize - atrAvailableCount,
      },
      marginalStops: {
        count: marginalStopCount,
        pctOfSample: sampleSize > 0 ? round((marginalStopCount / sampleSize) * 100, 2) : 0,
      },
    },
    output1ShakeoutHistogram: {
      buckets: histogram,
      sampleSize,
    },
    output2MinimumAdditionalStopDistance: {
      shakeoutDefinition: 'post_stop_t1_travel_pct >= 50',
      stats: output2Stats,
    },
    output3RegimeStratifiedShakeoutRates: regimeRates,
    output4AtrMultiplierSensitivityCurve: {
      shakeoutSampleSize: shakeouts.length,
      atrQualifiedShakeoutSampleSize: shakeoutsWithAtr.length,
      curve: sensitivityCurve,
    },
  };

  console.log(JSON.stringify(output, null, 2));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`SPX stop heat analysis failed: ${message}`);
  process.exit(1);
});
