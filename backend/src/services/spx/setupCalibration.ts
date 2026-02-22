import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';
import { toEasternTime } from '../marketHours';
import type { Regime, SetupType } from './types';

const DB_PAGE_SIZE = 2_000;
const SESSION_OPEN_MINUTE_ET = (9 * 60) + 30;
const GEOMETRY_BUCKET_OPENING_MAX_MINUTE = 90;
const GEOMETRY_BUCKET_MIDDAY_MAX_MINUTE = 240;

const DEFAULT_LOOKBACK_DAYS = 90;
const DEFAULT_MODEL_TTL_MS = 5 * 60_000;
const DEFAULT_GLOBAL_PRIOR_PWIN = 0.56;
const DEFAULT_GLOBAL_PRIOR_TRADES = 24;
const DEFAULT_TYPE_PRIOR_TRADES = 16;
const DEFAULT_REGIME_PRIOR_TRADES = 12;
const DEFAULT_BUCKET_PRIOR_TRADES = 8;
const DEFAULT_BLEND_FULL_WEIGHT_TRADES = 40;
const DEFAULT_BLEND_MIN_WEIGHT = 0.15;
const DEFAULT_BLEND_MAX_WEIGHT = 0.72;

export type SetupCalibrationBucket = 'opening' | 'midday' | 'late';
export type SetupCalibrationSource =
  | 'setup_regime_bucket'
  | 'setup_regime'
  | 'setup_type'
  | 'global'
  | 'heuristic';

interface CalibrationRow {
  session_date: string;
  setup_type: string;
  regime: string | null;
  first_seen_at: string | null;
  triggered_at: string | null;
  final_outcome: string | null;
}

interface CalibrationCounter {
  trades: number;
  wins: number;
}

interface CalibrationRateStat extends CalibrationCounter {
  pWin: number;
}

interface CalibrationConfig {
  lookbackDays: number;
  modelTtlMs: number;
  globalPriorPWin: number;
  globalPriorTrades: number;
  typePriorTrades: number;
  regimePriorTrades: number;
  bucketPriorTrades: number;
  blendFullWeightTrades: number;
  blendMinWeight: number;
  blendMaxWeight: number;
}

interface InternalCalibrationModel {
  generatedAt: string;
  asOfDateEt: string;
  range: { from: string; to: string };
  sampleSize: number;
  bySetupType: Map<string, CalibrationRateStat>;
  bySetupRegime: Map<string, CalibrationRateStat>;
  bySetupRegimeBucket: Map<string, CalibrationRateStat>;
  global: CalibrationRateStat;
  config: CalibrationConfig;
}

export interface SetupPWinCalibrationInput {
  setupType: SetupType;
  regime: Regime;
  firstSeenMinuteEt: number | null;
  rawPWin: number;
}

export interface SetupPWinCalibrationResult {
  pWin: number;
  source: SetupCalibrationSource;
  sampleSize: number;
  empiricalPWin: number | null;
  blendWeight: number;
}

export interface SetupPWinCalibrationModel {
  generatedAt: string;
  asOfDateEt: string;
  range: { from: string; to: string };
  sampleSize: number;
  calibrate: (input: SetupPWinCalibrationInput) => SetupPWinCalibrationResult;
}

let modelCacheByDate = new Map<string, { expiresAtMs: number; model: SetupPWinCalibrationModel }>();
let inFlightByDate = new Map<string, Promise<SetupPWinCalibrationModel>>();

function parseIntEnv(value: string | undefined, fallback: number, minimum: number): number {
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, parsed);
}

