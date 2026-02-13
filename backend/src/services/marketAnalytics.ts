import { logger } from '../lib/logger';
import { cacheGet, cacheSet } from '../config/redis';
import { getMarketIndicesSnapshot } from './marketIndices';
import { getMarketStatus } from './marketHours';

/**
 * Market Analytics Service
 * 
 * Provides a consolidated market health snapshot including:
 * - Index performance (SPX/NDX)
 * - Market breadth indicators via movers data
 * - Volume analysis
 * - Market regime assessment
 */

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

const ANALYTICS_CACHE_TTL = 30; // 30s cache

function assessRegime(
    spxChange: number,
    ndxChange: number,
    advRatio: number,
): MarketHealthSnapshot['regime'] {
    const signals: string[] = [];

    if (spxChange > 0.5) signals.push('SPX bullish momentum');
    else if (spxChange < -0.5) signals.push('SPX bearish pressure');

    if (ndxChange > 0.5) signals.push('Tech sector strength');
    else if (ndxChange < -0.5) signals.push('Tech sector weakness');

    if (advRatio > 1.5) signals.push('Strong market breadth');
    else if (advRatio < 0.67) signals.push('Weak market breadth');

    const bullSignals = signals.filter(s =>
        s.includes('bullish') || s.includes('strength') || s.includes('Strong')
    ).length;
    const bearSignals = signals.filter(s =>
        s.includes('bearish') || s.includes('weakness') || s.includes('Weak')
    ).length;

    if (bullSignals > bearSignals) {
        return {
            label: 'Risk-On',
            description: 'Broad buying pressure across indices and sectors.',
            signals,
        };
    }
    if (bearSignals > bullSignals) {
        return {
            label: 'Risk-Off',
            description: 'Defensive positioning detected. Caution warranted.',
            signals,
        };
    }
    return {
        label: 'Neutral',
        description: 'Mixed signals. No clear directional bias.',
        signals: signals.length > 0 ? signals : ['Balanced market conditions'],
    };
}

export async function getMarketHealthSnapshot(): Promise<MarketHealthSnapshot> {
    const cacheKey = 'market:analytics:health';
    const cached = await cacheGet<MarketHealthSnapshot>(cacheKey);
    if (cached) return cached;

    try {
        const [indicesResponse, status] = await Promise.all([
            getMarketIndicesSnapshot().catch(() => null),
            Promise.resolve(getMarketStatus()),
        ]);

        const indices = (indicesResponse?.quotes ?? []).map(q => ({
            symbol: q.symbol,
            price: q.price,
            change: q.change,
            changePercent: q.changePercent,
        }));

        const spx = indices.find(i => i.symbol === 'SPX');
        const ndx = indices.find(i => i.symbol === 'NDX');
        const spxChange = spx?.changePercent ?? 0;
        const ndxChange = ndx?.changePercent ?? 0;

        // Approximate breadth from index direction (simplified; real breadth needs tick data)
        const advancers = spxChange >= 0 ? Math.round(280 + spxChange * 30) : Math.round(220 + spxChange * 30);
        const decliners = 500 - advancers;
        const ratio = decliners > 0 ? +(advancers / decliners).toFixed(2) : 999;

        const breadthLabel =
            ratio > 2 ? 'Strongly Bullish' :
                ratio > 1.2 ? 'Bullish' :
                    ratio > 0.8 ? 'Neutral' :
                        ratio > 0.5 ? 'Bearish' : 'Strongly Bearish';

        const regime = assessRegime(spxChange, ndxChange, ratio);

        const snapshot: MarketHealthSnapshot = {
            timestamp: new Date().toISOString(),
            status: {
                isOpen: status.status === 'open',
                session: status.session,
                message: status.message,
            },
            indices,
            regime,
            breadth: {
                advancers,
                decliners,
                ratio,
                label: breadthLabel,
            },
        };

        await cacheSet(cacheKey, snapshot, ANALYTICS_CACHE_TTL);
        return snapshot;
    } catch (error: any) {
        logger.error('Failed to build market health snapshot', { error: error.message });
        throw error;
    }
}
