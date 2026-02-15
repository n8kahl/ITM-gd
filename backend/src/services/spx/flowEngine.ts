import { cacheGet, cacheSet } from '../../config/redis';
import { computeUnifiedGEXLandscape } from './gexEngine';
import { detectActiveSetups } from './setupDetector';
import type { SPXFlowEvent } from './types';
import { nowIso, round, uuid } from './utils';

const FLOW_CACHE_KEY = 'spx_command_center:flow';
const FLOW_CACHE_TTL_SECONDS = 5;

export async function getFlowEvents(options?: { forceRefresh?: boolean }): Promise<SPXFlowEvent[]> {
  const forceRefresh = options?.forceRefresh === true;

  if (!forceRefresh) {
    const cached = await cacheGet<SPXFlowEvent[]>(FLOW_CACHE_KEY);
    if (cached) {
      return cached;
    }
  }

  const [setups, gex] = await Promise.all([
    detectActiveSetups({ forceRefresh }),
    computeUnifiedGEXLandscape({ forceRefresh }),
  ]);

  const baseExpiry = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const events = setups.slice(0, 8).map((setup, idx) => {
    const strike = setup.direction === 'bullish'
      ? Math.floor(setup.entryZone.high / 5) * 5
      : Math.ceil(setup.entryZone.low / 5) * 5;

    const size = Math.max(120, Math.round((setup.confluenceScore * 180) + idx * 35));
    const premium = round(size * ((setup.confluenceScore + 1) * 2.1), 2);
    const type: SPXFlowEvent['type'] = idx % 3 === 0 ? 'block' : 'sweep';
    const symbol: SPXFlowEvent['symbol'] = idx % 2 === 0 ? 'SPX' : 'SPY';

    return {
      id: uuid('flow'),
      type,
      symbol,
      strike,
      expiry: baseExpiry,
      size,
      direction: setup.direction,
      premium,
      timestamp: nowIso(),
    };
  });

  if (events.length === 0) {
    events.push({
      id: uuid('flow'),
      type: 'block',
      symbol: 'SPX',
      strike: round(gex.combined.flipPoint, 0),
      expiry: baseExpiry,
      size: 100,
      direction: gex.combined.netGex >= 0 ? 'bullish' : 'bearish',
      premium: 250000,
      timestamp: nowIso(),
    });
  }

  await cacheSet(FLOW_CACHE_KEY, events, FLOW_CACHE_TTL_SECONDS);
  return events;
}
