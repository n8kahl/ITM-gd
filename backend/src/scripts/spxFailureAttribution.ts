import { supabase } from '../config/database';
import { getActiveSPXOptimizationProfile } from '../services/spx/optimizer';
import { toEasternTime } from '../services/marketHours';

type Outcome = 't2_before_stop' | 't1_before_stop' | 'stop_before_t1' | 'expired_unresolved' | 'invalidated_other' | null;

interface SetupInstanceRow {
  setup_type: string;
  session_date: string;
  regime: string | null;
  tier: string | null;
  first_seen_at: string | null;
  triggered_at: string | null;
  final_outcome: Outcome;
  metadata: Record<string, unknown> | null;
}

interface BucketStats {
  key: string;
  total: number;
  stops: number;
  t1Wins: number;
  t2Wins: number;
}

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function minuteSinceOpenEt(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  const et = toEasternTime(new Date(ms));
  return Math.max(0, (et.hour * 60 + et.minute) - (9 * 60 + 30));
}

function minuteBucket(minute: number | null): string {
  if (minute == null) return 'unknown';
  if (minute < 60) return '00-59';
  if (minute < 120) return '60-119';
  if (minute < 180) return '120-179';
  if (minute < 240) return '180-239';
  return '240+';
}

function confluenceBucket(score: number | null): string {
  if (score == null) return 'unknown';
  if (score <= 2) return '<=2';
  if (score === 3) return '3';
  if (score === 4) return '4';
  return '5+';
}

function alignmentBucket(score: number | null): string {
  if (score == null) return 'unknown';
  if (score < 45) return '<45';
  if (score < 55) return '45-54';
  if (score < 70) return '55-69';
  return '70+';
}

function parseMetadataValue<T>(metadata: Record<string, unknown> | null, key: string, fallback: T): T {
  const value = metadata?.[key];
  return (value as T) ?? fallback;
}

