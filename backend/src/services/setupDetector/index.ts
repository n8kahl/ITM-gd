import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';
import { publishSetupDetected } from '../setupPushChannel';
import { calculateLevels } from '../levels';
import { fetchDailyData, fetchIntradayData } from '../levels/fetcher';
import { getMarketStatus } from '../marketHours';
import { fetchOptionsChain } from '../options/optionsChainFetcher';
import { detectSetupsFromSnapshot } from './detectors';
import { detectGammaSqueeze } from './gammaSqueeze';
import { SetupDirection, SetupSignal, toShortDirection } from './types';

interface WatchlistRow {
  user_id: string;
  symbols: unknown;
  is_default: boolean;
  updated_at: string;
}

interface PersistedDetectedSetup {
  id: string;
  symbol: string;
  setupType: string;
  direction: SetupDirection;
  confidence: number | null;
  detectedAt: string;
  signalData: Record<string, unknown>;
  tradeSuggestion: Record<string, unknown> | null;
}

interface SetupDetectorDeps {
  detectSetupsForSymbol: (symbol: string, detectedAt: string) => Promise<SetupSignal[]>;
  getMarketStatus: typeof getMarketStatus;
  now: () => Date;
  publishSetupDetected: typeof publishSetupDetected;
  supabase: typeof supabase;
}

const DEFAULT_SYMBOLS = ['SPX', 'NDX'];
const GAMMA_SETUP_SYMBOLS = new Set(['SPX', 'NDX']);
const MAX_SYMBOLS_PER_CYCLE = 20;

export const SETUP_DETECTOR_INITIAL_DELAY = 10_000;
export const SETUP_DETECTOR_POLL_INTERVAL_OPEN = 15_000;
export const SETUP_DETECTOR_POLL_INTERVAL_EXTENDED = 60_000;
export const SETUP_DETECTOR_POLL_INTERVAL_CLOSED = 300_000;
export const SETUP_DETECTOR_COOLDOWN_MS = 5 * 60 * 1000;

function sanitizeSymbols(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  const symbols = input
    .map((value) => (typeof value === 'string' ? value.trim().toUpperCase() : ''))
    .filter((value) => /^[A-Z0-9._:-]{1,10}$/.test(value));

  return Array.from(new Set(symbols)).slice(0, MAX_SYMBOLS_PER_CYCLE);
}

