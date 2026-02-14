
import useSWR from 'swr';

const fetcher = async (url: string) => {
    const res = await fetch(url);
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
    const { data, error, isLoading } = useSWR<MarketIndicesResponse>('/api/market/indices', fetcher, {
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
    const { data, error, isLoading } = useSWR<MarketStatusResponse>('/api/market/status', fetcher, {
        refreshInterval: 60000, // Poll every minute
    });

    return {
        status: data,
        isLoading,
        isError: error,
    };
}

export function useMarketMovers(limit: number = 5) {
    const { data, error, isLoading } = useSWR<MarketMoversResponse>(`/api/market/movers?limit=${limit}`, fetcher, {
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
    const { data, error, isLoading } = useSWR<StockSplit[]>('/api/market/splits', fetcher, {
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
    const { data, error, isLoading } = useSWR<MarketHealthSnapshot>('/api/market/analytics', fetcher, {
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