function parseMetadataNumber(metadata: Record<string, unknown> | null, key: string): number | null {
  const value = metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseFlowQualityMetric(
  metadata: Record<string, unknown> | null,
  key: 'score' | 'recentDirectionalEvents' | 'recentDirectionalPremium' | 'localDirectionalEvents' | 'localDirectionalPremium' | 'localCoveragePct',
): number | null {
  const directKeyByMetric: Record<typeof key, string> = {
    score: 'flowQualityScore',
    recentDirectionalEvents: 'flowRecentDirectionalEvents',
    recentDirectionalPremium: 'flowRecentDirectionalPremium',
    localDirectionalEvents: 'flowLocalDirectionalEvents',
    localDirectionalPremium: 'flowLocalDirectionalPremium',
    localCoveragePct: 'flowLocalCoveragePct',
  };
  const direct = parseMetadataNumber(metadata, directKeyByMetric[key]);
  if (direct != null) return direct;
  const flowQuality = metadata?.flowQuality;
  if (!flowQuality || typeof flowQuality !== 'object' || Array.isArray(flowQuality)) return null;
  const nested = (flowQuality as Record<string, unknown>)[key];
  return typeof nested === 'number' && Number.isFinite(nested) ? nested : null;
}

function upsertBucket(map: Map<string, BucketStats>, key: string, outcome: Outcome): void {
  const current = map.get(key) || { key, total: 0, stops: 0, t1Wins: 0, t2Wins: 0 };
  current.total += 1;
  if (outcome === 'stop_before_t1') current.stops += 1;
  if (outcome === 't1_before_stop' || outcome === 't2_before_stop') current.t1Wins += 1;
  if (outcome === 't2_before_stop') current.t2Wins += 1;
  map.set(key, current);
}

function sortBuckets(map: Map<string, BucketStats>, minimumTrades = 5): Array<BucketStats & {
  stopRatePct: number;
  t1WinRatePct: number;
  t2WinRatePct: number;
}> {
  return Array.from(map.values())
    .filter((bucket) => bucket.total >= minimumTrades)
    .map((bucket) => ({
      ...bucket,
      stopRatePct: round((bucket.stops / bucket.total) * 100, 2),
      t1WinRatePct: round((bucket.t1Wins / bucket.total) * 100, 2),
      t2WinRatePct: round((bucket.t2Wins / bucket.total) * 100, 2),
    }))
    .sort((a, b) => {
      if (b.stopRatePct !== a.stopRatePct) return b.stopRatePct - a.stopRatePct;
      return b.total - a.total;
    });
}

async function main() {
  const from = (process.argv[2] || '2026-01-02').trim();
  const to = (process.argv[3] || '2026-02-20').trim();
  const setupTypesFilter = (process.argv[4] || 'trend_pullback,orb_breakout,mean_reversion,fade_at_wall')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const profile = await getActiveSPXOptimizationProfile();
  const paused = new Set(profile.driftControl.pausedSetupTypes);

  const { data, error } = await supabase
    .from('spx_setup_instances')
    .select('setup_type,session_date,regime,tier,first_seen_at,triggered_at,final_outcome,metadata')
    .gte('session_date', from)
    .lte('session_date', to)
    .order('session_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to load setup instances: ${error.message}`);
  }

  const rows = ((data || []) as SetupInstanceRow[])
    .filter((row) => setupTypesFilter.includes(row.setup_type));

  const strictTriggered = rows.filter((row) => {
    if (!row.triggered_at || !row.final_outcome) return false;
    if (paused.has(row.setup_type)) return false;
    const gateStatus = parseMetadataValue<string | null>(row.metadata, 'gateStatus', null);
    if (row.tier === 'hidden' && gateStatus !== 'eligible') return false;
    return gateStatus === 'eligible';
  });

  // --- P15-S1: Full-population blocker analysis (all rows, not just strict triggered) ---
  const gateReasonCounter = new Map<string, number>();
  const setupTypeBlockerCounter = new Map<string, Map<string, number>>();
  const multiBlockerCombos = new Map<string, number>();
  const flowAvailabilityByDate = new Map<string, {
    total: number;
    flowAvailable: number;
    flowSparse: number;
    flowUnavailable: number;
    flowConfirmed: number;
    effectiveFlowConfirmed: number;
    totalDirectionalEvents: number;
    totalDirectionalPremium: number;
  }>();
  const tierStatusSummary = { total: rows.length, blocked: 0, eligible: 0, hidden: 0, triggered: 0, noGateStatus: 0 };

  for (const row of rows) {
    const gateStatus = parseMetadataValue<string | null>(row.metadata, 'gateStatus', null);
    const gateReasonsRaw = parseMetadataValue<string[] | null>(row.metadata, 'gateReasons', null);
    const flowAlignmentRaw = parseMetadataNumber(row.metadata, 'flowAlignmentPct');
    const flowConfirmedVal = parseMetadataValue<boolean>(row.metadata, 'flowConfirmed', false);
    const effectiveFlowConfirmedVal = parseMetadataValue<boolean>(row.metadata, 'effectiveFlowConfirmed', flowConfirmedVal);
    const directionalEvents = parseFlowQualityMetric(row.metadata, 'recentDirectionalEvents') ?? 0;
    const directionalPremium = parseFlowQualityMetric(row.metadata, 'recentDirectionalPremium') ?? 0;
    const flowAvailabilityRaw = parseMetadataValue<string | null>(row.metadata, 'flowAvailability', null);
    const flowAvailability = (
      flowAvailabilityRaw === 'available'
      || flowAvailabilityRaw === 'sparse'
      || flowAvailabilityRaw === 'unavailable'
    )
      ? flowAvailabilityRaw
      : (typeof flowAlignmentRaw === 'number'
        ? 'available'
        : (directionalEvents > 0 || directionalPremium > 0 ? 'sparse' : 'unavailable'));

    if (gateStatus === 'blocked') tierStatusSummary.blocked += 1;
    else if (gateStatus === 'eligible') tierStatusSummary.eligible += 1;
    else tierStatusSummary.noGateStatus += 1;
    if (row.tier === 'hidden') tierStatusSummary.hidden += 1;
    if (row.triggered_at) tierStatusSummary.triggered += 1;

    // Per-reason counting
    const reasons = Array.isArray(gateReasonsRaw) ? gateReasonsRaw : [];
    const normalizedReasons: string[] = [];
    for (const reason of reasons) {
      const normalized = reason.includes(':') ? reason.split(':')[0] : reason;
      normalizedReasons.push(normalized);
      gateReasonCounter.set(normalized, (gateReasonCounter.get(normalized) || 0) + 1);

      // Per-setup-type x per-blocker
      if (!setupTypeBlockerCounter.has(row.setup_type)) {
        setupTypeBlockerCounter.set(row.setup_type, new Map());
      }
      const typeMap = setupTypeBlockerCounter.get(row.setup_type)!;
      typeMap.set(normalized, (typeMap.get(normalized) || 0) + 1);
    }

    // Multi-blocker overlap
    if (normalizedReasons.length > 0) {
      const comboKey = normalizedReasons.sort().join(' + ');
      multiBlockerCombos.set(comboKey, (multiBlockerCombos.get(comboKey) || 0) + 1);
    }

    // Flow data availability by date
    const date = row.session_date;
    if (!flowAvailabilityByDate.has(date)) {
      flowAvailabilityByDate.set(date, {
        total: 0,
        flowAvailable: 0,
        flowSparse: 0,
        flowUnavailable: 0,
        flowConfirmed: 0,
        effectiveFlowConfirmed: 0,
        totalDirectionalEvents: 0,
        totalDirectionalPremium: 0,
      });
    }
    const dateStats = flowAvailabilityByDate.get(date)!;
    dateStats.total += 1;
    if (flowAvailability === 'available') dateStats.flowAvailable += 1;
    if (flowAvailability === 'sparse') dateStats.flowSparse += 1;
    if (flowAvailability === 'unavailable') dateStats.flowUnavailable += 1;
    if (flowConfirmedVal) dateStats.flowConfirmed += 1;
    if (effectiveFlowConfirmedVal) dateStats.effectiveFlowConfirmed += 1;
    dateStats.totalDirectionalEvents += directionalEvents;
    dateStats.totalDirectionalPremium += directionalPremium;
  }

  // Format blocker analysis results
  const topBlockers = Array.from(gateReasonCounter.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => ({ reason, count, pctOfTotal: round((count / rows.length) * 100) }));

  const blockersBySetupType: Record<string, Array<{ reason: string; count: number }>> = {};
  for (const [setupType, blockerMap] of setupTypeBlockerCounter) {
    blockersBySetupType[setupType] = Array.from(blockerMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([reason, count]) => ({ reason, count }));
  }

  const topMultiBlockerCombos = Array.from(multiBlockerCombos.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([combo, count]) => ({ combo, count }));

  const flowAvailabilityByDateSorted = Array.from(flowAvailabilityByDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, stats]) => ({
      date,
      rows: stats.total,
      flowAvailablePct: round(stats.total > 0 ? (stats.flowAvailable / stats.total) * 100 : 0),
      flowSparsePct: round(stats.total > 0 ? (stats.flowSparse / stats.total) * 100 : 0),
      flowUnavailablePct: round(stats.total > 0 ? (stats.flowUnavailable / stats.total) * 100 : 0),
      flowConfirmedPct: round(stats.total > 0 ? (stats.flowConfirmed / stats.total) * 100 : 0),
      effectiveFlowConfirmedPct: round(stats.total > 0 ? (stats.effectiveFlowConfirmed / stats.total) * 100 : 0),
      avgDirectionalEvents: round(stats.total > 0 ? stats.totalDirectionalEvents / stats.total : 0),
      avgDirectionalPremium: round(stats.total > 0 ? stats.totalDirectionalPremium / stats.total : 0),
    }));

  // --- Original strict-triggered analysis ---
  const bySetup = new Map<string, BucketStats>();
  const byRegime = new Map<string, BucketStats>();
  const byFirstSeenBucket = new Map<string, BucketStats>();
  const byTriggerBucket = new Map<string, BucketStats>();
  const byConfluence = new Map<string, BucketStats>();
  const byFlowAlignment = new Map<string, BucketStats>();
  const byFlowConfirmed = new Map<string, BucketStats>();
  const byEffectiveFlowConfirmed = new Map<string, BucketStats>();
  const byFlowAvailability = new Map<string, BucketStats>();
  const byEmaAligned = new Map<string, BucketStats>();
  const byVolumeAligned = new Map<string, BucketStats>();

  for (const row of strictTriggered) {
    const outcome = row.final_outcome;
    const firstSeenMinute = minuteSinceOpenEt(row.first_seen_at);
    const triggerMinute = minuteSinceOpenEt(row.triggered_at);
    const confluenceScoreRaw = parseMetadataValue<number | null>(row.metadata, 'confluenceScore', null);
    const confluenceScore = typeof confluenceScoreRaw === 'number' ? confluenceScoreRaw : null;
    const flowAlignmentRaw = parseMetadataNumber(row.metadata, 'flowAlignmentPct');
    const flowAlignment = typeof flowAlignmentRaw === 'number' ? flowAlignmentRaw : null;
    const flowConfirmed = parseMetadataValue<boolean>(row.metadata, 'flowConfirmed', false);
    const effectiveFlowConfirmed = parseMetadataValue<boolean>(row.metadata, 'effectiveFlowConfirmed', flowConfirmed);
    const directionalEvents = parseFlowQualityMetric(row.metadata, 'recentDirectionalEvents') ?? 0;
    const directionalPremium = parseFlowQualityMetric(row.metadata, 'recentDirectionalPremium') ?? 0;
    const flowAvailabilityRaw = parseMetadataValue<string | null>(row.metadata, 'flowAvailability', null);
    const flowAvailability = (
      flowAvailabilityRaw === 'available'
      || flowAvailabilityRaw === 'sparse'
      || flowAvailabilityRaw === 'unavailable'
    )
      ? flowAvailabilityRaw
      : (flowAlignment != null
        ? 'available'
        : (directionalEvents > 0 || directionalPremium > 0 ? 'sparse' : 'unavailable'));
    const emaAligned = parseMetadataValue<boolean>(row.metadata, 'emaAligned', false);
    const volumeAligned = parseMetadataValue<boolean>(
      row.metadata,
      'effectiveVolumeAligned',
      parseMetadataValue<boolean>(row.metadata, 'volumeRegimeAligned', false),
    );

    upsertBucket(bySetup, row.setup_type, outcome);
    upsertBucket(byRegime, row.regime || 'unknown', outcome);
    upsertBucket(byFirstSeenBucket, minuteBucket(firstSeenMinute), outcome);
    upsertBucket(byTriggerBucket, minuteBucket(triggerMinute), outcome);
    upsertBucket(byConfluence, confluenceBucket(confluenceScore), outcome);
    upsertBucket(byFlowAlignment, alignmentBucket(flowAlignment), outcome);
    upsertBucket(byFlowConfirmed, flowConfirmed ? 'true' : 'false', outcome);
    upsertBucket(byEffectiveFlowConfirmed, effectiveFlowConfirmed ? 'true' : 'false', outcome);
    upsertBucket(byFlowAvailability, flowAvailability, outcome);
    upsertBucket(byEmaAligned, emaAligned ? 'true' : 'false', outcome);
    upsertBucket(byVolumeAligned, volumeAligned ? 'true' : 'false', outcome);
  }

  const result = {
    range: { from, to },
    setupTypes: setupTypesFilter,
    pausedSetupTypes: Array.from(paused),
    // P15-S1 blocker analysis (full population)
    population: tierStatusSummary,
    topBlockers,
    blockersBySetupType,
    topMultiBlockerCombos,
    flowAvailabilityByDate: flowAvailabilityByDateSorted,
    // Original strict-triggered analysis
    strictTriggeredCount: strictTriggered.length,
    summaryBySetup: sortBuckets(bySetup, 1),
    topFailureDrivers: {
      regime: sortBuckets(byRegime).slice(0, 8),
      firstSeenMinuteBucket: sortBuckets(byFirstSeenBucket).slice(0, 8),
      triggerMinuteBucket: sortBuckets(byTriggerBucket).slice(0, 8),
      confluenceBucket: sortBuckets(byConfluence).slice(0, 8),
      flowAlignmentBucket: sortBuckets(byFlowAlignment).slice(0, 8),
      flowConfirmed: sortBuckets(byFlowConfirmed, 1),
      effectiveFlowConfirmed: sortBuckets(byEffectiveFlowConfirmed, 1),
      flowAvailability: sortBuckets(byFlowAvailability, 1),
      emaAligned: sortBuckets(byEmaAligned, 1),
      volumeRegimeAligned: sortBuckets(byVolumeAligned, 1),
    },
  };

  console.log(JSON.stringify(result, null, 2));
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`SPX failure attribution failed: ${message}`);
  process.exit(1);
});