async function detectSetupsForSymbol(symbol: string, detectedAt: string): Promise<SetupSignal[]> {
  try {
    const [intradayBars, dailyBars, levels] = await Promise.all([
      fetchIntradayData(symbol),
      fetchDailyData(symbol, 10),
      calculateLevels(symbol, 'intraday'),
    ]);

    if (intradayBars.length < 5 || dailyBars.length < 2) {
      return [];
    }

    const snapshot = {
      symbol,
      intradayBars,
      dailyBars,
      levels,
      detectedAt,
    };

    const detections = detectSetupsFromSnapshot(snapshot);

    if (GAMMA_SETUP_SYMBOLS.has(symbol.toUpperCase())) {
      try {
        const chain = await fetchOptionsChain(symbol, undefined, 20);
        const gammaSignal = detectGammaSqueeze(snapshot, chain);
        if (gammaSignal) {
          detections.push(gammaSignal);
        }
      } catch (error) {
        logger.warn('Gamma squeeze detector skipped for symbol', {
          symbol,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return detections.sort((a, b) => b.confidence - a.confidence);
  } catch (error) {
    logger.warn('Setup detector failed for symbol', {
      symbol,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function parseSignalData(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parseOptionalObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseDirection(value: unknown): SetupDirection {
  if (value === 'long' || value === 'short' || value === 'neutral') {
    return value;
  }
  return 'neutral';
}

function parseConfidence(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildOpportunityData(setup: PersistedDetectedSetup): Record<string, unknown> {
  const currentPrice = typeof setup.signalData.currentPrice === 'number'
    ? setup.signalData.currentPrice
    : null;
  const description = typeof setup.signalData.description === 'string'
    ? setup.signalData.description
    : `${setup.symbol} ${setup.setupType.replace(/_/g, ' ')}`;

  return {
    id: `det-${setup.id}`,
    type: 'technical',
    setupType: setup.setupType,
    symbol: setup.symbol,
    direction: toShortDirection(setup.direction),
    score: setup.confidence ?? 0,
    confidence: setup.confidence !== null ? Number((setup.confidence / 100).toFixed(2)) : 0,
    currentPrice,
    description,
    suggestedTrade: setup.tradeSuggestion,
    metadata: {
      ...setup.signalData,
      source: 'setup_detector',
      detectedSetupId: setup.id,
    },
    scannedAt: setup.detectedAt,
  };
}

function mapDirectionToTracked(direction: SetupDirection): 'bullish' | 'bearish' | 'neutral' {
  return toShortDirection(direction);
}

export class SetupDetectorService {
  private deps: SetupDetectorDeps;
  private isRunning = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(deps?: Partial<SetupDetectorDeps>) {
    this.deps = {
      detectSetupsForSymbol: deps?.detectSetupsForSymbol ?? detectSetupsForSymbol,
      getMarketStatus: deps?.getMarketStatus ?? getMarketStatus,
      now: deps?.now ?? (() => new Date()),
      publishSetupDetected: deps?.publishSetupDetected ?? publishSetupDetected,
      supabase: deps?.supabase ?? supabase,
    };
  }

  public start(): void {
    if (this.isRunning) {
      logger.warn('Setup detector service is already running');
      return;
    }

    this.isRunning = true;
    logger.info('Setup detector service started');
    this.scheduleNext(SETUP_DETECTOR_INITIAL_DELAY);
  }

  public stop(): void {
    this.isRunning = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    logger.info('Setup detector service stopped');
  }

  public getPollingInterval(): number {
    const status = this.deps.getMarketStatus();
    if (status.status === 'open') return SETUP_DETECTOR_POLL_INTERVAL_OPEN;
    if (status.status === 'pre-market' || status.status === 'after-hours') {
      return SETUP_DETECTOR_POLL_INTERVAL_EXTENDED;
    }
    return SETUP_DETECTOR_POLL_INTERVAL_CLOSED;
  }

  public async runCycleOnce(): Promise<void> {
    const status = this.deps.getMarketStatus();
    if (status.status !== 'open') {
      return;
    }

    const userSymbols = await this.loadUserSymbols();
    if (userSymbols.size === 0) {
      return;
    }

    const uniqueSymbols = Array.from(
      new Set(Array.from(userSymbols.values()).flatMap((symbols) => symbols)),
    ).slice(0, MAX_SYMBOLS_PER_CYCLE);

    const detectedBySymbol = new Map<string, PersistedDetectedSetup[]>();
    const detectedAt = this.deps.now().toISOString();

    for (const symbol of uniqueSymbols) {
      const signals = await this.deps.detectSetupsForSymbol(symbol, detectedAt);
      if (signals.length === 0) continue;

      for (const signal of signals) {
        const persisted = await this.persistDetectedSignal(signal);
        if (!persisted) continue;

        const existing = detectedBySymbol.get(symbol) || [];
        existing.push(persisted);
        detectedBySymbol.set(symbol, existing);
      }
    }

    if (detectedBySymbol.size === 0) {
      return;
    }

    await this.distributeSignalsToUsers(userSymbols, detectedBySymbol);
  }

  private scheduleNext(delayMs: number): void {
    if (!this.isRunning) return;

    this.timer = setTimeout(async () => {
      try {
        await this.runCycleOnce();
      } catch (error) {
        logger.error('Setup detector service cycle failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        this.scheduleNext(this.getPollingInterval());
      }
    }, delayMs);
  }

  private async loadUserSymbols(): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();

    const { data, error } = await this.deps.supabase
      .from('ai_coach_watchlists')
      .select('user_id, symbols, is_default, updated_at')
      .order('is_default', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load watchlists: ${error.message}`);
    }

    const rows = (data || []) as WatchlistRow[];

    for (const row of rows) {
      if (map.has(row.user_id)) continue;

      const symbols = sanitizeSymbols(row.symbols);
      if (symbols.length > 0) {
        map.set(row.user_id, symbols);
      }
    }

    if (map.size > 0) {
      return map;
    }

    // Fallback: active tracked setup users should still receive setup detections.
    const { data: trackedRows, error: trackedError } = await this.deps.supabase
      .from('ai_coach_tracked_setups')
      .select('user_id')
      .eq('status', 'active')
      .limit(250);

    if (trackedError) {
      logger.warn('Setup detector fallback user lookup failed', {
        error: trackedError.message,
      });
      return map;
    }

    for (const row of trackedRows || []) {
      const userId = typeof (row as { user_id?: unknown }).user_id === 'string'
        ? (row as { user_id: string }).user_id
        : null;
      if (!userId || map.has(userId)) continue;
      map.set(userId, DEFAULT_SYMBOLS);
    }

    return map;
  }

  private async persistDetectedSignal(signal: SetupSignal): Promise<PersistedDetectedSetup | null> {
    const now = this.deps.now().getTime();

    const { data: latestRows, error: latestError } = await this.deps.supabase
      .from('ai_coach_detected_setups')
      .select('id, detected_at, signal_data')
      .eq('symbol', signal.symbol)
      .eq('setup_type', signal.type)
      .eq('direction', signal.direction)
      .order('detected_at', { ascending: false })
      .limit(1);

    if (latestError) {
      logger.warn('Setup detector dedupe lookup failed', {
        symbol: signal.symbol,
        setupType: signal.type,
        error: latestError.message,
      });
    }

    const latest = latestRows && latestRows.length > 0 ? latestRows[0] as Record<string, unknown> : null;
    if (latest) {
      const detectedAtRaw = latest.detected_at;
      const signalData = parseSignalData(latest.signal_data);
      const latestKey = typeof signalData.dedupeKey === 'string' ? signalData.dedupeKey : null;
      const detectedAtMs = typeof detectedAtRaw === 'string' ? Date.parse(detectedAtRaw) : Number.NaN;

      if (latestKey === signal.dedupeKey && Number.isFinite(detectedAtMs) && now - detectedAtMs < SETUP_DETECTOR_COOLDOWN_MS) {
        return null;
      }
    }

    const { data, error } = await this.deps.supabase
      .from('ai_coach_detected_setups')
      .insert({
        symbol: signal.symbol,
        setup_type: signal.type,
        direction: signal.direction,
        signal_data: {
          ...signal.signalData,
          dedupeKey: signal.dedupeKey,
          description: signal.description,
          currentPrice: signal.currentPrice,
        },
        trade_suggestion: signal.tradeSuggestion ?? null,
        confidence: signal.confidence,
        detected_at: signal.detectedAt,
      })
      .select('id, symbol, setup_type, direction, confidence, detected_at, signal_data, trade_suggestion')
      .single();

    if (error) {
      logger.error('Failed to persist detected setup', {
        symbol: signal.symbol,
        setupType: signal.type,
        error: error.message,
      });
      return null;
    }

    const row = data as Record<string, unknown>;

    return {
      id: String(row.id),
      symbol: String(row.symbol),
      setupType: String(row.setup_type),
      direction: parseDirection(row.direction),
      confidence: parseConfidence(row.confidence),
      detectedAt: String(row.detected_at),
      signalData: parseSignalData(row.signal_data),
      tradeSuggestion: parseOptionalObject(row.trade_suggestion),
    };
  }

  private async distributeSignalsToUsers(
    userSymbols: Map<string, string[]>,
    detectedBySymbol: Map<string, PersistedDetectedSetup[]>,
  ): Promise<void> {
    for (const [userId, symbols] of userSymbols) {
      for (const symbol of symbols) {
        const candidates = detectedBySymbol.get(symbol);
        if (!candidates || candidates.length === 0) {
          continue;
        }

        const hasRecent = await this.hasRecentTrackedSetup(userId, symbol);
        if (hasRecent) {
          continue;
        }

        const bestSignal = [...candidates].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
        const trackedSetupId = await this.createTrackedSetupFromSignal(userId, bestSignal);
        if (!trackedSetupId) {
          continue;
        }

        this.deps.publishSetupDetected({
          trackedSetupId,
          detectedSetupId: bestSignal.id,
          userId,
          symbol: bestSignal.symbol,
          setupType: bestSignal.setupType,
          direction: mapDirectionToTracked(bestSignal.direction),
          confidence: bestSignal.confidence,
          currentPrice: typeof bestSignal.signalData.currentPrice === 'number' ? bestSignal.signalData.currentPrice : null,
          detectedAt: bestSignal.detectedAt,
        });
      }
    }
  }

  private async hasRecentTrackedSetup(userId: string, symbol: string): Promise<boolean> {
    const cutoffIso = new Date(this.deps.now().getTime() - SETUP_DETECTOR_COOLDOWN_MS).toISOString();

    const { data, error } = await this.deps.supabase
      .from('ai_coach_tracked_setups')
      .select('id')
      .eq('user_id', userId)
      .eq('symbol', symbol)
      .gte('tracked_at', cutoffIso)
      .limit(1);

    if (error) {
      logger.warn('Setup detector cooldown check failed', {
        userId,
        symbol,
        error: error.message,
      });
      // Fail-safe to avoid notification spam when uncertain.
      return true;
    }

    return Array.isArray(data) && data.length > 0;
  }

  private async createTrackedSetupFromSignal(userId: string, signal: PersistedDetectedSetup): Promise<string | null> {
    const payload = {
      user_id: userId,
      source_opportunity_id: signal.id,
      symbol: signal.symbol,
      setup_type: signal.setupType,
      direction: mapDirectionToTracked(signal.direction),
      status: 'active',
      opportunity_data: buildOpportunityData(signal),
      notes: 'Auto-detected by AI Coach setup engine',
    };

    const { data, error } = await this.deps.supabase
      .from('ai_coach_tracked_setups')
      .insert(payload)
      .select('id')
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        return null;
      }

      logger.error('Failed to create tracked setup from detected signal', {
        userId,
        symbol: signal.symbol,
        setupType: signal.setupType,
        error: error.message,
      });
      return null;
    }

    if (!data || typeof (data as { id?: unknown }).id !== 'string') {
      return null;
    }

    return (data as { id: string }).id;
  }
}

let setupDetectorService: SetupDetectorService | null = null;

export function getSetupDetectorService(): SetupDetectorService {
  if (!setupDetectorService) {
    setupDetectorService = new SetupDetectorService();
  }
  return setupDetectorService;
}

export function startSetupDetectorService(): void {
  getSetupDetectorService().start();
}

export function stopSetupDetectorService(): void {
  getSetupDetectorService().stop();
}
