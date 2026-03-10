
'use client'

import useSWR from 'swr';
import { useMemberAuth } from '@/contexts/MemberAuthContext';

type MarketKey = [url: string, token: string];

const FORCE_DIRECT_MARKET_API = process.env.NEXT_PUBLIC_FORCE_DIRECT_MARKET_API === 'true';
const DIRECT_MARKET_API_BASE = (process.env.NEXT_PUBLIC_AI_COACH_API_URL || '').replace(/\/+$/, '');
const MARKET_FALLBACK_POLL_MS = 60_000;
const MARKET_SWR_BASE_CONFIG = {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
} as const;

function resolveMarketUrl(url: string): string {
    // Keep same-origin /api/market by default so mobile + desktop share auth and transport behavior.
    if (FORCE_DIRECT_MARKET_API && DIRECT_MARKET_API_BASE && url.startsWith('/api/market/')) {
        return `${DIRECT_MARKET_API_BASE}${url}`;
    }
    return url;
}

function parseJsonBody(rawBody: string): any | null {
    if (!rawBody) return null;

    try {
        return JSON.parse(rawBody);
    } catch {
        return null;
    }
}

function getErrorDetail(body: any): string {
    if (body && typeof body.message === 'string') return body.message;
    if (body && typeof body.error === 'string') return body.error;
    return '';
}

function hasFallbackSource(value: unknown): boolean {
    return typeof value === 'object'
        && value !== null
        && (value as { source?: unknown }).source === 'fallback';
}

function buildMarketFallback(url: string): any {
    const timestamp = new Date().toISOString();

    if (url.includes('/api/market/indices')) {
        return { quotes: [], metrics: { vwap: null }, source: 'fallback' };
    }

    if (url.includes('/api/market/status')) {
        return {
            status: 'closed',
            session: 'none',
            message: 'Market data temporarily unavailable',
            nextOpen: 'Check data provider status',
            source: 'fallback',
        };
    }

    if (url.includes('/api/market/movers')) {
        return { gainers: [], losers: [], source: 'fallback' };
    }

    if (url.includes('/api/market/analytics')) {
        return {
            timestamp,
            status: { isOpen: false, session: 'none', message: 'Market analytics temporarily unavailable' },
            indices: [],
            regime: {
                label: 'Neutral',
                description: 'Live analytics unavailable; using safe neutral fallback.',
                signals: ['Data provider unavailable'],
            },
            breadth: { advancers: 0, decliners: 0, ratio: 0, label: 'Unavailable' },
            source: 'fallback',
        };
    }

    if (url.includes('/api/market/splits') || url.includes('/api/market/holidays')) {
        return [];
    }

    return { source: 'fallback' };
}

const fetcher = async (key: MarketKey) => {
    const [url, token] = key;
    const targetUrl = resolveMarketUrl(url);

    let res: Response;
    try {
        res = await fetch(targetUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
        });
    } catch {
        return buildMarketFallback(url);
    }

    const fallbackHeader = res.headers.get('X-Market-Fallback');
    const body = parseJsonBody(await res.text());

    // Fallback payloads are intentionally returned by the proxy when upstream providers fail.
    // Treat these as degraded data, not runtime errors.
    if (fallbackHeader) return body ?? buildMarketFallback(url);

    if (!res.ok) {
        if (res.status >= 500) {
            return body ?? buildMarketFallback(url);
        }
        const detail = getErrorDetail(body);
        throw new Error(`Market request failed (${res.status})${detail ? `: ${detail}` : ''}`);
    }

    if (body == null) {
        return buildMarketFallback(url);
    }

    return body;
};

export interface MarketIndex {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
}

export interface MarketIndicesResponse {
    quotes: MarketIndex[];
    metrics: {
        vwap: number | null;
        atr?: number;
        ivRank?: number;
    };
    source: string;
}

