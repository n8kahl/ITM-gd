import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import { logger } from '../lib/logger';

dotenv.config();

// ============================================
// TYPES
// ============================================

export interface FREDReleaseDate {
  release_id: number;
  release_name: string;
  release_last_updated: string;
  date: string; // ISO date
}

export interface FREDRelease {
  id: number;
  realtime_start: string;
  realtime_end: string;
  name: string;
  press_release: boolean;
  link?: string;
  notes?: string;
}

export interface FREDObservation {
  realtime_start: string;
  realtime_end: string;
  date: string;
  value: string; // FRED returns numeric values as strings
}

// ============================================
// HIGH-IMPACT RELEASE MAPPING
// ============================================

/**
 * Curated map of FRED release IDs to human-readable names, impact levels,
 * and linked series IDs for fetching previous values.
 */
export interface ReleaseMapping {
  releaseId: number;
  name: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  seriesId: string;       // Primary series for "previous" value
  relevance: string;      // Why this matters for options traders
}

export const HIGH_IMPACT_RELEASES: ReleaseMapping[] = [
  {
    releaseId: 10,
    name: 'Consumer Price Index (CPI)',
    impact: 'HIGH',
    seriesId: 'CPIAUCSL',
    relevance: 'Key inflation measure — affects Fed policy, rate expectations, and IV levels',
  },
  {
    releaseId: 50,
    name: 'Employment Situation (NFP)',
    impact: 'HIGH',
    seriesId: 'PAYEMS',
    relevance: 'Nonfarm payrolls + unemployment — signals economic strength, moves all markets',
  },
  {
    releaseId: 53,
    name: 'GDP (Quarterly)',
    impact: 'HIGH',
    seriesId: 'GDP',
    relevance: 'Overall economic output — impacts growth expectations and equity valuations',
  },
  {
    releaseId: 21,
    name: 'Federal Reserve (FOMC)',
    impact: 'HIGH',
    seriesId: 'FEDFUNDS',
    relevance: 'Rate decision and forward guidance — primary driver of IV and equity direction',
  },
  {
    releaseId: 46,
    name: 'Producer Price Index (PPI)',
    impact: 'MEDIUM',
    seriesId: 'PPIFIS',
    relevance: 'Wholesale inflation — leading indicator for consumer inflation (CPI)',
  },
  {
    releaseId: 9,
    name: 'Retail Sales',
    impact: 'MEDIUM',
    seriesId: 'RSAFS',
    relevance: 'Consumer spending indicator — signals economic momentum',
  },
  {
    releaseId: 320,
    name: 'Personal Consumption Expenditures (PCE)',
    impact: 'HIGH',
    seriesId: 'PCE',
    relevance: "Fed's preferred inflation gauge — directly influences rate policy",
  },
  {
    releaseId: 29,
    name: 'ISM Manufacturing PMI',
    impact: 'HIGH',
    seriesId: 'MANEMP',
    relevance: 'Leading indicator of manufacturing sector health — signals economic direction',
  },
  {
    releaseId: 299,
    name: 'Consumer Sentiment',
    impact: 'MEDIUM',
    seriesId: 'UMCSENT',
    relevance: 'Consumer confidence — forward-looking indicator for spending and growth',
  },
];

/** Lookup by release ID for fast filtering */
export const RELEASE_MAP = new Map(
  HIGH_IMPACT_RELEASES.map((r) => [r.releaseId, r]),
);

// ============================================
// CLIENT
// ============================================

const FRED_BASE_URL = 'https://api.stlouisfed.org/fred';

export const fredClient: AxiosInstance = axios.create({
  baseURL: FRED_BASE_URL,
  timeout: 15000,
});

fredClient.interceptors.request.use(
  (config) => {
    const apiKey = process.env.FRED_API_KEY;

    if (!apiKey) {
      return Promise.reject(new Error(
        'FRED_API_KEY is not configured. FRED economic calendar features require a valid API key.'
      ));
    }

    // FRED uses query-param auth + file_type=json
    config.params = { ...config.params, api_key: apiKey, file_type: 'json' };

    logger.debug(`FRED API Request: ${config.method?.toUpperCase()} ${config.url}`, {
      params: { ...config.params, api_key: '***' },
    });

    return config;
  },
  (error) => Promise.reject(error),
);

fredClient.interceptors.response.use(
  (response) => response,
  (error) => {
    logger.error('FRED API Error', {
      status: error.response?.status,
      url: error.config?.url,
      data: error.response?.data || error.message,
    });
    return Promise.reject(error);
  },
);

// ============================================
// FUNCTIONS
// ============================================

/**
 * Fetch upcoming release dates from FRED.
 * Returns all scheduled economic data releases in the date range.
 */
export async function getUpcomingReleaseDates(
  from: string,
  to: string,
): Promise<FREDReleaseDate[]> {
  if (!process.env.FRED_API_KEY) {
    logger.debug('FRED skipped: no API key configured');
    return [];
  }

  try {
    const response = await fredClient.get<{ release_dates: FREDReleaseDate[] }>('/releases/dates', {
      params: {
        realtime_start: from,
        realtime_end: to,
        include_release_dates_with_no_data: 'true',
      },
    });

    const dates = response.data?.release_dates || [];
    logger.info('FRED release dates fetched', { from, to, count: dates.length });
    return dates;
  } catch (error: any) {
    logger.error('FRED release dates fetch failed', {
      error: error?.message || String(error),
    });
    return [];
  }
}

/**
 * Fetch the latest observations for a given FRED series (e.g. CPIAUCSL, FEDFUNDS).
 * Used to populate "previous" values in the economic calendar.
 */
export async function getSeriesObservations(
  seriesId: string,
  limit: number = 3,
): Promise<FREDObservation[]> {
  if (!process.env.FRED_API_KEY) return [];

  try {
    const response = await fredClient.get<{ observations: FREDObservation[] }>('/series/observations', {
      params: {
        series_id: seriesId,
        sort_order: 'desc',
        limit,
      },
    });

    return response.data?.observations || [];
  } catch (error: any) {
    logger.error('FRED series observations fetch failed', {
      seriesId,
      error: error?.message || String(error),
    });
    return [];
  }
}

/**
 * Fetch metadata for a specific FRED release.
 */
export async function getReleaseMeta(releaseId: number): Promise<FREDRelease | null> {
  if (!process.env.FRED_API_KEY) return null;

  try {
    const response = await fredClient.get<{ releases: FREDRelease[] }>('/releases', {
      params: { release_id: releaseId },
    });

    const releases = response.data?.releases || [];
    return releases[0] || null;
  } catch (error: any) {
    logger.error('FRED release meta fetch failed', {
      releaseId,
      error: error?.message || String(error),
    });
    return null;
  }
}

/**
 * Test FRED API connection by fetching a small set of release dates.
 */
export async function testFREDConnection(): Promise<{ ok: boolean; message: string; sampleCount?: number }> {
  try {
    const now = new Date();
    const from = now.toISOString().slice(0, 10);
    const to = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const dates = await getUpcomingReleaseDates(from, to);

    return {
      ok: true,
      message: `FRED connection successful. ${dates.length} release dates in next 7 days.`,
      sampleCount: dates.length,
    };
  } catch (error: any) {
    return {
      ok: false,
      message: `FRED connection failed: ${error?.message || String(error)}`,
    };
  }
}
