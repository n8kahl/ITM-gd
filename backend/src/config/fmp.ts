import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import { logger } from '../lib/logger';

dotenv.config();

// ============================================
// TYPES
// ============================================

export interface FMPEarningsEvent {
  symbol: string;
  date: string;
  epsActual: number | null;
  epsEstimated: number | null;
  revenueActual: number | null;
  revenueEstimated: number | null;
  lastUpdated: string;
}

// ============================================
// RATE LIMITING
// ============================================

/** Free tier: 250 calls/day */
const DAILY_CALL_LIMIT = 250;
const DAILY_CALL_WARNING_THRESHOLD = 200;

let dailyCallCount = 0;
let dailyCallResetDate = new Date().toISOString().slice(0, 10);

function trackCall(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dailyCallResetDate) {
    dailyCallCount = 0;
    dailyCallResetDate = today;
  }

  dailyCallCount++;

  if (dailyCallCount >= DAILY_CALL_LIMIT) {
    logger.error('FMP daily call limit reached', { dailyCallCount, limit: DAILY_CALL_LIMIT });
    return false;
  }

  if (dailyCallCount >= DAILY_CALL_WARNING_THRESHOLD) {
    logger.warn('FMP daily call count approaching limit', { dailyCallCount, limit: DAILY_CALL_LIMIT });
  }

  return true;
}

// ============================================
// CLIENT
// ============================================

const FMP_BASE_URL = 'https://financialmodelingprep.com/stable';

export const fmpClient: AxiosInstance = axios.create({
  baseURL: FMP_BASE_URL,
  timeout: 15000,
});

fmpClient.interceptors.request.use(
  (config) => {
    const apiKey = process.env.FMP_API_KEY;

    if (!apiKey) {
      return Promise.reject(new Error(
        'FMP_API_KEY is not configured. FMP earnings features require a valid API key.'
      ));
    }

    // Inject API key as query param (FMP uses query-param auth)
    config.params = { ...config.params, apikey: apiKey };

    logger.debug(`FMP API Request: ${config.method?.toUpperCase()} ${config.url}`, {
      params: { ...config.params, apikey: '***' },
    });

    return config;
  },
  (error) => Promise.reject(error),
);

fmpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;

    if (status === 403) {
      logger.error('FMP API: endpoint restricted on current plan', { url: error.config?.url, data });
    } else {
      logger.error('FMP API Error', { status, url: error.config?.url, data: data || error.message });
    }

    return Promise.reject(error);
  },
);

// ============================================
// FUNCTIONS
// ============================================

/**
 * Fetch earnings calendar from FMP.
 * Free tier: 250 calls/day, max 90-day date range per request.
 * Note: FMP does NOT provide BMO/AMC timing — only the date.
 */
export async function getFMPEarningsCalendar(
  from: string,
  to: string,
): Promise<FMPEarningsEvent[]> {
  if (!process.env.FMP_API_KEY) {
    logger.debug('FMP skipped: no API key configured');
    return [];
  }

  if (!trackCall()) {
    logger.warn('FMP earnings calendar skipped: daily call limit reached');
    return [];
  }

  try {
    const response = await fmpClient.get<FMPEarningsEvent[]>('/earnings-calendar', {
      params: { from, to },
    });

    const events = Array.isArray(response.data) ? response.data : [];
    logger.info('FMP earnings calendar fetched', { from, to, count: events.length });
    return events;
  } catch (error: any) {
    logger.error('FMP earnings calendar fetch failed', {
      error: error?.message || String(error),
      from,
      to,
    });
    return [];
  }
}

/**
 * Test FMP API connection by making a minimal calendar call.
 */
export async function testFMPConnection(): Promise<{ ok: boolean; message: string; sampleCount?: number }> {
  try {
    const now = new Date();
    const from = now.toISOString().slice(0, 10);
    const to = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const events = await getFMPEarningsCalendar(from, to);

    return {
      ok: true,
      message: `FMP connection successful. ${events.length} earnings events in next 7 days.`,
      sampleCount: events.length,
    };
  } catch (error: any) {
    return {
      ok: false,
      message: `FMP connection failed: ${error?.message || String(error)}`,
    };
  }
}
