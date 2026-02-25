import {
  getAggregates,
  getMinuteAggregates,
  getOptionsSnapshotAtDate,
  type OptionsSnapshot,
} from '../../config/massive';
import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';
import { calculateLevels, type LevelItem } from '../levels';
import { classifyCurrentRegime } from './regimeClassifier';
import { calculateAtrFromBars } from './atrService';
import { getFibLevels } from './fibEngine';
import { detectActiveSetups } from './setupDetector';
import {
  persistBacktestRowsForWinRate,
  persistSetupInstancesForWinRate,
} from './outcomeTracker';
import { buildClusterZones } from './levelEngine';
import { runSPXWinRateBacktest } from './winRateBacktest';
import type {
  FibLevel,
  GEXProfile,
  RegimeState,
  SPXFlowEvent,
  SPXLevel,
  Setup,
  UnifiedGEXLandscape,
} from './types';
import { ema, round, stableId } from './utils';
import {
  calculateVWAP,
  analyzeVWAPPosition,
  calculateVWAPBandSet,
} from '../levels/calculators/vwap';

const SPY_TO_SPX_STRIKE = 10;
const SPY_TO_SPX_GEX_SCALE = 0.1;
const DEFAULT_MAX_EXPIRATIONS = 4;
const DEFAULT_SPX_STRIKE_RANGE = 350;
const DEFAULT_SPY_STRIKE_RANGE = 40;
const MIN_FLOW_VOLUME = 10;
const MIN_FLOW_PREMIUM = 10_000;
const MAX_FLOW_EVENTS = 240;
const EMA_FAST_PERIOD = 21;
const EMA_SLOW_PERIOD = 55;
const ORB_WINDOW_MINUTES = 30;
const FLOW_CONTRACT_SCAN_LIMIT = 16;
const FLOW_BARS_BATCH_SIZE = 4;
const FLOW_INTERVAL_MIN_PREMIUM = 25_000;
const FLOW_INTERVAL_MIN_VOLUME = 3;
const FLOW_INTERVAL_SWEEP_VOLUME = 35;
const FIB_CONFIRMATION_BARS = 5;
const FIB_INTRADAY_RATIOS = [0.236, 0.382, 0.5, 0.618, 0.786, 1.272, 1.618];

interface HistoricalBackfillRow {
  date: string;
  setupsGenerated: number;
  setupsTriggeredAtGeneration: number;
  errors: string[];
}

function isMissingTableError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('could not find the table') || normalized.includes('does not exist');
}

export interface HistoricalBackfillSummary {
  from: string;
  to: string;
  rows: HistoricalBackfillRow[];
  attemptedDays: number;
  successfulDays: number;
  failedDays: number;
}

