import { supabase } from '../config/database';
import { toEasternTime } from '../services/marketHours';
import { getActiveSPXOptimizationProfile } from '../services/spx/optimizer';
import {
  persistBacktestRowsForWinRate,
  type SetupFinalOutcome,
} from '../services/spx/outcomeTracker';
import { runSPXWinRateBacktest } from '../services/spx/winRateBacktest';

type SupportedGateStatus = 'eligible' | 'shadow_blocked';

interface SetupInstanceAnalysisRow {
  engine_setup_id: string;
  session_date: string;
  triggered_at: string | null;
  final_outcome: SetupFinalOutcome | null;
  realized_r: number | string | null;
  metadata: Record<string, unknown> | null;
}

interface GateReasonAccumulator {
  blockedCount: number;
  resolvedCount: number;
  t1Wins: number;
  realizedRValues: number[];
}

interface CohortMetrics {
  setupCount: number;
  triggeredCount: number;
  resolvedCount: number;
  t1Wins: number;
  t2Wins: number;
  stopsBeforeT1: number;
  t1WinRatePct: number;
  t2WinRatePct: number;
  stopRatePct: number;
  avgRealizedR: number | null;
  expectancyR: number | null;
}

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

function toMetadataRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isT1Win(outcome: SetupFinalOutcome | null): boolean {
  return outcome === 't1_before_stop' || outcome === 't2_before_stop';
}

function normalizeGateReason(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return '';
  const delimiter = trimmed.indexOf(':');
  return delimiter === -1 ? trimmed : trimmed.slice(0, delimiter);
}

function parseGateReasons(metadata: Record<string, unknown> | null): string[] {
  const raw = metadata?.gateReasons;
  if (!Array.isArray(raw)) return [];

  return Array.from(new Set(
    raw
      .filter((value): value is string => typeof value === 'string')
      .map((reason) => normalizeGateReason(reason))
      .filter((reason) => reason.length > 0),
  ));
}

async function loadShadowBounds(): Promise<{ from: string; to: string } | null> {
  const [earliest, latest] = await Promise.all([
    supabase
      .from('spx_setup_instances')
      .select('session_date')
      .contains('metadata', { gateStatus: 'shadow_blocked' })
      .order('session_date', { ascending: true })
      .limit(1),
    supabase
      .from('spx_setup_instances')
      .select('session_date')
      .contains('metadata', { gateStatus: 'shadow_blocked' })
      .order('session_date', { ascending: false })
      .limit(1),
  ]);

  if (earliest.error) {
    throw new Error(`Failed to load earliest shadow setup date: ${earliest.error.message}`);
  }
  if (latest.error) {
    throw new Error(`Failed to load latest shadow setup date: ${latest.error.message}`);
  }

  const firstDate = Array.isArray(earliest.data) ? earliest.data[0]?.session_date : null;
  const lastDate = Array.isArray(latest.data) ? latest.data[0]?.session_date : null;

  if (typeof firstDate !== 'string' || typeof lastDate !== 'string') {
    return null;
  }

  return { from: firstDate, to: lastDate };
}

async function loadRowsByGateStatus(input: {
  from: string;
  to: string;
  gateStatus: SupportedGateStatus;
}): Promise<SetupInstanceAnalysisRow[]> {
  const { data, error } = await supabase
    .from('spx_setup_instances')
    .select([
      'engine_setup_id',
      'session_date',
      'triggered_at',
      'final_outcome',
      'realized_r',
      'metadata',
    ].join(','))
    .contains('metadata', { gateStatus: input.gateStatus })
    .gte('session_date', input.from)
    .lte('session_date', input.to)
    .order('session_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to load ${input.gateStatus} setups: ${error.message}`);
  }

  return (Array.isArray(data) ? data : []) as unknown as SetupInstanceAnalysisRow[];
}

function buildOutcomeDistribution(rows: SetupInstanceAnalysisRow[]): Array<{
  finalOutcome: SetupFinalOutcome;
  count: number;
  avgRealizedR: number | null;
}> {
  const map = new Map<SetupFinalOutcome, { count: number; realized: number[] }>();
  for (const row of rows) {
    if (!row.final_outcome) continue;
    const current = map.get(row.final_outcome) || { count: 0, realized: [] };
    current.count += 1;
    const realizedR = toFiniteNumber(row.realized_r);
    if (realizedR != null) current.realized.push(realizedR);
    map.set(row.final_outcome, current);
  }

  return Array.from(map.entries())
    .map(([finalOutcome, stats]) => {
      const avgRealized = mean(stats.realized);
      return {
        finalOutcome,
        count: stats.count,
        avgRealizedR: avgRealized == null ? null : round(avgRealized, 4),
      };
    })
    .sort((a, b) => b.count - a.count || a.finalOutcome.localeCompare(b.finalOutcome));
}

