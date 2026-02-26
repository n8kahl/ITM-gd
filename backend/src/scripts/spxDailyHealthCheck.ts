import { supabase } from '../config/database';

type CheckStatus = 'PASS' | 'WARN' | 'FAIL' | 'INFO';

type CheckResult = {
  status: CheckStatus;
  details: Record<string, unknown>;
};

interface SetupInstanceRow {
  setup_type: string | null;
  p_win_calibrated: number | string | null;
  final_outcome: string | null;
  realized_r: number | string | null;
  metadata: unknown;
}

interface NormalizedSetupRow {
  setupType: string;
  pWinCalibrated: number | null;
  finalOutcome: string | null;
  realizedR: number | null;
  metadata: Record<string, unknown>;
}

const METADATA_THRESHOLD_PCT = 90;
const OPTIMIZER_EXPECTED_MIN_PWIN = 0.58;
const GATE_ELIGIBLE_MIN_PCT = 5;
const GATE_ELIGIBLE_MAX_PCT = 50;
const SCORE5_MAX_AVG_PWIN = 0.65;

const REGULAR_SESSION_MIN_BARS = 300;
const REGULAR_SESSION_MAX_BARS = 390;
const HARD_MIN_BARS = 200;
const HARD_MAX_BARS = 450;

const ET_SESSION_OPEN_MINUTE = 9 * 60 + 30;
const ET_SESSION_CLOSE_MINUTE = 16 * 60;
const ET_AFTER_CLOSE_GUARD_MINUTE = 16 * 60 + 15;
const ET_WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const ET_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});

const MARKET_CLOSED_HOLIDAYS = new Set<string>([
  '2025-01-01',
  '2025-01-20',
  '2025-02-17',
  '2025-04-18',
  '2025-05-26',
  '2025-06-19',
  '2025-07-04',
  '2025-09-01',
  '2025-11-27',
  '2025-12-25',
  '2026-01-01',
  '2026-01-19',
  '2026-02-16',
  '2026-04-03',
  '2026-05-25',
  '2026-06-19',
  '2026-07-03',
  '2026-09-07',
  '2026-11-26',
  '2026-12-25',
  '2027-01-01',
  '2027-01-18',
  '2027-02-15',
  '2027-03-26',
  '2027-05-31',
  '2027-06-18',
  '2027-07-05',
  '2027-09-06',
  '2027-11-25',
  '2027-12-24',
  '2028-01-03',
  '2028-01-17',
  '2028-02-21',
  '2028-04-14',
  '2028-05-29',
  '2028-06-19',
  '2028-07-04',
  '2028-09-04',
  '2028-11-23',
  '2028-12-25',
]);

function parseArgs(argv: string[]): { dateArg: string | null; verbose: boolean } {
  let dateArg: string | null = null;
  let verbose = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--verbose') {
      verbose = true;
      continue;
    }
    if (arg.startsWith('--date=')) {
      dateArg = arg.slice('--date='.length).trim();
      continue;
    }
    if (arg === '--date') {
      const next = argv[index + 1];
      if (next && !next.startsWith('--')) {
        dateArg = next.trim();
        index += 1;
      }
    }
  }

  return { dateArg, verbose };
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function round(value: number, decimals = 2): number {
  return Number(value.toFixed(decimals));
}