function parseFloatEnv(value: string | undefined, fallback: number, min: number, max: number): number {
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function getCalibrationConfig(): CalibrationConfig {
  const blendMinWeight = parseFloatEnv(
    process.env.SPX_SETUP_CALIBRATION_BLEND_MIN_WEIGHT,
    DEFAULT_BLEND_MIN_WEIGHT,
    0,
    0.95,
  );
  const blendMaxWeight = parseFloatEnv(
    process.env.SPX_SETUP_CALIBRATION_BLEND_MAX_WEIGHT,
    DEFAULT_BLEND_MAX_WEIGHT,
    blendMinWeight,
    0.98,
  );

  return {
    lookbackDays: parseIntEnv(
      process.env.SPX_SETUP_CALIBRATION_LOOKBACK_DAYS,
      DEFAULT_LOOKBACK_DAYS,
      20,
    ),
    modelTtlMs: parseIntEnv(
      process.env.SPX_SETUP_CALIBRATION_MODEL_TTL_MS,
      DEFAULT_MODEL_TTL_MS,
      15_000,
    ),
    globalPriorPWin: parseFloatEnv(
      process.env.SPX_SETUP_CALIBRATION_GLOBAL_PRIOR_PWIN,
      DEFAULT_GLOBAL_PRIOR_PWIN,
      0.05,
      0.95,
    ),
    globalPriorTrades: parseIntEnv(
      process.env.SPX_SETUP_CALIBRATION_GLOBAL_PRIOR_TRADES,
      DEFAULT_GLOBAL_PRIOR_TRADES,
      1,
    ),
    typePriorTrades: parseIntEnv(
      process.env.SPX_SETUP_CALIBRATION_TYPE_PRIOR_TRADES,
      DEFAULT_TYPE_PRIOR_TRADES,
      1,
    ),
    regimePriorTrades: parseIntEnv(
      process.env.SPX_SETUP_CALIBRATION_REGIME_PRIOR_TRADES,
      DEFAULT_REGIME_PRIOR_TRADES,
      1,
    ),
    bucketPriorTrades: parseIntEnv(
      process.env.SPX_SETUP_CALIBRATION_BUCKET_PRIOR_TRADES,
      DEFAULT_BUCKET_PRIOR_TRADES,
      1,
    ),
    blendFullWeightTrades: parseIntEnv(
      process.env.SPX_SETUP_CALIBRATION_BLEND_FULL_WEIGHT_TRADES,
      DEFAULT_BLEND_FULL_WEIGHT_TRADES,
      5,
    ),
    blendMinWeight,
    blendMaxWeight,
  };
}

function shiftDate(dateStr: string, days: number): string {
  const base = new Date(`${dateStr}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0.05, Math.min(0.95, value));
}

function outcomeIsT1Win(value: string | null | undefined): boolean {
  return value === 't1_before_stop' || value === 't2_before_stop';
}

function toSessionMinuteEt(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  const et = toEasternTime(new Date(parsed));
  return Math.max(0, (et.hour * 60 + et.minute) - SESSION_OPEN_MINUTE_ET);
}

function toCalibrationBucket(minuteSinceOpenEt: number | null): SetupCalibrationBucket {
  if (minuteSinceOpenEt == null) return 'midday';
  if (minuteSinceOpenEt <= GEOMETRY_BUCKET_OPENING_MAX_MINUTE) return 'opening';
  if (minuteSinceOpenEt <= GEOMETRY_BUCKET_MIDDAY_MAX_MINUTE) return 'midday';
  return 'late';
}

function incrementCounter(map: Map<string, CalibrationCounter>, key: string, win: boolean): void {
  const current = map.get(key) || { trades: 0, wins: 0 };
  current.trades += 1;
  if (win) current.wins += 1;
  map.set(key, current);
}

function smoothRate(counter: CalibrationCounter, priorPWin: number, priorTrades: number): CalibrationRateStat {
  const trades = Math.max(0, counter.trades);
  const wins = Math.max(0, counter.wins);
  const blended = (wins + (priorPWin * priorTrades)) / (trades + priorTrades);
  return {
    trades,
    wins,
    pWin: clampProbability(blended),
  };
}

function toKeyRegime(setupType: string, regime: string): string {
  return `${setupType}|${regime}`;
}

function toKeyBucket(setupType: string, regime: string, bucket: SetupCalibrationBucket): string {
  return `${setupType}|${regime}|${bucket}`;
}

function safeRegime(value: string | null | undefined): string {
  if (typeof value !== 'string' || value.trim().length === 0) return 'unknown';
  return value.trim();
}

function isMissingTableError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('does not exist') || normalized.includes('could not find the table');
}

async function loadCalibrationRows(range: {
  from: string;
  to: string;
}): Promise<CalibrationRow[]> {
  if (range.from > range.to) return [];

  const rows: CalibrationRow[] = [];
  let page = 0;

  while (true) {
    const fromIndex = page * DB_PAGE_SIZE;
    const toIndex = fromIndex + DB_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('spx_setup_instances')
      .select('session_date,setup_type,regime,first_seen_at,triggered_at,final_outcome,engine_setup_id')
      .gte('session_date', range.from)
      .lte('session_date', range.to)
      .order('session_date', { ascending: true })
      .order('engine_setup_id', { ascending: true })
      .range(fromIndex, toIndex);

    if (error) {
      if (isMissingTableError(error.message)) {
        logger.warn('SPX setup calibration skipped because spx_setup_instances is missing');
        return [];
      }
      throw new Error(`Failed to load SPX setup calibration rows: ${error.message}`);
    }

    const pageRows = (data || []) as CalibrationRow[];
    rows.push(...pageRows);
    if (pageRows.length < DB_PAGE_SIZE) break;
    page += 1;
  }

  return rows;
}

function buildInternalModel(input: {
  rows: CalibrationRow[];
  asOfDateEt: string;
  range: { from: string; to: string };
  config: CalibrationConfig;
}): InternalCalibrationModel {
  const bySetupTypeCounter = new Map<string, CalibrationCounter>();
  const bySetupRegimeCounter = new Map<string, CalibrationCounter>();
  const bySetupRegimeBucketCounter = new Map<string, CalibrationCounter>();
  const globalCounter: CalibrationCounter = { trades: 0, wins: 0 };

  for (const row of input.rows) {
    if (!row.triggered_at || !row.final_outcome) continue;

    const setupType = typeof row.setup_type === 'string' && row.setup_type.length > 0
      ? row.setup_type
      : 'unknown';
    const regime = safeRegime(row.regime);
    const bucket = toCalibrationBucket(toSessionMinuteEt(row.first_seen_at));
    const win = outcomeIsT1Win(row.final_outcome);

    globalCounter.trades += 1;
    if (win) globalCounter.wins += 1;
    incrementCounter(bySetupTypeCounter, setupType, win);
    incrementCounter(bySetupRegimeCounter, toKeyRegime(setupType, regime), win);
    incrementCounter(bySetupRegimeBucketCounter, toKeyBucket(setupType, regime, bucket), win);
  }

  const global = smoothRate(
    globalCounter,
    input.config.globalPriorPWin,
    input.config.globalPriorTrades,
  );

  const bySetupType = new Map<string, CalibrationRateStat>();
  for (const [setupType, counter] of bySetupTypeCounter.entries()) {
    bySetupType.set(
      setupType,
      smoothRate(counter, global.pWin, input.config.typePriorTrades),
    );
  }

  const bySetupRegime = new Map<string, CalibrationRateStat>();
  for (const [key, counter] of bySetupRegimeCounter.entries()) {
    const [setupType] = key.split('|');
    const parent = bySetupType.get(setupType)?.pWin ?? global.pWin;
    bySetupRegime.set(
      key,
      smoothRate(counter, parent, input.config.regimePriorTrades),
    );
  }

  const bySetupRegimeBucket = new Map<string, CalibrationRateStat>();
  for (const [key, counter] of bySetupRegimeBucketCounter.entries()) {
    const [setupType, regime] = key.split('|');
    const parent = bySetupRegime.get(toKeyRegime(setupType, regime))?.pWin
      ?? bySetupType.get(setupType)?.pWin
      ?? global.pWin;
    bySetupRegimeBucket.set(
      key,
      smoothRate(counter, parent, input.config.bucketPriorTrades),
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    asOfDateEt: input.asOfDateEt,
    range: input.range,
    sampleSize: global.trades,
    bySetupType,
    bySetupRegime,
    bySetupRegimeBucket,
    global,
    config: input.config,
  };
}

function resolveBlendWeight(sampleSize: number, config: CalibrationConfig): number {
  if (sampleSize <= 0) return 0;
  const ratio = Math.min(1, sampleSize / Math.max(1, config.blendFullWeightTrades));
  return config.blendMinWeight + ((config.blendMaxWeight - config.blendMinWeight) * ratio);
}

function calibrateFromInternalModel(
  model: InternalCalibrationModel,
  input: SetupPWinCalibrationInput,
): SetupPWinCalibrationResult {
  const rawPWin = clampProbability(input.rawPWin);
  const regimeKey = toKeyRegime(input.setupType, input.regime);
  const bucketKey = toKeyBucket(
    input.setupType,
    input.regime,
    toCalibrationBucket(input.firstSeenMinuteEt),
  );

  const bucketStat = model.bySetupRegimeBucket.get(bucketKey);
  const regimeStat = model.bySetupRegime.get(regimeKey);
  const typeStat = model.bySetupType.get(input.setupType);

  let source: SetupCalibrationSource = 'heuristic';
  let stat: CalibrationRateStat | null = null;

  if (bucketStat && bucketStat.trades > 0) {
    source = 'setup_regime_bucket';
    stat = bucketStat;
  } else if (regimeStat && regimeStat.trades > 0) {
    source = 'setup_regime';
    stat = regimeStat;
  } else if (typeStat && typeStat.trades > 0) {
    source = 'setup_type';
    stat = typeStat;
  } else if (model.global.trades > 0) {
    source = 'global';
    stat = model.global;
  }

  if (!stat) {
    return {
      pWin: rawPWin,
      source,
      sampleSize: 0,
      empiricalPWin: null,
      blendWeight: 0,
    };
  }

  const blendWeight = resolveBlendWeight(stat.trades, model.config);
  const pWin = clampProbability(
    (rawPWin * (1 - blendWeight))
    + (stat.pWin * blendWeight),
  );

  return {
    pWin,
    source,
    sampleSize: stat.trades,
    empiricalPWin: stat.pWin,
    blendWeight,
  };
}

function buildPublicModel(internalModel: InternalCalibrationModel): SetupPWinCalibrationModel {
  return {
    generatedAt: internalModel.generatedAt,
    asOfDateEt: internalModel.asOfDateEt,
    range: internalModel.range,
    sampleSize: internalModel.sampleSize,
    calibrate: (input) => calibrateFromInternalModel(internalModel, input),
  };
}

function defaultAsOfDateEt(now: Date = new Date()): string {
  return toEasternTime(now).dateStr;
}

function resolveCacheKey(input: {
  asOfDateEt: string;
  lookbackDays: number;
}): string {
  return `${input.asOfDateEt}|${input.lookbackDays}`;
}

function resolveCalibrationRange(asOfDateEt: string, lookbackDays: number): { from: string; to: string } {
  const to = shiftDate(asOfDateEt, -1);
  const from = shiftDate(to, -(Math.max(2, lookbackDays) - 1));
  return { from, to };
}

export async function loadSetupPWinCalibrationModel(input?: {
  asOfDateEt?: string;
  forceRefresh?: boolean;
}): Promise<SetupPWinCalibrationModel> {
  const config = getCalibrationConfig();
  const asOfDateEt = input?.asOfDateEt || defaultAsOfDateEt();
  const cacheKey = resolveCacheKey({
    asOfDateEt,
    lookbackDays: config.lookbackDays,
  });

  if (!input?.forceRefresh) {
    const cached = modelCacheByDate.get(cacheKey);
    if (cached && cached.expiresAtMs > Date.now()) {
      return cached.model;
    }

    const inFlight = inFlightByDate.get(cacheKey);
    if (inFlight) return inFlight;
  }

  const run = async (): Promise<SetupPWinCalibrationModel> => {
    const range = resolveCalibrationRange(asOfDateEt, config.lookbackDays);
    const rows = await loadCalibrationRows(range);
    const internalModel = buildInternalModel({
      rows,
      asOfDateEt,
      range,
      config,
    });
    const model = buildPublicModel(internalModel);

    logger.info('SPX setup win-rate calibration model refreshed', {
      asOfDateEt,
      from: range.from,
      to: range.to,
      sampleSize: model.sampleSize,
      setupTypeCount: internalModel.bySetupType.size,
      setupRegimeCount: internalModel.bySetupRegime.size,
      setupRegimeBucketCount: internalModel.bySetupRegimeBucket.size,
    });

    modelCacheByDate.set(cacheKey, {
      expiresAtMs: Date.now() + config.modelTtlMs,
      model,
    });

    return model;
  };

  const promise = run();
  inFlightByDate.set(cacheKey, promise);

  try {
    return await promise;
  } finally {
    inFlightByDate.delete(cacheKey);
  }
}

export function __resetSetupPWinCalibrationCacheForTests(): void {
  modelCacheByDate = new Map();
  inFlightByDate = new Map();
}