function buildGateReasonEffectiveness(rows: SetupInstanceAnalysisRow[]): Array<{
  gateReason: string;
  blockedSetups: number;
  resolvedSetups: number;
  t1Wins: number;
  t1WinRatePct: number | null;
  avgRealizedR: number | null;
  flaggedOver60PctT1WinRate: boolean;
}> {
  const byReason = new Map<string, GateReasonAccumulator>();

  for (const row of rows) {
    const metadata = toMetadataRecord(row.metadata);
    const reasons = parseGateReasons(metadata);
    if (reasons.length === 0) continue;

    const resolved = row.final_outcome != null;
    const t1Win = isT1Win(row.final_outcome);
    const realizedR = toFiniteNumber(row.realized_r);

    for (const reason of reasons) {
      const current = byReason.get(reason) || {
        blockedCount: 0,
        resolvedCount: 0,
        t1Wins: 0,
        realizedRValues: [],
      };
      current.blockedCount += 1;

      if (resolved) {
        current.resolvedCount += 1;
        if (t1Win) current.t1Wins += 1;
        if (realizedR != null) current.realizedRValues.push(realizedR);
      }

      byReason.set(reason, current);
    }
  }

  return Array.from(byReason.entries())
    .map(([gateReason, stats]) => {
      const t1WinRatePct = stats.resolvedCount > 0
        ? round((stats.t1Wins / stats.resolvedCount) * 100, 2)
        : null;
      const avgRealized = mean(stats.realizedRValues);
      return {
        gateReason,
        blockedSetups: stats.blockedCount,
        resolvedSetups: stats.resolvedCount,
        t1Wins: stats.t1Wins,
        t1WinRatePct,
        avgRealizedR: avgRealized == null ? null : round(avgRealized, 4),
        flaggedOver60PctT1WinRate: t1WinRatePct != null && t1WinRatePct > 60,
      };
    })
    .sort((a, b) => {
      if (a.flaggedOver60PctT1WinRate !== b.flaggedOver60PctT1WinRate) {
        return a.flaggedOver60PctT1WinRate ? -1 : 1;
      }
      if (b.blockedSetups !== a.blockedSetups) return b.blockedSetups - a.blockedSetups;
      return (b.t1WinRatePct || 0) - (a.t1WinRatePct || 0);
    });
}

function buildCohortMetrics(rows: SetupInstanceAnalysisRow[]): CohortMetrics {
  const triggered = rows.filter((row) => typeof row.triggered_at === 'string' && row.triggered_at.length > 0);
  const resolved = triggered.filter((row) => row.final_outcome != null);
  const t1Wins = resolved.filter((row) => isT1Win(row.final_outcome)).length;
  const t2Wins = resolved.filter((row) => row.final_outcome === 't2_before_stop').length;
  const stopsBeforeT1 = resolved.filter((row) => row.final_outcome === 'stop_before_t1').length;

  const realizedValues = resolved
    .map((row) => toFiniteNumber(row.realized_r))
    .filter((value): value is number => value != null);
  const avgRealized = mean(realizedValues);

  return {
    setupCount: rows.length,
    triggeredCount: triggered.length,
    resolvedCount: resolved.length,
    t1Wins,
    t2Wins,
    stopsBeforeT1,
    t1WinRatePct: resolved.length > 0 ? round((t1Wins / resolved.length) * 100, 2) : 0,
    t2WinRatePct: resolved.length > 0 ? round((t2Wins / resolved.length) * 100, 2) : 0,
    stopRatePct: resolved.length > 0 ? round((stopsBeforeT1 / resolved.length) * 100, 2) : 0,
    avgRealizedR: avgRealized == null ? null : round(avgRealized, 4),
    expectancyR: avgRealized == null ? null : round(avgRealized, 4),
  };
}

