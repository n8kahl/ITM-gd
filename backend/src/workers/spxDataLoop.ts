import { supabase } from '../config/database';
import { logger } from '../lib/logger';
import { getMarketStatus } from '../services/marketHours';
import { getSPXSnapshot } from '../services/spx';
import type { ClusterZone, SPXLevel, Setup } from '../services/spx/types';
import {
  markWorkerCycleFailed,
  markWorkerCycleStarted,
  markWorkerCycleSucceeded,
  markWorkerNextRun,
  markWorkerStarted,
  markWorkerStopped,
  registerWorker,
} from '../services/workerHealth';

const WORKER_NAME = 'spx_data_loop_worker';
const OPEN_INTERVAL_MS = 60_000;
const OFF_HOURS_INTERVAL_MS = 300_000;
const INITIAL_DELAY_MS = 20_000;

registerWorker(WORKER_NAME);

let timer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;

function currentIntervalMs(): number {
  const marketStatus = getMarketStatus();
  return marketStatus.status === 'open' || marketStatus.status === 'pre-market'
    ? OPEN_INTERVAL_MS
    : OFF_HOURS_INTERVAL_MS;
}

async function persistLevels(levels: SPXLevel[]): Promise<void> {
  if (levels.length === 0) return;

  await supabase
    .from('spx_levels')
    .update({ valid_until: new Date().toISOString() })
    .is('valid_until', null);

  const rows = levels.map((level) => ({
    symbol: level.symbol,
    level_type: level.category,
    source: level.source,
    price: level.price,
    strength: level.strength,
    timeframe: level.timeframe,
    metadata: level.metadata,
    valid_from: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('spx_levels')
    .insert(rows);

  if (error) {
    logger.warn('SPX worker failed to persist levels', {
      error: error.message,
      code: (error as any).code,
    });
  }
}

async function persistClusters(clusters: ClusterZone[]): Promise<void> {
  if (clusters.length === 0) return;

  const today = new Date().toISOString().slice(0, 10);

  await supabase
    .from('spx_cluster_zones')
    .update({ is_active: false })
    .eq('session_date', today)
    .eq('is_active', true);

  const rows = clusters.map((zone) => ({
    price_low: zone.priceLow,
    price_high: zone.priceHigh,
    cluster_score: zone.clusterScore,
    source_breakdown: zone.sources,
    zone_type: zone.type,
    test_count: zone.testCount,
    last_test_at: zone.lastTestAt,
    held: zone.held,
    hold_rate: zone.holdRate,
    is_active: true,
    session_date: today,
  }));

  const { error } = await supabase
    .from('spx_cluster_zones')
    .insert(rows);

  if (error) {
    logger.warn('SPX worker failed to persist clusters', {
      error: error.message,
      code: (error as any).code,
    });
  }
}

async function persistSetups(setups: Setup[]): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  const { error: deleteError } = await supabase
    .from('spx_setups')
    .delete()
    .eq('session_date', today)
    .in('status', ['forming', 'ready', 'triggered']);

  if (deleteError) {
    logger.warn('SPX worker failed to prune setups', {
      error: deleteError.message,
      code: (deleteError as any).code,
    });
  }

  if (setups.length === 0) return;

  const rows = setups.map((setup) => ({
    setup_type: setup.type,
    direction: setup.direction,
    entry_zone_low: setup.entryZone.low,
    entry_zone_high: setup.entryZone.high,
    stop_price: setup.stop,
    target_1_price: setup.target1.price,
    target_2_price: setup.target2.price,
    confluence_score: setup.confluenceScore,
    confluence_sources: setup.confluenceSources,
    regime: setup.regime,
    status: setup.status,
    probability: setup.probability,
    recommended_contract: setup.recommendedContract,
    session_date: today,
    triggered_at: setup.triggeredAt,
  }));

  const { error } = await supabase
    .from('spx_setups')
    .insert(rows);

  if (error) {
    logger.warn('SPX worker failed to persist setups', {
      error: error.message,
      code: (error as any).code,
    });
  }
}

async function persistGex(snapshot: Awaited<ReturnType<typeof getSPXSnapshot>>['gex']): Promise<void> {
  const rows = [
    {
      symbol: 'SPX',
      snapshot_time: snapshot.spx.timestamp,
      net_gex: snapshot.spx.netGex,
      flip_point: snapshot.spx.flipPoint,
      gex_by_strike: snapshot.spx.gexByStrike,
      call_wall: snapshot.spx.callWall,
      put_wall: snapshot.spx.putWall,
      zero_gamma: snapshot.spx.zeroGamma,
      key_levels: snapshot.spx.keyLevels,
      expiration_mix: snapshot.spx.expirationBreakdown,
    },
    {
      symbol: 'SPY',
      snapshot_time: snapshot.spy.timestamp,
      net_gex: snapshot.spy.netGex,
      flip_point: snapshot.spy.flipPoint,
      gex_by_strike: snapshot.spy.gexByStrike,
      call_wall: snapshot.spy.callWall,
      put_wall: snapshot.spy.putWall,
      zero_gamma: snapshot.spy.zeroGamma,
      key_levels: snapshot.spy.keyLevels,
      expiration_mix: snapshot.spy.expirationBreakdown,
    },
    {
      symbol: 'COMBINED',
      snapshot_time: snapshot.combined.timestamp,
      net_gex: snapshot.combined.netGex,
      flip_point: snapshot.combined.flipPoint,
      gex_by_strike: snapshot.combined.gexByStrike,
      call_wall: snapshot.combined.callWall,
      put_wall: snapshot.combined.putWall,
      zero_gamma: snapshot.combined.zeroGamma,
      key_levels: snapshot.combined.keyLevels,
      expiration_mix: snapshot.combined.expirationBreakdown,
    },
  ];

  const { error } = await supabase
    .from('spx_gex_snapshots')
    .insert(rows);

  if (error) {
    logger.warn('SPX worker failed to persist GEX snapshots', {
      error: error.message,
      code: (error as any).code,
    });
  }
}

async function runCycle(): Promise<void> {
  if (!isRunning) return;

  const cycleStartedAt = markWorkerCycleStarted(WORKER_NAME);
  try {
    const snapshot = await getSPXSnapshot({ forceRefresh: true });

    await Promise.all([
      persistLevels(snapshot.levels),
      persistClusters(snapshot.clusters),
      persistSetups(snapshot.setups),
      persistGex(snapshot.gex),
    ]);

    markWorkerCycleSucceeded(WORKER_NAME, cycleStartedAt);

    logger.info('SPX data loop cycle complete', {
      levels: snapshot.levels.length,
      clusters: snapshot.clusters.length,
      setups: snapshot.setups.length,
      regime: snapshot.regime.regime,
    });
  } catch (error) {
    markWorkerCycleFailed(WORKER_NAME, cycleStartedAt, error);
    logger.error('SPX data loop cycle failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    const interval = currentIntervalMs();
    markWorkerNextRun(WORKER_NAME, interval);
    timer = setTimeout(runCycle, interval);
  }
}

export function startSPXDataLoop(): void {
  if (isRunning) {
    logger.warn('SPX data loop worker already running');
    return;
  }

  isRunning = true;
  markWorkerStarted(WORKER_NAME);
  logger.info('SPX data loop worker started');
  markWorkerNextRun(WORKER_NAME, INITIAL_DELAY_MS);
  timer = setTimeout(runCycle, INITIAL_DELAY_MS);
}

export function stopSPXDataLoop(): void {
  isRunning = false;
  markWorkerStopped(WORKER_NAME);

  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  logger.info('SPX data loop worker stopped');
}