export interface MarketStatusResponse {
    status: 'open' | 'closed' | 'early-close';
    message: string;
    nextOpen?: string;
    nextClose?: string;
    session: string;
    source?: string;
}

export interface MarketMover {
    ticker: string;
    price: number;
    change: number;
    changePercent: number;
}

export interface MarketMoversResponse {
    gainers: MarketMover[];
    losers: MarketMover[];
    source?: string;
}

export interface StockSplit {
    ticker: string;
    exDate: string;
    paymentDate: string;
    ratio: number;
}

export function useMarketIndices() {
    const { session } = useMemberAuth();
    const token = session?.access_token;

    const { data, error, isLoading } = useSWR<MarketIndicesResponse>(token ? ['/api/market/indices', token] : null, fetcher, {
        ...MARKET_SWR_BASE_CONFIG,
        refreshInterval: (latestData) => hasFallbackSource(latestData) ? MARKET_FALLBACK_POLL_MS : 10_000,
    });

    return {
        indices: data?.quotes || [],
        metrics: data?.metrics,
        isLoading,
        isError: error,
        source: data?.source
    };
}

export function useMarketStatus() {
    const { session } = useMemberAuth();
    const token = session?.access_token;

    const { data, error, isLoading } = useSWR<MarketStatusResponse>(token ? ['/api/market/status', token] : null, fetcher, {
        ...MARKET_SWR_BASE_CONFIG,
        refreshInterval: (latestData) => hasFallbackSource(latestData) ? MARKET_FALLBACK_POLL_MS : 60_000,
    });

    return {
        status: data,
        isLoading,
        isError: error,
    };
}

export function useMarketMovers(limit: number = 5) {
    const { session } = useMemberAuth();
    const token = session?.access_token;
    const url = `/api/market/movers?limit=${limit}`;

    const { data, error, isLoading } = useSWR<MarketMoversResponse>(token ? [url, token] : null, fetcher, {
        ...MARKET_SWR_BASE_CONFIG,
        refreshInterval: (latestData) => hasFallbackSource(latestData) ? MARKET_FALLBACK_POLL_MS : 60_000,
    });

    return {
        gainers: data?.gainers || [],
        losers: data?.losers || [],
        isLoading,
        isError: error,
    };
}

export function useUpcomingSplits() {
    const { session } = useMemberAuth();
    const token = session?.access_token;

    const { data, error, isLoading } = useSWR<StockSplit[]>(token ? ['/api/market/splits', token] : null, fetcher, {
        ...MARKET_SWR_BASE_CONFIG,
        refreshInterval: 3_600_000, // Poll every hour
    });

    return {
        splits: data || [],
        isLoading,
        isError: error,
    };
}

export interface MarketHealthSnapshot {
    timestamp: string;
    status: {
        isOpen: boolean;
        session: string;
        message: string;
    };
    indices: {
        symbol: string;
        price: number;
        change: number;
        changePercent: number;
    }[];
    regime: {
        label: 'Risk-On' | 'Risk-Off' | 'Neutral';
        description: string;
        signals: string[];
    };
    breadth: {
        advancers: number;
        decliners: number;
        ratio: number;
        label: string;
    };
    source?: string;
}

export function useMarketAnalytics() {
    const { session } = useMemberAuth();
    const token = session?.access_token;

    const { data, error, isLoading } = useSWR<MarketHealthSnapshot>(token ? ['/api/market/analytics', token] : null, fetcher, {
        ...MARKET_SWR_BASE_CONFIG,
        refreshInterval: (latestData) => hasFallbackSource(latestData) ? MARKET_FALLBACK_POLL_MS : 30_000,
    });

    const isValidAnalytics =
        !!data &&
        typeof data === 'object' &&
        !!data.regime &&
        typeof data.regime.label === 'string' &&
        !!data.breadth &&
        typeof data.breadth.label === 'string' &&
        Array.isArray(data.indices);

    return {
        analytics: isValidAnalytics ? data : undefined,
        isLoading,
        isError: error,
    };
}