function buildComparisonDelta(production: CohortMetrics, shadow: CohortMetrics): Record<string, number | null> {
  const delta = (shadowValue: number | null, productionValue: number | null, decimals = 2): number | null => {
    if (shadowValue == null || productionValue == null) return null;
    return round(shadowValue - productionValue, decimals);
  };

  return {
    t1WinRatePct: delta(shadow.t1WinRatePct, production.t1WinRatePct, 2),
    t2WinRatePct: delta(shadow.t2WinRatePct, production.t2WinRatePct, 2),
    stopRatePct: delta(shadow.stopRatePct, production.stopRatePct, 2),
    avgRealizedR: delta(shadow.avgRealizedR, production.avgRealizedR, 4),
    expectancyR: delta(shadow.expectancyR, production.expectancyR, 4),
  };
}

async function main() {
  const fromArg = parseArg('from');
  const toArg = parseArg('to');

  if (fromArg && !isIsoDate(fromArg)) {
    throw new Error('Invalid --from date format. Use YYYY-MM-DD.');
  }
  if (toArg && !isIsoDate(toArg)) {
    throw new Error('Invalid --to date format. Use YYYY-MM-DD.');
  }

  const defaults = defaultDateRangeEt();
  const shadowBounds = await loadShadowBounds();
  const from = fromArg || shadowBounds?.from || defaults.from;
  const to = toArg || shadowBounds?.to || defaults.to;

  if (from > to) {
    throw new Error(`Invalid date range: from ${from} is after to ${to}.`);
  }

  const shadowSeedRows = await loadRowsByGateStatus({
    from,
    to,
    gateStatus: 'shadow_blocked',
  });

  if (shadowSeedRows.length === 0) {
    console.log(JSON.stringify({
      mode: 'shadow_gate_analysis',
      generatedAt: new Date().toISOString(),
      dateRange: { from, to },
      notes: ['No shadow-blocked setups found in the requested date range.'],
      query1ShadowOutcomeDistribution: [],
      query2GateReasonEffectiveness: {
        flaggedGateReasons: [],
        reasons: [],
      },
      query3ProductionVsShadowComparison: {
        production: null,
        shadow: null,
        delta: null,
      },
    }, null, 2));
    return;
  }

  const optimizerProfile = await getActiveSPXOptimizationProfile();
  const backtest = await runSPXWinRateBacktest({
    from,
    to,
    source: 'spx_setup_instances',
    resolution: 'second',
    includeRows: true,
    includeBlockedSetups: true,
    includePausedSetups: true,
    includeHiddenTiers: true,
    executionModel: {
      partialAtT1Pct: optimizerProfile.tradeManagement.partialAtT1Pct,
      moveStopToBreakevenAfterT1: optimizerProfile.tradeManagement.moveStopToBreakeven,
    },
  });
  const backtestRows = backtest.rows || [];
  if (backtestRows.length > 0) {
    await persistBacktestRowsForWinRate(backtestRows);
  }

  const [shadowRows, productionRows] = await Promise.all([
    loadRowsByGateStatus({ from, to, gateStatus: 'shadow_blocked' }),
    loadRowsByGateStatus({ from, to, gateStatus: 'eligible' }),
  ]);

  const query1ShadowOutcomeDistribution = buildOutcomeDistribution(
    shadowRows.filter((row) => row.final_outcome != null),
  );
  const gateReasonEffectiveness = buildGateReasonEffectiveness(shadowRows);
  const flaggedGateReasons = gateReasonEffectiveness
    .filter((reason) => reason.flaggedOver60PctT1WinRate)
    .map((reason) => reason.gateReason);

  const productionMetrics = buildCohortMetrics(productionRows);
  const shadowMetrics = buildCohortMetrics(shadowRows);

  console.log(JSON.stringify({
    mode: 'shadow_gate_analysis',
    generatedAt: new Date().toISOString(),
    dateRange: { from, to },
    backtest: {
      setupCount: backtest.setupCount,
      evaluatedSetupCount: backtest.evaluatedSetupCount,
      skippedSetupCount: backtest.skippedSetupCount,
      resolutionUsed: backtest.resolutionUsed,
      persistedRows: backtestRows.length,
    },
    samples: {
      shadowBlocked: shadowRows.length,
      productionEligible: productionRows.length,
    },
    query1ShadowOutcomeDistribution,
    query2GateReasonEffectiveness: {
      thresholdPct: 60,
      flaggedGateReasons,
      reasons: gateReasonEffectiveness,
    },
    query3ProductionVsShadowComparison: {
      production: productionMetrics,
      shadow: shadowMetrics,
      deltaShadowMinusProduction: buildComparisonDelta(productionMetrics, shadowMetrics),
    },
  }, null, 2));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`SPX shadow gate analysis failed: ${message}`);
  process.exit(1);
});