function percentage(part: number, total: number, decimals = 1): number {
  if (total <= 0) return 0;
  return round((part / total) * 100, decimals);
}

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T12:00:00.000Z`);
  return Number.isFinite(parsed);
}

function shiftUtcDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toEasternTime(date: Date): { hour: number; minute: number; dayOfWeek: number; dateStr: string } {
  const parts = ET_FORMATTER.formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = Number.parseInt(byType.hour || '0', 10);
  const minute = Number.parseInt(byType.minute || '0', 10);
  const month = byType.month || '01';
  const day = byType.day || '01';
  const year = byType.year || '1970';
  const weekday = byType.weekday || 'Sun';

  return {
    hour,
    minute,
    dayOfWeek: ET_WEEKDAY_TO_INDEX[weekday] ?? 0,
    dateStr: `${year}-${month}-${day}`,
  };
}

function isTradingDate(dateStr: string): boolean {
  const dayOfWeek = new Date(`${dateStr}T12:00:00.000Z`).getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  return !MARKET_CLOSED_HOLIDAYS.has(dateStr);
}

function previousTradingDate(dateStr: string): string {
  let cursor = shiftUtcDays(dateStr, -1);
  while (!isTradingDate(cursor)) {
    cursor = shiftUtcDays(cursor, -1);
  }
  return cursor;
}

function resolveSessionDate(dateArg: string | null): string {
  if (dateArg) {
    if (!isDateOnly(dateArg)) {
      throw new Error(`Invalid --date value "${dateArg}". Expected YYYY-MM-DD.`);
    }
    return dateArg;
  }

  const now = new Date();
  const etNow = toEasternTime(now);
  const nowMinuteEt = etNow.hour * 60 + etNow.minute;

  if (isTradingDate(etNow.dateStr) && nowMinuteEt >= ET_AFTER_CLOSE_GUARD_MINUTE) {
    return etNow.dateStr;
  }

  return previousTradingDate(etNow.dateStr);
}

async function loadSetupRows(sessionDate: string): Promise<NormalizedSetupRow[]> {
  const { data, error } = await supabase
    .from('spx_setup_instances')
    .select('setup_type,p_win_calibrated,final_outcome,realized_r,metadata')
    .eq('session_date', sessionDate);

  if (error) {
    throw new Error(`Failed to load spx_setup_instances for ${sessionDate}: ${error.message}`);
  }

  const rows = (data || []) as SetupInstanceRow[];
  return rows.map((row) => ({
    setupType: typeof row.setup_type === 'string' && row.setup_type.length > 0 ? row.setup_type : 'unknown',
    pWinCalibrated: toFiniteNumber(row.p_win_calibrated),
    finalOutcome: typeof row.final_outcome === 'string' ? row.final_outcome : null,
    realizedR: toFiniteNumber(row.realized_r),
    metadata: toRecord(row.metadata),
  }));
}

function runMetadataCompletenessCheck(rows: NormalizedSetupRow[], verbose: boolean): CheckResult {
  const checks: Array<{ key: string; test: (metadata: Record<string, unknown>) => boolean }> = [
    { key: 'confluenceScore', test: (metadata) => metadata.confluenceScore != null },
    { key: 'flowConfirmed', test: (metadata) => metadata.flowConfirmed != null },
    {
      key: 'atr14',
      test: (metadata) => {
        const value = toFiniteNumber(metadata.atr14);
        return value != null && value > 0;
      },
    },
    { key: 'stopContext', test: (metadata) => metadata.stopContext != null },
    { key: 'gateStatus', test: (metadata) => metadata.gateStatus != null },
    { key: 'netGex', test: (metadata) => metadata.netGex != null || metadata.gexNet != null },
    { key: 'volumeTrend', test: (metadata) => metadata.volumeTrend != null },
    { key: 'emaAligned', test: (metadata) => metadata.emaAligned != null },
    { key: 'microstructureSnapshot', test: (metadata) => metadata.microstructureSnapshot != null },
  ];

  const counts: Record<string, number> = Object.fromEntries(checks.map((item) => [item.key, 0]));

  for (const row of rows) {
    for (const check of checks) {
      if (check.test(row.metadata)) {
        counts[check.key] += 1;
      }
    }
  }

  const fieldPopulation = Object.fromEntries(checks.map((check) => {
    const count = counts[check.key] || 0;
    return [check.key, {
      count,
      pct: percentage(count, rows.length, 1),
    }];
  }));

  const gaps = checks
    .filter((check) => percentage(counts[check.key] || 0, rows.length, 1) < METADATA_THRESHOLD_PCT)
    .map((check) => check.key);

  const status: CheckStatus = rows.length === 0
    ? 'FAIL'
    : gaps.length > 0
      ? 'WARN'
      : 'PASS';

  const details: Record<string, unknown> = {
    total: rows.length,
    thresholdPct: METADATA_THRESHOLD_PCT,
    gaps,
  };

  if (verbose) {
    details.fieldPopulation = fieldPopulation;
  }

  if (rows.length === 0) {
    details.issue = 'No setup rows found for session date.';
  }

  return { status, details };
}

async function runOptimizerProfileCheck(verbose: boolean): Promise<CheckResult> {
  const { data, error } = await supabase
    .from('spx_setup_optimizer_state')
    .select('profile,updated_at')
    .eq('id', 'active')
    .maybeSingle();

  if (error) {
    return {
      status: 'WARN',
      details: {
        issue: `Failed to read active optimizer profile: ${error.message}`,
      },
    };
  }

  if (!data) {
    return {
      status: 'WARN',
      details: {
        issue: 'Active optimizer profile row was not found (id="active").',
      },
    };
  }

  const profile = toRecord((data as { profile?: unknown }).profile);
  const qualityGate = toRecord(profile.qualityGate);

  const minPWinCalibrated = toFiniteNumber(qualityGate.minPWinCalibrated);
  const minConfluenceScore = toFiniteNumber(qualityGate.minConfluenceScore);
  const minEvR = toFiniteNumber(qualityGate.minEvR);

  const driftDetected = minPWinCalibrated == null
    || Math.abs(minPWinCalibrated - OPTIMIZER_EXPECTED_MIN_PWIN) > 0.000001;

  const details: Record<string, unknown> = {
    expected: {
      minPWinCalibrated: OPTIMIZER_EXPECTED_MIN_PWIN,
    },
    actual: {
      minPWinCalibrated,
      minConfluenceScore,
      minEvR,
    },
    driftDetected,
    updatedAt: (data as { updated_at?: string | null }).updated_at || null,
  };

  if (driftDetected) {
    details.issue = 'minPWinCalibrated drift detected.';
  }

  if (verbose) {
    details.qualityGate = qualityGate;
  }

  return {
    status: driftDetected ? 'WARN' : 'PASS',
    details,
  };
}

function runGateDistributionCheck(rows: NormalizedSetupRow[]): CheckResult {
  const byStatus = new Map<string, number>();

  for (const row of rows) {
    const status = typeof row.metadata.gateStatus === 'string' && row.metadata.gateStatus.length > 0
      ? row.metadata.gateStatus
      : 'missing';
    byStatus.set(status, (byStatus.get(status) || 0) + 1);
  }

  const total = rows.length;
  const eligible = byStatus.get('eligible') || 0;
  const eligiblePct = percentage(eligible, total, 1);

  const distribution = Array.from(byStatus.entries())
    .map(([status, count]) => ({ status, count, pct: percentage(count, total, 1) }))
    .sort((a, b) => b.count - a.count);

  let status: CheckStatus = 'PASS';
  let issue: string | null = null;

  if (total === 0) {
    status = 'WARN';
    issue = 'No setup rows found for gate distribution.';
  } else if (eligiblePct > GATE_ELIGIBLE_MAX_PCT) {
    status = 'WARN';
    issue = `Eligible share too high (${eligiblePct}%).`;
  } else if (eligiblePct < GATE_ELIGIBLE_MIN_PCT) {
    status = 'WARN';
    issue = `Eligible share too low (${eligiblePct}%).`;
  }

  return {
    status,
    details: {
      total,
      eligible,
      eligiblePct,
      thresholds: {
        minEligiblePct: GATE_ELIGIBLE_MIN_PCT,
        maxEligiblePct: GATE_ELIGIBLE_MAX_PCT,
      },
      distribution,
      ...(issue ? { issue } : {}),
    },
  };
}

function runConfluenceDistributionCheck(rows: NormalizedSetupRow[]): CheckResult {
  const buckets = new Map<number, { count: number; pWinSum: number; pWinCount: number }>();

  for (const row of rows) {
    const score = toFiniteNumber(row.metadata.confluenceScore);
    if (score == null) continue;

    const bucket = Math.floor(score);
    const current = buckets.get(bucket) || { count: 0, pWinSum: 0, pWinCount: 0 };
    current.count += 1;

    if (row.pWinCalibrated != null) {
      current.pWinSum += row.pWinCalibrated;
      current.pWinCount += 1;
    }

    buckets.set(bucket, current);
  }

  const distribution = Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([scoreBucket, bucket]) => ({
      scoreBucket,
      count: bucket.count,
      avgPWin: bucket.pWinCount > 0 ? round(bucket.pWinSum / bucket.pWinCount, 4) : null,
    }));

  const scoreFive = distribution.find((item) => item.scoreBucket === 5);
  const score5AvgPWin = typeof scoreFive?.avgPWin === 'number' ? scoreFive.avgPWin : null;
  const reinflationDetected = score5AvgPWin != null && score5AvgPWin > SCORE5_MAX_AVG_PWIN;

  let status: CheckStatus = 'PASS';
  let issue: string | null = null;

  if (distribution.length === 0) {
    status = 'WARN';
    issue = 'No confluenceScore values found for session.';
  } else if (reinflationDetected) {
    status = 'WARN';
    issue = `Average pWin at confluence score 5 is elevated (${score5AvgPWin}).`;
  }

  return {
    status,
    details: {
      score5AvgPWin,
      score5Threshold: SCORE5_MAX_AVG_PWIN,
      reinflationDetected,
      buckets: distribution,
      ...(issue ? { issue } : {}),
    },
  };
}

function runSetupTypeHealthCheck(rows: NormalizedSetupRow[]): CheckResult {
  const setupMap = new Map<string, {
    setupType: string;
    total: number;
    eligible: number;
    blocked: number;
    shadow: number;
  }>();

  for (const row of rows) {
    const current = setupMap.get(row.setupType) || {
      setupType: row.setupType,
      total: 0,
      eligible: 0,
      blocked: 0,
      shadow: 0,
    };

    current.total += 1;

    const gateStatus = typeof row.metadata.gateStatus === 'string' ? row.metadata.gateStatus : null;
    if (gateStatus === 'eligible') current.eligible += 1;
    if (gateStatus === 'blocked') current.blocked += 1;
    if (gateStatus === 'shadow_blocked') current.shadow += 1;

    setupMap.set(row.setupType, current);
  }

  const setupTypes = Array.from(setupMap.values()).sort((a, b) => b.total - a.total);
  const zeroEligibleSetupTypes = setupTypes
    .filter((row) => row.total > 0 && row.eligible === 0)
    .map((row) => row.setupType);

  const status: CheckStatus = rows.length === 0
    ? 'WARN'
    : zeroEligibleSetupTypes.length > 0
      ? 'WARN'
      : 'PASS';

  const details: Record<string, unknown> = {
    setupTypes,
    zeroEligibleSetupTypes,
  };

  if (rows.length === 0) {
    details.issue = 'No setup rows found for setup type health.';
  } else if (zeroEligibleSetupTypes.length > 0) {
    details.issue = `Setup types with zero eligible setups: ${zeroEligibleSetupTypes.join(', ')}`;
  }

  return { status, details };
}

function runResolvedOutcomesCheck(rows: NormalizedSetupRow[]): CheckResult {
  const outcomes = new Map<string, { count: number; rSum: number; rCount: number }>();

  for (const row of rows) {
    if (!row.finalOutcome) continue;

    const current = outcomes.get(row.finalOutcome) || { count: 0, rSum: 0, rCount: 0 };
    current.count += 1;

    if (row.realizedR != null) {
      current.rSum += row.realizedR;
      current.rCount += 1;
    }

    outcomes.set(row.finalOutcome, current);
  }

  const distribution = Array.from(outcomes.entries())
    .map(([finalOutcome, item]) => ({
      finalOutcome,
      count: item.count,
      avgR: item.rCount > 0 ? round(item.rSum / item.rCount, 4) : null,
    }))
    .sort((a, b) => b.count - a.count);

  const totalResolved = distribution.reduce((sum, item) => sum + item.count, 0);

  return {
    status: totalResolved > 0 ? 'PASS' : 'INFO',
    details: {
      totalResolved,
      outcomes: distribution,
    },
  };
}

async function fetchMassiveMinuteBarCounts(date: string): Promise<{
  totalBars: number;
  regularSessionBars: number;
  fetchedAt: string;
  error: string | null;
}> {
  const apiKey = process.env.MASSIVE_API_KEY;
  if (!apiKey) {
    return {
      totalBars: 0,
      regularSessionBars: 0,
      fetchedAt: new Date().toISOString(),
      error: 'MASSIVE_API_KEY is not configured.',
    };
  }

  const ticker = encodeURIComponent('I:SPX');
  const url = `https://api.massive.com/v2/aggs/ticker/${ticker}/range/1/minute/${date}/${date}?adjusted=true&sort=asc&limit=50000`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        totalBars: 0,
        regularSessionBars: 0,
        fetchedAt: new Date().toISOString(),
        error: `Massive.com request failed (${response.status}): ${body.slice(0, 200)}`,
      };
    }

    const payload = await response.json() as {
      results?: Array<{ t?: number }>;
    };

    const results = Array.isArray(payload.results) ? payload.results : [];

    let regularSessionBars = 0;
    for (const bar of results) {
      const timestamp = typeof bar?.t === 'number' ? bar.t : null;
      if (timestamp == null) continue;

      const et = toEasternTime(new Date(timestamp));
      const minuteEt = et.hour * 60 + et.minute;
      if (minuteEt >= ET_SESSION_OPEN_MINUTE && minuteEt < ET_SESSION_CLOSE_MINUTE) {
        regularSessionBars += 1;
      }
    }

    return {
      totalBars: results.length,
      regularSessionBars,
      fetchedAt: new Date().toISOString(),
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      totalBars: 0,
      regularSessionBars: 0,
      fetchedAt: new Date().toISOString(),
      error: `Massive.com request error: ${message}`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function runDataFreshnessCheck(sessionDate: string): Promise<CheckResult> {
  const freshness = await fetchMassiveMinuteBarCounts(sessionDate);

  if (freshness.error) {
    return {
      status: 'FAIL',
      details: {
        date: sessionDate,
        source: 'massive_api',
        issue: freshness.error,
      },
    };
  }

  const evaluatedBarCount = freshness.regularSessionBars > 0
    ? freshness.regularSessionBars
    : freshness.totalBars;

  let status: CheckStatus = 'PASS';
  let issue: string | null = null;

  if (evaluatedBarCount < HARD_MIN_BARS || evaluatedBarCount > HARD_MAX_BARS) {
    status = 'FAIL';
    issue = `Bar count out of hard bounds (${evaluatedBarCount}).`;
  } else if (evaluatedBarCount < REGULAR_SESSION_MIN_BARS || evaluatedBarCount > REGULAR_SESSION_MAX_BARS) {
    status = 'WARN';
    issue = `Bar count outside expected regular-session range (${evaluatedBarCount}).`;
  }

  return {
    status,
    details: {
      date: sessionDate,
      source: 'massive_api',
      totalBars: freshness.totalBars,
      regularSessionBars: freshness.regularSessionBars,
      evaluatedBarCount,
      expectedRange: {
        min: REGULAR_SESSION_MIN_BARS,
        max: REGULAR_SESSION_MAX_BARS,
      },
      hardBounds: {
        min: HARD_MIN_BARS,
        max: HARD_MAX_BARS,
      },
      fetchedAt: freshness.fetchedAt,
      ...(issue ? { issue } : {}),
    },
  };
}

function summarizeFailures(checks: Record<string, CheckResult>): string[] {
  const critical: string[] = [];
  for (const [checkName, check] of Object.entries(checks)) {
    if (check.status !== 'FAIL') continue;
    const issue = typeof check.details.issue === 'string' && check.details.issue.length > 0
      ? check.details.issue
      : 'check failed';
    critical.push(`${checkName}: ${issue}`);
  }
  return critical;
}

async function main() {
  const { dateArg, verbose } = parseArgs(process.argv.slice(2));
  const sessionDate = resolveSessionDate(dateArg);

  const [rows, optimizerProfile, dataFreshness] = await Promise.all([
    loadSetupRows(sessionDate),
    runOptimizerProfileCheck(verbose),
    runDataFreshnessCheck(sessionDate),
  ]);

  const metadataCompleteness = runMetadataCompletenessCheck(rows, verbose);
  const gateDistribution = runGateDistributionCheck(rows);
  const confluenceDistribution = runConfluenceDistributionCheck(rows);
  const setupTypeHealth = runSetupTypeHealthCheck(rows);
  const resolvedOutcomes = runResolvedOutcomesCheck(rows);

  const checks: Record<string, CheckResult> = {
    metadataCompleteness,
    optimizerProfile,
    gateDistribution,
    confluenceDistribution,
    setupTypeHealth,
    resolvedOutcomes,
    dataFreshness,
  };

  const statuses = Object.values(checks).map((check) => check.status);

  const report = {
    sessionDate,
    runAt: new Date().toISOString(),
    checks,
    summary: {
      totalSetups: rows.length,
      passedChecks: statuses.filter((status) => status === 'PASS').length,
      warnings: statuses.filter((status) => status === 'WARN').length,
      failures: statuses.filter((status) => status === 'FAIL').length,
      criticalFindings: summarizeFailures(checks),
    },
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`SPX daily health check failed: ${message}\n`);
  process.exit(1);
});
