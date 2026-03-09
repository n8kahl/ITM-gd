
'use client'

import useSWR from 'swr';
import { useMemberAuth } from '@/contexts/MemberAuthContext';

type MarketKey = [url: string, token: string];

const DIRECT_MARKET_API_BASE = (process.env.NEXT_PUBLIC_AI_COACH_API_URL || '').replace(/\/+$/, '');

function resolveMarketUrl(url: string): string {
    if (DIRECT_MARKET_API_BASE && url.startsWith('/api/market/')) {
        return `${DIRECT_MARKET_API_BASE}${url}`;
    }
    return url;
}

const fetcher = async (key: MarketKey) => {
    const [url, token] = key;
    const targetUrl = resolveMarketUrl(url);
    const res = await fetch(targetUrl, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    const fallbackHeader = res.headers.get('X-Market-Fallback');
    if (fallbackHeader) {
        const body = await res.json().catch(() => null);
        const detail = typeof body?.message === 'string'
            ? body.message
            : (typeof body?.error === 'string' ? body.error : '');
        throw new Error(`Market data unavailable (${fallbackHeader})${detail ? `: ${detail}` : ''}`);
    }
    if (!res.ok) {
        let detail = '';
        try {
            const body = await res.json();
            if (body && typeof body.message === 'string') detail = body.message;
        } catch {
            // no-op
        }
        throw new Error(`Market request failed (${res.status})${detail ? `: ${detail}` : ''}`);
    }
    return res.json();
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
        refreshInterval: 10000, // Poll every 10s
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
        refreshInterval: 60000, // Poll every minute
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
        refreshInterval: 60000, // Poll every minute
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
        refreshInterval: 3600000, // Poll every hour
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
}

export function useMarketAnalytics() {
    const { session } = useMemberAuth();
    const token = session?.access_token;

    const { data, error, isLoading } = useSWR<MarketHealthSnapshot>(token ? ['/api/market/analytics', token] : null, fetcher, {
        refreshInterval: 30000, // Poll every 30s
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
