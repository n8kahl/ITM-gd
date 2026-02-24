import { cacheGet, cacheSet } from '../../config/redis';
import { getMarketStatusLive } from '../../config/massive';
import { logger } from '../../lib/logger';
import { getMarketStatus, toEasternTime } from '../marketHours';

const MARKET_SESSION_CACHE_KEY = 'spx:market_session';
const MARKET_SESSION_CACHE_TTL_SECONDS = 30;
const LIVE_STATUS_TIMEOUT_MS = 1_500;
const REGULAR_OPEN_MINUTE_ET = (9 * 60) + 30;
const REGULAR_CLOSE_MINUTE_ET = 16 * 60;
const EARLY_CLOSE_MINUTE_ET = 13 * 60;

export type SPXMarketSessionPhase = 'pre_market' | 'open' | 'after_hours' | 'closed';

export interface SPXMarketSessionStatus {
  status: SPXMarketSessionPhase;
  market: string | null;
  minuteEt: number;
  minutesUntilClose: number | null;
  sessionProgress: number;
  source: 'local' | 'massive' | 'cached';
  asOf: string;
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error('marketstatus_live_timeout')), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  });
}

function regularCloseMinuteFromMessage(message: string): number {
  return message.includes('1:00 PM ET') ? EARLY_CLOSE_MINUTE_ET : REGULAR_CLOSE_MINUTE_ET;
}

function buildLocalSessionStatus(evaluationDate: Date): SPXMarketSessionStatus {
  const et = toEasternTime(evaluationDate);
  const minuteEt = (et.hour * 60) + et.minute;
  const localStatus = getMarketStatus(evaluationDate);

  const phase: SPXMarketSessionPhase = (
    localStatus.status === 'pre-market'
      ? 'pre_market'
      : localStatus.status === 'after-hours'
        ? 'after_hours'
        : localStatus.status === 'open'
          ? 'open'
          : 'closed'
  );

  let minutesUntilClose: number | null = null;
  let sessionProgress = 0;

  if (phase === 'open') {
    const closeMinute = regularCloseMinuteFromMessage(localStatus.message);
    minutesUntilClose = Math.max(0, closeMinute - minuteEt);
    sessionProgress = clamp(((minuteEt - REGULAR_OPEN_MINUTE_ET) / (closeMinute - REGULAR_OPEN_MINUTE_ET)) * 100, 0, 100);
  } else if (phase === 'pre_market') {
    sessionProgress = clamp(((minuteEt - (4 * 60)) / (REGULAR_OPEN_MINUTE_ET - (4 * 60))) * 100, 0, 100);
  } else if (phase === 'after_hours') {
    sessionProgress = 100;
  }

  return {
    status: phase,
    market: localStatus.status,
    minuteEt,
    minutesUntilClose,
    sessionProgress: Number(sessionProgress.toFixed(2)),
    source: 'local',
    asOf: evaluationDate.toISOString(),
  };
}

function normalizeLiveMarket(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = (raw as { market?: unknown }).market;
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim().toLowerCase();
  }

  const nyse = (raw as { exchanges?: { nyse?: unknown } }).exchanges?.nyse;
  if (typeof nyse === 'string' && nyse.trim().length > 0) {
    return nyse.trim().toLowerCase();
  }

  return null;
}

function applyLiveOverlay(base: SPXMarketSessionStatus, livePayload: unknown): SPXMarketSessionStatus {
  const market = normalizeLiveMarket(livePayload);
  if (!market) {
    return base;
  }

  if (market === 'open') {
    return {
      ...base,
      status: 'open',
      market,
      source: 'massive',
    };
  }

  if (market === 'closed') {
    const overlayStatus: SPXMarketSessionPhase = (
      base.status === 'pre_market' || base.status === 'after_hours'
        ? base.status
        : 'closed'
    );

    return {
      ...base,
      status: overlayStatus,
      market,
      source: 'massive',
      minutesUntilClose: null,
    };
  }

  return {
    ...base,
    market,
    source: 'massive',
  };
}

export async function getSPXMarketSessionStatus(options?: {
  forceRefresh?: boolean;
  evaluationDate?: Date;
  preferLive?: boolean;
}): Promise<SPXMarketSessionStatus> {
  const evaluationDate = options?.evaluationDate ?? new Date();
  const forceRefresh = options?.forceRefresh === true;
  const preferLive = options?.preferLive ?? parseBooleanEnv(process.env.SPX_ENVIRONMENT_LIVE_SESSION_ENABLED, false);

  if (!forceRefresh) {
    const cached = await cacheGet<SPXMarketSessionStatus>(MARKET_SESSION_CACHE_KEY);
    if (cached && typeof cached === 'object' && typeof cached.status === 'string') {
      return {
        ...cached,
        source: 'cached',
      };
    }
  }

  const local = buildLocalSessionStatus(evaluationDate);
  let resolved = local;

  if (preferLive) {
    try {
      const livePayload = await withTimeout(getMarketStatusLive(), LIVE_STATUS_TIMEOUT_MS);
      resolved = applyLiveOverlay(local, livePayload);
    } catch (error) {
      logger.debug('SPX market session live status unavailable, using local fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await cacheSet(MARKET_SESSION_CACHE_KEY, resolved, MARKET_SESSION_CACHE_TTL_SECONDS).catch((error) => {
    logger.warn('SPX market session cache write failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return resolved;
}