function dateRangeInclusive(from: string, to: string): string[] {
  const start = new Date(`${from}T12:00:00.000Z`);
  const end = new Date(`${to}T12:00:00.000Z`);
  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    // Skip weekend dates to avoid unnecessary historical snapshot requests.
    if (day !== 0 && day !== 6) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function shiftDate(dateStr: string, days: number): string {
  const base = new Date(`${dateStr}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function epochToIso(raw: number | undefined): string {
  if (!raw || !Number.isFinite(raw) || raw <= 0) return new Date().toISOString();
  const ms = raw > 1e15
    ? Math.floor(raw / 1_000_000)
    : raw > 1e12
      ? Math.floor(raw / 1_000)
      : raw;
  return new Date(ms).toISOString();
}

function mapLevelCategory(type: string): SPXLevel['category'] {
  const normalized = type.toUpperCase();
  if (normalized.startsWith('PW') || normalized.includes('MONTH')) return 'structural';
  if (normalized.startsWith('PD') || normalized.startsWith('PM')) return 'tactical';
  if (normalized.includes('VWAP') || normalized.startsWith('OR-') || normalized.startsWith('IB-')) return 'intraday';
  return 'tactical';
}

function chartStyle(category: SPXLevel['category']): SPXLevel['chartStyle'] {
  if (category === 'structural') return { color: 'rgba(96,165,250,0.7)', lineStyle: 'solid', lineWidth: 2, labelFormat: 'Structural' };
  if (category === 'tactical') return { color: 'rgba(255,255,255,0.6)', lineStyle: 'solid', lineWidth: 1.5, labelFormat: 'Tactical' };
  if (category === 'intraday') return { color: 'rgba(156,163,175,0.5)', lineStyle: 'dotted', lineWidth: 1, labelFormat: 'Intraday' };
  if (category === 'options') return { color: 'rgba(16,185,129,0.8)', lineStyle: 'solid', lineWidth: 2, labelFormat: 'Options' };
  return { color: 'rgba(16,185,129,0.5)', lineStyle: 'dot-dash', lineWidth: 1.5, labelFormat: 'SPY Derived' };
}

function mapLegacyLevel(
  symbol: 'SPX' | 'SPY',
  level: LevelItem,
  category: SPXLevel['category'],
  transformedPrice?: number,
): SPXLevel {
  return {
    id: stableId('historical_level', `${symbol}|${level.type}|${level.price}|${transformedPrice ?? 'na'}`),
    symbol,
    category,
    source: level.type,
    price: round(transformedPrice ?? level.price, 2),
    strength: level.strength,
    timeframe: category === 'structural' ? 'weekly' : category === 'intraday' ? 'intraday' : 'daily',
    metadata: {
      description: level.description,
      testsToday: level.testsToday ?? 0,
      lastTestAt: level.lastTest ?? null,
      holdRate: level.holdRate ?? null,
    },
    chartStyle: chartStyle(category),
  };
}

function summarizeSnapshots(input: {
  symbol: 'SPX' | 'SPY';
  spotPrice: number;
  snapshots: OptionsSnapshot[];
  asOfDate: string;
  strikeRange: number;
  maxExpirations: number;
}): GEXProfile {
  const contracts = input.snapshots
    .map((snapshot) => {
      const details = snapshot.details;
      const strike = details?.strike_price;
      const contractType = details?.contract_type;
      const expiry = details?.expiration_date;
      const gamma = snapshot.greeks?.gamma;
      const oi = snapshot.open_interest;
      if (typeof strike !== 'number' || (contractType !== 'call' && contractType !== 'put') || typeof expiry !== 'string') {
        return null;
      }
      if (typeof gamma !== 'number' || !Number.isFinite(gamma) || gamma <= 0) {
        return null;
      }
      if (typeof oi !== 'number' || !Number.isFinite(oi) || oi <= 0) {
        return null;
      }
      return {
        strike,
        contractType,
        expiry,
        gamma,
        openInterest: oi,
      };
    })
    .filter((row): row is {
      strike: number;
      contractType: 'call' | 'put';
      expiry: string;
      gamma: number;
      openInterest: number;
    } => row !== null);

  const expiries = Array.from(new Set(
    contracts
      .map((row) => row.expiry)
      .filter((expiry) => expiry >= input.asOfDate),
  ))
    .sort()
    .slice(0, input.maxExpirations);

  const expirySet = new Set(expiries);
  const filtered = contracts.filter((row) => (
    expirySet.has(row.expiry)
    && Math.abs(row.strike - input.spotPrice) <= input.strikeRange
  ));

  const byStrike = new Map<number, { callGex: number; putGex: number }>();
  for (const row of filtered) {
    const strike = round(row.strike, 2);
    const current = byStrike.get(strike) || { callGex: 0, putGex: 0 };
    const gex = row.gamma * row.openInterest * 100 * input.spotPrice * input.spotPrice * 0.01;
    if (row.contractType === 'call') {
      current.callGex += gex;
    } else {
      current.putGex += gex;
    }
    byStrike.set(strike, current);
  }

  const strikeRows = Array.from(byStrike.entries())
    .map(([strike, values]) => ({
      strike: round(strike, 2),
      gex: round(values.callGex - values.putGex, 2),
    }))
    .sort((a, b) => a.strike - b.strike);

  const netGex = round(strikeRows.reduce((sum, row) => sum + row.gex, 0), 2);
  const callWall = strikeRows.filter((row) => row.gex > 0).sort((a, b) => b.gex - a.gex)[0]?.strike ?? input.spotPrice;
  const putWall = strikeRows.filter((row) => row.gex < 0).sort((a, b) => a.gex - b.gex)[0]?.strike ?? input.spotPrice;
  const flipPoint = strikeRows.sort((a, b) => Math.abs(a.gex) - Math.abs(b.gex))[0]?.strike ?? input.spotPrice;
  const keyLevels = [...strikeRows]
    .sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex))
    .slice(0, 10)
    .map((row) => ({
      strike: row.strike,
      gex: row.gex,
      type: row.gex >= 0 ? 'call_wall' as const : 'put_wall' as const,
    }));

  return {
    symbol: input.symbol,
    spotPrice: round(input.spotPrice, 2),
    netGex,
    flipPoint: round(flipPoint, 2),
    callWall: round(callWall, 2),
    putWall: round(putWall, 2),
    zeroGamma: round(flipPoint, 2),
    gexByStrike: strikeRows,
    keyLevels,
    expirationBreakdown: {},
    timestamp: `${input.asOfDate}T20:00:00.000Z`,
  };
}

function combineProfiles(spx: GEXProfile, spy: GEXProfile): GEXProfile {
  const basis = spx.spotPrice - (spy.spotPrice * SPY_TO_SPX_STRIKE);
  const merged = new Map<number, number>();
  const add = (strike: number, gex: number) => {
    const key = round(strike, 1);
    merged.set(key, round((merged.get(key) || 0) + gex, 2));
  };

  for (const row of spx.gexByStrike) add(row.strike, row.gex);
  for (const row of spy.gexByStrike) add((row.strike * SPY_TO_SPX_STRIKE) + basis, row.gex * SPY_TO_SPX_GEX_SCALE);

  const strikeRows = Array.from(merged.entries())
    .map(([strike, gex]) => ({ strike: round(strike, 2), gex: round(gex, 2) }))
    .sort((a, b) => a.strike - b.strike);

  const netGex = round(strikeRows.reduce((sum, row) => sum + row.gex, 0), 2);
  const callWall = strikeRows.filter((row) => row.gex > 0).sort((a, b) => b.gex - a.gex)[0]?.strike ?? spx.spotPrice;
  const putWall = strikeRows.filter((row) => row.gex < 0).sort((a, b) => a.gex - b.gex)[0]?.strike ?? spx.spotPrice;
  const flipPoint = strikeRows.sort((a, b) => Math.abs(a.gex) - Math.abs(b.gex))[0]?.strike ?? spx.spotPrice;
  const keyLevels = [...strikeRows]
    .sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex))
    .slice(0, 10)
    .map((row) => ({
      strike: row.strike,
      gex: row.gex,
      type: row.gex >= 0 ? 'call_wall' as const : 'put_wall' as const,
    }));

  return {
    symbol: 'COMBINED',
    spotPrice: spx.spotPrice,
    netGex,
    flipPoint: round(flipPoint, 2),
    callWall: round(callWall, 2),
    putWall: round(putWall, 2),
    zeroGamma: round(flipPoint, 2),
    gexByStrike: strikeRows,
    keyLevels,
    expirationBreakdown: {},
    timestamp: spx.timestamp,
  };
}

function buildHistoricalGEXLandscape(input: {
  asOfDate: string;
  spxSpotPrice: number;
  spySpotPrice: number;
  spxSnapshots: OptionsSnapshot[];
  spySnapshots: OptionsSnapshot[];
}): UnifiedGEXLandscape {
  const spx = summarizeSnapshots({
    symbol: 'SPX',
    spotPrice: input.spxSpotPrice,
    snapshots: input.spxSnapshots,
    asOfDate: input.asOfDate,
    strikeRange: DEFAULT_SPX_STRIKE_RANGE,
    maxExpirations: DEFAULT_MAX_EXPIRATIONS,
  });
  const spy = summarizeSnapshots({
    symbol: 'SPY',
    spotPrice: input.spySpotPrice,
    snapshots: input.spySnapshots,
    asOfDate: input.asOfDate,
    strikeRange: DEFAULT_SPY_STRIKE_RANGE,
    maxExpirations: DEFAULT_MAX_EXPIRATIONS,
  });
  const combined = combineProfiles(spx, spy);
  return { spx, spy, combined };
}

function withUpdatedSpotPrices(
  landscape: UnifiedGEXLandscape,
  input: { spxSpotPrice: number; spySpotPrice: number; timestampIso: string },
): UnifiedGEXLandscape {
  return {
    spx: {
      ...landscape.spx,
      spotPrice: round(input.spxSpotPrice, 2),
      timestamp: input.timestampIso,
    },
    spy: {
      ...landscape.spy,
      spotPrice: round(input.spySpotPrice, 2),
      timestamp: input.timestampIso,
    },
    combined: {
      ...landscape.combined,
      spotPrice: round(input.spxSpotPrice, 2),
      timestamp: input.timestampIso,
    },
  };
}

function toMid(snapshot: OptionsSnapshot): number {
  const dayClose = snapshot.day?.close;
  if (typeof dayClose === 'number' && dayClose > 0) return dayClose;
  const bid = snapshot.last_quote?.bid ?? 0;
  const ask = snapshot.last_quote?.ask ?? 0;
  if (bid > 0 && ask > 0) return (bid + ask) / 2;
  return Math.max(bid, ask, 0);
}

interface HistoricalFlowContractCandidate {
  ticker: string;
  symbol: 'SPX' | 'SPY';
  strike: number;
  expiry: string;
  contractType: 'call' | 'put';
  dayVolume: number;
  dayPremiumEstimate: number;
}

function addDays(date: string, days: number): string {
  const base = new Date(`${date}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function isExpiryInFlowWindow(expiry: string, asOfDate: string): boolean {
  if (expiry < asOfDate) return false;
  return expiry <= addDays(asOfDate, 7);
}

function toFlowContractCandidates(input: {
  symbol: 'SPX' | 'SPY';
  asOfDate: string;
  snapshots: OptionsSnapshot[];
}): HistoricalFlowContractCandidate[] {
  const candidates = input.snapshots
    .map((snapshot) => {
      const details = snapshot.details;
      const ticker = typeof snapshot.ticker === 'string' ? snapshot.ticker : null;
      const strike = details?.strike_price;
      const expiry = details?.expiration_date;
      const contractType = details?.contract_type;
      if (!ticker || typeof strike !== 'number' || typeof expiry !== 'string' || (contractType !== 'call' && contractType !== 'put')) {
        return null;
      }
      if (!isExpiryInFlowWindow(expiry, input.asOfDate)) return null;

      const dayVolume = Math.max(0, snapshot.day?.volume || 0);
      if (dayVolume < MIN_FLOW_VOLUME) return null;

      const dayPremiumEstimate = round(toMid(snapshot) * dayVolume * 100, 2);
      if (dayPremiumEstimate < MIN_FLOW_PREMIUM) return null;

      return {
        ticker,
        symbol: input.symbol,
        strike: round(strike, 2),
        expiry,
        contractType,
        dayVolume,
        dayPremiumEstimate,
      };
    })
    .filter((candidate): candidate is HistoricalFlowContractCandidate => candidate !== null)
    .sort((a, b) => {
      if (b.dayPremiumEstimate !== a.dayPremiumEstimate) return b.dayPremiumEstimate - a.dayPremiumEstimate;
      return b.dayVolume - a.dayVolume;
    })
    .slice(0, FLOW_CONTRACT_SCAN_LIMIT);

  return candidates;
}

async function loadContractMinuteBars(input: {
  ticker: string;
  asOfDate: string;
}): Promise<Array<{ t: number; c: number; v: number }>> {
  try {
    const response = await getAggregates(input.ticker, 1, 'minute', input.asOfDate, input.asOfDate);
    return (response.results || [])
      .filter((bar) => Number.isFinite(bar.t) && Number.isFinite(bar.c) && Number.isFinite(bar.v));
  } catch (error) {
    logger.warn('Historical flow contract bar fetch failed', {
      ticker: input.ticker,
      asOfDate: input.asOfDate,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function flowEventsFromContractBars(input: {
  candidate: HistoricalFlowContractCandidate;
  bars: Array<{ t: number; c: number; v: number }>;
}): SPXFlowEvent[] {
  const usable = input.bars.filter((bar) => bar.v >= FLOW_INTERVAL_MIN_VOLUME && bar.c > 0);
  if (usable.length === 0) return [];

  const premiums = usable.map((bar) => bar.c * bar.v * 100);
  const avgPremium = premiums.reduce((sum, value) => sum + value, 0) / premiums.length;

  return usable
    .map((bar) => {
      const premium = round(bar.c * bar.v * 100, 2);
      const threshold = Math.max(FLOW_INTERVAL_MIN_PREMIUM, avgPremium * 1.35);
      if (premium < threshold) return null;

      const isSweep = bar.v >= FLOW_INTERVAL_SWEEP_VOLUME
        || premium >= Math.max(FLOW_INTERVAL_MIN_PREMIUM * 2, avgPremium * 2.1);

      return {
        id: stableId(
          'historical_flow',
          `${input.candidate.symbol}|${input.candidate.ticker}|${bar.t}|${bar.v}|${premium}`,
        ),
        type: isSweep ? 'sweep' : 'block',
        symbol: input.candidate.symbol,
        strike: input.candidate.strike,
        expiry: input.candidate.expiry,
        size: Math.round(bar.v),
        direction: input.candidate.contractType === 'call' ? 'bullish' : 'bearish',
        premium,
        timestamp: new Date(bar.t).toISOString(),
      } satisfies SPXFlowEvent;
    })
    .filter((event): event is SPXFlowEvent => event !== null);
}

async function flowFromIntervalizedContracts(input: {
  symbol: 'SPX' | 'SPY';
  asOfDate: string;
  snapshots: OptionsSnapshot[];
}): Promise<SPXFlowEvent[]> {
  const candidates = toFlowContractCandidates({
    symbol: input.symbol,
    asOfDate: input.asOfDate,
    snapshots: input.snapshots,
  });
  if (candidates.length === 0) return [];

  const events: SPXFlowEvent[] = [];
  for (let index = 0; index < candidates.length; index += FLOW_BARS_BATCH_SIZE) {
    const batch = candidates.slice(index, index + FLOW_BARS_BATCH_SIZE);
    const barsByCandidate = await Promise.all(batch.map(async (candidate) => ({
      candidate,
      bars: await loadContractMinuteBars({
        ticker: candidate.ticker,
        asOfDate: input.asOfDate,
      }),
    })));

    for (const row of barsByCandidate) {
      events.push(...flowEventsFromContractBars(row));
    }
  }

  return events
    .sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp.localeCompare(b.timestamp);
      return b.premium - a.premium;
    })
    .slice(-MAX_FLOW_EVENTS);
}

function flowFromSnapshots(symbol: 'SPX' | 'SPY', snapshots: OptionsSnapshot[]): SPXFlowEvent[] {
  const events: SPXFlowEvent[] = [];
  for (const snapshot of snapshots) {
    const strike = snapshot.details?.strike_price;
    const expiry = snapshot.details?.expiration_date;
    const contractType = snapshot.details?.contract_type;
    if (typeof strike !== 'number' || typeof expiry !== 'string' || (contractType !== 'call' && contractType !== 'put')) {
      continue;
    }

    const volume = Math.max(0, snapshot.day?.volume || 0);
    if (volume < MIN_FLOW_VOLUME) continue;

    const premium = round(toMid(snapshot) * volume * 100, 2);
    if (premium < MIN_FLOW_PREMIUM) continue;

    events.push({
      id: stableId('historical_flow', `${symbol}|${strike}|${expiry}|${contractType}|${volume}|${premium}`),
      type: volume >= 200 ? 'sweep' : 'block',
      symbol,
      strike: round(strike, 2),
      expiry,
      size: Math.round(volume),
      direction: contractType === 'call' ? 'bullish' : 'bearish',
      premium,
      timestamp: epochToIso(snapshot.last_quote?.last_updated),
    });
  }

  return events
    .sort((a, b) => {
      if (b.premium !== a.premium) return b.premium - a.premium;
      return b.size - a.size;
    })
    .slice(0, MAX_FLOW_EVENTS);
}

function volumeTrendFromBars(bars: Array<{ v: number }>): 'rising' | 'flat' | 'falling' {
  if (bars.length < 15) return 'flat';
  const last = bars.slice(-5).reduce((sum, bar) => sum + bar.v, 0) / 5;
  const prior = bars.slice(-10, -5).reduce((sum, bar) => sum + bar.v, 0) / 5;
  if (!Number.isFinite(last) || !Number.isFinite(prior) || prior <= 0) return 'flat';
  const ratio = last / prior;
  if (ratio > 1.2) return 'rising';
  if (ratio < 0.85) return 'falling';
  return 'flat';
}

function trendStrengthFromBars(
  bars: Array<{ c: number }>,
): number {
  const closes = bars
    .map((bar) => bar.c)
    .filter((value) => Number.isFinite(value) && value > 0);
  if (closes.length < 8) return 0;

  const emaFast = ema(closes, Math.min(EMA_FAST_PERIOD, closes.length));
  const emaSlow = ema(closes, Math.min(EMA_SLOW_PERIOD, closes.length));
  const priorCloses = closes.slice(0, -3);
  const emaFastPrior = priorCloses.length > 0
    ? ema(priorCloses, Math.min(EMA_FAST_PERIOD, priorCloses.length))
    : emaFast;

  const spreadScore = Math.max(0, Math.min(1, Math.abs(emaFast - emaSlow) / 8));
  const slopeScore = Math.max(0, Math.min(1, Math.abs(emaFast - emaFastPrior) / 2.4));
  return round((spreadScore * 0.55) + (slopeScore * 0.45), 4);
}

function toBarHigh(bar: { h?: number; o?: number; c: number }): number {
  if (typeof bar.h === 'number' && Number.isFinite(bar.h)) return bar.h;
  if (typeof bar.o === 'number' && Number.isFinite(bar.o)) return Math.max(bar.o, bar.c);
  return bar.c;
}

function toBarLow(bar: { l?: number; o?: number; c: number }): number {
  if (typeof bar.l === 'number' && Number.isFinite(bar.l)) return bar.l;
  if (typeof bar.o === 'number' && Number.isFinite(bar.o)) return Math.min(bar.o, bar.c);
  return bar.c;
}

interface FibSwingRange {
  swingHigh: number;
  swingLow: number;
  trendUp: boolean;
}

function detectIntradaySwingRange(
  bars: Array<{ h?: number; l?: number; c: number }>,
  confirmationBars: number = FIB_CONFIRMATION_BARS,
): FibSwingRange | null {
  if (bars.length < Math.max(6, confirmationBars + 2)) return null;
  const usable = bars.slice(0, Math.max(1, bars.length - confirmationBars));
  if (usable.length < 4) return null;

  const highs = usable.map((bar) => toBarHigh(bar));
  const lows = usable.map((bar) => toBarLow(bar));
  const swingHigh = Math.max(...highs);
  const swingLow = Math.min(...lows);
  if (!Number.isFinite(swingHigh) || !Number.isFinite(swingLow) || swingHigh <= swingLow) return null;

  return {
    swingHigh,
    swingLow,
    trendUp: usable[usable.length - 1].c >= usable[0].c,
  };
}

function buildIntradayFibSet(
  swing: FibSwingRange,
  timeframe: FibLevel['timeframe'],
): FibLevel[] {
  const range = swing.swingHigh - swing.swingLow;
  if (!Number.isFinite(range) || range <= 0) return [];

  return FIB_INTRADAY_RATIOS.map((ratio) => {
    const isExtension = ratio > 1;
    const price = swing.trendUp
      ? (isExtension
        ? swing.swingHigh + (range * (ratio - 1))
        : swing.swingHigh - (range * ratio))
      : (isExtension
        ? swing.swingLow - (range * (ratio - 1))
        : swing.swingLow + (range * ratio));

    return {
      ratio,
      price: round(price, 2),
      timeframe,
      direction: isExtension ? 'extension' : 'retracement',
      swingHigh: round(swing.swingHigh, 2),
      swingLow: round(swing.swingLow, 2),
      crossValidated: false,
    };
  });
}

function crossValidateIntradayFibLevels(
  spxLevels: FibLevel[],
  spyLevels: FibLevel[],
  basisCurrent: number,
): FibLevel[] {
  return spxLevels.map((spxLevel) => {
    const hasSpyMatch = spyLevels.some((spyLevel) => {
      if (spyLevel.ratio !== spxLevel.ratio) return false;
      const spyAsSpx = (spyLevel.price * SPY_TO_SPX_STRIKE) + basisCurrent;
      return Math.abs(spyAsSpx - spxLevel.price) <= 3.5;
    });
    return hasSpyMatch
      ? { ...spxLevel, crossValidated: true }
      : spxLevel;
  });
}

function buildTimeSlicedFibLevels(input: {
  spxBars: Array<{ c: number; h?: number; l?: number }>;
  spyBars: Array<{ c: number; h?: number; l?: number }>;
  basisCurrent: number;
  referenceLevels: FibLevel[];
}): FibLevel[] {
  const reference = input.referenceLevels.filter((level) => level.timeframe !== 'intraday');
  const spxSwing = detectIntradaySwingRange(input.spxBars);
  const spySwing = detectIntradaySwingRange(input.spyBars);
  if (!spxSwing || !spySwing) {
    return reference;
  }

  const spxIntraday = buildIntradayFibSet(spxSwing, 'intraday');
  const spyIntraday = buildIntradayFibSet(spySwing, 'intraday');
  const crossValidatedIntraday = crossValidateIntradayFibLevels(spxIntraday, spyIntraday, input.basisCurrent);

  return [...reference, ...crossValidatedIntraday].sort((a, b) => a.price - b.price);
}

function buildHistoricalIndicatorContext(input: {
  bars: Array<{ c: number; v: number; t: number; o?: number; h?: number; l?: number }>;
  asOfTimestamp: string;
}): {
  emaFast: number;
  emaSlow: number;
  emaFastSlope: number;
  emaSlowSlope: number;
  atr14: number | null;
  volumeTrend: 'rising' | 'flat' | 'falling';
  sessionOpenPrice: number;
  orbHigh: number;
  orbLow: number;
  minutesSinceOpen: number;
  sessionOpenTimestamp: string;
  asOfTimestamp: string;
  vwapPrice: number | null;
  vwapDeviation: number | null;
  vwapBand1SD: {
    upper: number;
    lower: number;
  } | null;
  vwapBand15SD: {
    upper: number;
    lower: number;
  } | null;
  vwapBand2SD: {
    upper: number;
    lower: number;
  } | null;
  latestBar: {
    t: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
  } | null;
  priorBar: {
    t: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
  } | null;
  avgRecentVolume: number | null;
} | null {
  const usable = input.bars
    .filter((bar) => Number.isFinite(bar.c) && bar.c > 0)
    .map((bar) => ({
      ...bar,
      v: Number.isFinite(bar.v) && bar.v > 0 ? bar.v : 0,
    }));
  if (usable.length < 8) return null;

  const closes = usable.map((bar) => bar.c);
  const emaFast = ema(closes, Math.min(EMA_FAST_PERIOD, closes.length));
  const emaSlow = ema(closes, Math.min(EMA_SLOW_PERIOD, closes.length));

  const prior = closes.slice(0, -1);
  const emaFastPrior = prior.length > 0 ? ema(prior, Math.min(EMA_FAST_PERIOD, prior.length)) : emaFast;
  const emaSlowPrior = prior.length > 0 ? ema(prior, Math.min(EMA_SLOW_PERIOD, prior.length)) : emaSlow;
  const firstBar = usable[0];
  const asOfMsRaw = Date.parse(input.asOfTimestamp);
  const asOfMs = Number.isFinite(asOfMsRaw) ? asOfMsRaw : usable[usable.length - 1].t;
  const minutesSinceOpen = Math.max(0, Math.floor((asOfMs - firstBar.t) / 60_000));
  const orbWindowEnd = firstBar.t + (ORB_WINDOW_MINUTES * 60_000);
  const orbBars = usable.filter((bar) => bar.t <= orbWindowEnd);
  const orbHigh = orbBars.reduce((max, bar) => Math.max(max, toBarHigh(bar)), Number.NEGATIVE_INFINITY);
  const orbLow = orbBars.reduce((min, bar) => Math.min(min, toBarLow(bar)), Number.POSITIVE_INFINITY);
  const sessionOpenPrice = typeof firstBar.o === 'number' && Number.isFinite(firstBar.o)
    ? firstBar.o
    : firstBar.c;

  const vwapBars = usable.map((bar) => ({
    h: typeof bar.h === 'number' && Number.isFinite(bar.h) ? bar.h : bar.c,
    l: typeof bar.l === 'number' && Number.isFinite(bar.l) ? bar.l : bar.c,
    c: bar.c,
    v: bar.v,
    vw: 0,
    o: typeof bar.o === 'number' && Number.isFinite(bar.o) ? bar.o : bar.c,
    t: bar.t,
    n: 0,
  }));
  const vwapPrice = calculateVWAP(vwapBars);
  const vwapBandSet = calculateVWAPBandSet(vwapBars);
  const lastClose = closes[closes.length - 1];
  const vwapPosition = vwapPrice != null ? analyzeVWAPPosition(lastClose, vwapPrice) : null;
  const atr14 = calculateAtrFromBars(usable, 14);
  const latestBarRaw = usable[usable.length - 1];
  const priorBarRaw = usable.length > 1 ? usable[usable.length - 2] : null;
  const toTriggerBar = (bar: { t: number; o?: number; h?: number; l?: number; c: number; v?: number } | null) => {
    if (!bar) return null;
    const open = typeof bar.o === 'number' && Number.isFinite(bar.o) ? bar.o : bar.c;
    const high = typeof bar.h === 'number' && Number.isFinite(bar.h) ? bar.h : Math.max(open, bar.c);
    const low = typeof bar.l === 'number' && Number.isFinite(bar.l) ? bar.l : Math.min(open, bar.c);
    const volume = Number.isFinite(bar.v) && (bar.v ?? 0) > 0 ? (bar.v as number) : 0;
    return {
      t: bar.t,
      o: round(open, 4),
      h: round(high, 4),
      l: round(low, 4),
      c: round(bar.c, 4),
      v: Math.max(0, round(volume, 2)),
    };
  };
  const recentVolumeBars = usable.slice(-20);
  const avgRecentVolume = recentVolumeBars.length > 0
    ? round(recentVolumeBars.reduce((sum, bar) => sum + bar.v, 0) / recentVolumeBars.length, 2)
    : null;

  return {
    emaFast: round(emaFast, 2),
    emaSlow: round(emaSlow, 2),
    emaFastSlope: round(emaFast - emaFastPrior, 4),
    emaSlowSlope: round(emaSlow - emaSlowPrior, 4),
    atr14: atr14 != null ? round(atr14, 4) : null,
    volumeTrend: volumeTrendFromBars(usable),
    sessionOpenPrice: round(sessionOpenPrice, 2),
    orbHigh: round(Number.isFinite(orbHigh) ? orbHigh : sessionOpenPrice, 2),
    orbLow: round(Number.isFinite(orbLow) ? orbLow : sessionOpenPrice, 2),
    minutesSinceOpen,
    sessionOpenTimestamp: new Date(firstBar.t).toISOString(),
    asOfTimestamp: input.asOfTimestamp,
    vwapPrice: vwapPrice != null ? round(vwapPrice, 2) : null,
    vwapDeviation: vwapPosition != null ? round(vwapPosition.distancePct, 4) : null,
    vwapBand1SD: vwapBandSet
      ? {
        upper: round(vwapBandSet.band1SD.upper, 2),
        lower: round(vwapBandSet.band1SD.lower, 2),
      }
      : null,
    vwapBand15SD: vwapBandSet
      ? {
        upper: round(vwapBandSet.band15SD.upper, 2),
        lower: round(vwapBandSet.band15SD.lower, 2),
      }
      : null,
    vwapBand2SD: vwapBandSet
      ? {
        upper: round(vwapBandSet.band2SD.upper, 2),
        lower: round(vwapBandSet.band2SD.lower, 2),
      }
      : null,
    latestBar: toTriggerBar(latestBarRaw),
    priorBar: toTriggerBar(priorBarRaw),
    avgRecentVolume,
  };
}

function sortBarsByTimestamp<T extends { t: number }>(bars: T[]): T[] {
  return [...bars].sort((a, b) => a.t - b.t);
}

function resolveInitialSpotFromBars(
  bars: Array<{ c: number }>,
  fallback: number,
): number {
  for (const bar of bars) {
    if (Number.isFinite(bar.c) && bar.c > 0) return bar.c;
  }
  return fallback;
}

function toEpochMs(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeObservedSetup(existing: Setup | undefined, incoming: Setup): Setup {
  if (!existing) return incoming;

  const existingTerminal = existing.status === 'expired' || existing.status === 'invalidated';
  const incomingTerminal = incoming.status === 'expired' || incoming.status === 'invalidated';
  const statusUpdatedExisting = toEpochMs(existing.statusUpdatedAt || existing.createdAt);
  const statusUpdatedIncoming = toEpochMs(incoming.statusUpdatedAt || incoming.createdAt);
  const preferIncoming = incomingTerminal
    || (!existingTerminal && statusUpdatedIncoming >= statusUpdatedExisting);
  const base = preferIncoming ? incoming : existing;

  const createdAt = toEpochMs(existing.createdAt) > 0 && toEpochMs(existing.createdAt) < toEpochMs(incoming.createdAt)
    ? existing.createdAt
    : incoming.createdAt;

  return {
    ...base,
    createdAt,
    triggeredAt: existing.triggeredAt || incoming.triggeredAt,
  };
}

async function purgeHistoricalSetupRows(from: string, to: string): Promise<void> {
  const { error } = await supabase
    .from('spx_setup_instances')
    .delete()
    .gte('session_date', from)
    .lte('session_date', to);

  if (!error) return;
  if (isMissingTableError(error.message)) {
    logger.warn('spx_setup_instances table missing during historical setup purge');
    return;
  }

  throw new Error(`Failed to purge historical spx_setup_instances rows: ${error.message}`);
}

async function buildHistoricalLevelData(
  asOfDate: string,
  gex: UnifiedGEXLandscape,
): Promise<{ levels: SPXLevel[]; clusters: ReturnType<typeof buildClusterZones>; generatedAt: string } | null> {
  const [spxLegacy, spyLegacy] = await Promise.all([
    calculateLevels('SPX', 'intraday', { asOfDate }),
    calculateLevels('SPY', 'intraday', { asOfDate }),
  ]);

  const basis = gex.spx.spotPrice - (gex.spy.spotPrice * SPY_TO_SPX_STRIKE);
  const spxLevels = [...spxLegacy.levels.resistance, ...spxLegacy.levels.support]
    .map((level) => mapLegacyLevel('SPX', level, mapLevelCategory(level.type)));
  const spyLevels = [...spyLegacy.levels.resistance, ...spyLegacy.levels.support]
    .map((level) => mapLegacyLevel('SPY', level, 'spy_derived', (level.price * SPY_TO_SPX_STRIKE) + basis));

  const optionsLevels: SPXLevel[] = [
    {
      id: stableId('historical_level', `spx_call_wall|${asOfDate}|${gex.spx.callWall}`),
      symbol: 'SPX',
      category: 'options',
      source: 'spx_call_wall',
      price: gex.spx.callWall,
      strength: 'critical',
      timeframe: '0dte',
      metadata: { gex: gex.spx.netGex },
      chartStyle: chartStyle('options'),
    },
    {
      id: stableId('historical_level', `spx_put_wall|${asOfDate}|${gex.spx.putWall}`),
      symbol: 'SPX',
      category: 'options',
      source: 'spx_put_wall',
      price: gex.spx.putWall,
      strength: 'critical',
      timeframe: '0dte',
      metadata: { gex: gex.spx.netGex },
      chartStyle: chartStyle('options'),
    },
    {
      id: stableId('historical_level', `spx_flip|${asOfDate}|${gex.spx.flipPoint}`),
      symbol: 'SPX',
      category: 'options',
      source: 'spx_flip_point',
      price: gex.spx.flipPoint,
      strength: 'dynamic',
      timeframe: '0dte',
      metadata: { gex: gex.spx.netGex },
      chartStyle: chartStyle('options'),
    },
  ];

  const allLevels = [...spxLevels, ...spyLevels, ...optionsLevels].sort((a, b) => a.price - b.price);
  if (allLevels.length === 0) return null;

  return {
    levels: allLevels,
    clusters: buildClusterZones(allLevels),
    generatedAt: `${asOfDate}T20:00:00.000Z`,
  };
}

export async function reconstructHistoricalSPXSetupsForDate(asOfDate: string): Promise<{
  setupsGenerated: number;
  setupsTriggeredAtGeneration: number;
}> {
  const [spxMinuteBarsRaw, spyMinuteBarsRaw] = await Promise.all([
    getMinuteAggregates('I:SPX', asOfDate),
    getMinuteAggregates('SPY', asOfDate),
  ]);

  const spxMinuteBars = sortBarsByTimestamp(spxMinuteBarsRaw);
  if (spxMinuteBars.length === 0) {
    logger.info('Historical SPX reconstruction skipped (no SPX bars for date)', {
      asOfDate,
    });
    return { setupsGenerated: 0, setupsTriggeredAtGeneration: 0 };
  }

  const spyMinuteBars = sortBarsByTimestamp(spyMinuteBarsRaw);
  const [spxSnapshots, spySnapshots] = await Promise.all([
    getOptionsSnapshotAtDate('SPX', asOfDate),
    getOptionsSnapshotAtDate('SPY', asOfDate),
  ]);
  const initialSpxSpot = resolveInitialSpotFromBars(spxMinuteBars, spxMinuteBars[0]?.o || 0);
  if (!Number.isFinite(initialSpxSpot) || initialSpxSpot <= 0) {
    return { setupsGenerated: 0, setupsTriggeredAtGeneration: 0 };
  }
  const initialSpySpot = resolveInitialSpotFromBars(spyMinuteBars, initialSpxSpot / SPY_TO_SPX_STRIKE);

  const baseGex = buildHistoricalGEXLandscape({
    asOfDate,
    spxSpotPrice: initialSpxSpot,
    spySpotPrice: initialSpySpot,
    spxSnapshots,
    spySnapshots,
  });
  const basisCurrent = round(baseGex.spx.spotPrice - (baseGex.spy.spotPrice * SPY_TO_SPX_STRIKE), 2);
  const fibReferenceDate = shiftDate(asOfDate, -1);
  let referenceFibLevels = await getFibLevels({
    forceRefresh: true,
    asOfDate: fibReferenceDate,
    basisCurrent,
  });
  if (referenceFibLevels.length === 0) {
    referenceFibLevels = await getFibLevels({
      forceRefresh: true,
      asOfDate,
      basisCurrent,
    });
  }

  const levelData = await buildHistoricalLevelData(asOfDate, baseGex);
  if (!levelData) {
    return { setupsGenerated: 0, setupsTriggeredAtGeneration: 0 };
  }

  const [intervalizedSPXFlow, intervalizedSPYFlow] = await Promise.all([
    flowFromIntervalizedContracts({
      symbol: 'SPX',
      asOfDate,
      snapshots: spxSnapshots,
    }),
    flowFromIntervalizedContracts({
      symbol: 'SPY',
      asOfDate,
      snapshots: spySnapshots,
    }),
  ]);
  const flowEvents = [
    ...intervalizedSPXFlow,
    ...intervalizedSPYFlow,
  ];

  if (flowEvents.length === 0) {
    flowEvents.push(
      ...flowFromSnapshots('SPX', spxSnapshots),
      ...flowFromSnapshots('SPY', spySnapshots),
    );
  }
  logger.info('Historical flow reconstruction complete', {
    asOfDate,
    intervalizedSPXEvents: intervalizedSPXFlow.length,
    intervalizedSPYEvents: intervalizedSPYFlow.length,
    flowEventsUsed: flowEvents.length,
  });
  const flowEventsByTimestamp = flowEvents
    .map((event) => ({
      event,
      timestampMs: Date.parse(event.timestamp),
    }))
    .filter((row) => Number.isFinite(row.timestampMs))
    .sort((a, b) => a.timestampMs - b.timestampMs);

  let previousSetups: Setup[] = [];
  const observedSetupsById = new Map<string, Setup>();
  let spyIndex = 0;
  let flowIndex = 0;
  const flowEventsSeen: SPXFlowEvent[] = [];
  let simulatedBars = 0;
  let lastTimestampIso: string | null = null;

  for (let index = 0; index < spxMinuteBars.length; index += 1) {
    const spxBar = spxMinuteBars[index];
    if (!Number.isFinite(spxBar.c) || spxBar.c <= 0) continue;

    while (spyIndex + 1 < spyMinuteBars.length && spyMinuteBars[spyIndex + 1].t <= spxBar.t) {
      spyIndex += 1;
    }
    const spyBar = spyMinuteBars[spyIndex];
    const spySpot = spyBar && Number.isFinite(spyBar.c) && spyBar.c > 0
      ? spyBar.c
      : initialSpySpot;

    const timestampIso = new Date(spxBar.t).toISOString();
    lastTimestampIso = timestampIso;
    while (flowIndex < flowEventsByTimestamp.length && flowEventsByTimestamp[flowIndex].timestampMs <= spxBar.t) {
      flowEventsSeen.push(flowEventsByTimestamp[flowIndex].event);
      flowIndex += 1;
    }
    const spxBarsToNow = spxMinuteBars.slice(0, index + 1);
    const spyBarsToNow = spyMinuteBars.length > 0
      ? spyMinuteBars.slice(0, Math.max(1, spyIndex + 1))
      : [];

    const gexAtBar = withUpdatedSpotPrices(baseGex, {
      spxSpotPrice: spxBar.c,
      spySpotPrice: spySpot,
      timestampIso,
    });
    const basisAtBar = round(gexAtBar.spx.spotPrice - (gexAtBar.spy.spotPrice * SPY_TO_SPX_STRIKE), 2);
    const fibLevelsAtBar = buildTimeSlicedFibLevels({
      spxBars: spxBarsToNow,
      spyBars: spyBarsToNow,
      basisCurrent: basisAtBar,
      referenceLevels: referenceFibLevels,
    });
    const volumeTrendAtBar = volumeTrendFromBars(spxBarsToNow);
    const trendStrengthAtBar = trendStrengthFromBars(spxBarsToNow);
    const regimeState: RegimeState = await classifyCurrentRegime({
      forceRefresh: true,
      gexLandscape: gexAtBar,
      levelData,
      volumeTrend: volumeTrendAtBar,
      trendStrength: trendStrengthAtBar,
    });

    previousSetups = await detectActiveSetups({
      forceRefresh: true,
      asOfTimestamp: timestampIso,
      previousSetups,
      persistForWinRate: false,
      levelData,
      gexLandscape: gexAtBar,
      fibLevels: fibLevelsAtBar,
      regimeState,
      flowEvents: flowEventsSeen,
      indicatorContext: buildHistoricalIndicatorContext({
        bars: spxBarsToNow,
        asOfTimestamp: timestampIso,
      }),
    });
    for (const setup of previousSetups) {
      observedSetupsById.set(
        setup.id,
        mergeObservedSetup(observedSetupsById.get(setup.id), setup),
      );
    }
    simulatedBars += 1;
  }

  const observedSetups = Array.from(observedSetupsById.values());
  await persistSetupInstancesForWinRate(observedSetups, {
    observedAt: lastTimestampIso || `${asOfDate}T21:00:00.000Z`,
  });
  const backtest = await runSPXWinRateBacktest({
    from: asOfDate,
    to: asOfDate,
    source: 'spx_setup_instances',
    resolution: 'second',
    includeRows: true,
    includePausedSetups: true,
  });
  await persistBacktestRowsForWinRate(backtest.rows || [], {
    observedAt: lastTimestampIso || `${asOfDate}T21:00:00.000Z`,
  });

  logger.info('Historical SPX setup reconstruction replay complete', {
    asOfDate,
    simulatedBars,
    finalSetupCount: observedSetups.length,
    backtestTriggeredCount: backtest.analytics.triggeredCount,
    backtestT1WinRatePct: backtest.analytics.t1WinRatePct,
    backtestT2WinRatePct: backtest.analytics.t2WinRatePct,
  });

  return {
    setupsGenerated: observedSetups.length,
    setupsTriggeredAtGeneration: backtest.analytics.triggeredCount,
  };
}

export async function backfillHistoricalSPXSetupInstances(input: {
  from: string;
  to: string;
}): Promise<HistoricalBackfillSummary> {
  const dates = dateRangeInclusive(input.from, input.to);
  const rows: HistoricalBackfillRow[] = [];
  await purgeHistoricalSetupRows(input.from, input.to);

  for (const date of dates) {
    const row: HistoricalBackfillRow = {
      date,
      setupsGenerated: 0,
      setupsTriggeredAtGeneration: 0,
      errors: [],
    };

    try {
      const result = await reconstructHistoricalSPXSetupsForDate(date);
      row.setupsGenerated = result.setupsGenerated;
      row.setupsTriggeredAtGeneration = result.setupsTriggeredAtGeneration;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      row.errors.push(message);
      logger.warn('Historical SPX setup reconstruction failed for date', {
        date,
        error: message,
      });
    }

    rows.push(row);
  }

  const successfulDays = rows.filter((row) => row.errors.length === 0).length;
  return {
    from: input.from,
    to: input.to,
    rows,
    attemptedDays: rows.length,
    successfulDays,
    failedDays: rows.length - successfulDays,
  };
}
