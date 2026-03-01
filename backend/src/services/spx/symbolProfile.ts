import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';

const SYMBOL_PROFILE_CACHE_TTL_MS = 60_000;

const LEGACY_DEFAULTS = {
  level: {
    roundNumberInterval: 50,
    openingRangeMinutes: 30,
    clusterRadiusPoints: 3,
  },
  gex: {
    scalingFactor: 0.1,
    strikeWindowPoints: 220,
  },
  flow: {
    minPremium: 10_000,
    minVolume: 10,
    directionalMinPremium: 25_000,
  },
  multiTF: {
    emaFast: 21,
    emaSlow: 55,
    weight1h: 0.55,
    weight15m: 0.2,
    weight5m: 0.15,
    weight1m: 0.1,
  },
  regime: {
    breakoutThreshold: 0.7,
    compressionThreshold: 0.65,
  },
} as const;

export const LEGACY_REGIME_SIGNAL_THRESHOLDS = {
  breakout: 0.62,
  compression: 0.7,
} as const;

export const SEEDED_REGIME_SIGNAL_THRESHOLDS = {
  breakout: 0.7,
  compression: 0.65,
} as const;

export interface SymbolProfile {
  symbol: string;
  displayName: string;
  level: {
    roundNumberInterval: number;
    openingRangeMinutes: number;
    clusterRadiusPoints: number;
  };
  gex: {
    scalingFactor: number;
    crossSymbol: string;
    strikeWindowPoints: number;
  };
  flow: {
    minPremium: number;
    minVolume: number;
    directionalMinPremium: number;
  };
  multiTF: {
    emaFast: number;
    emaSlow: number;
    weight1h: number;
    weight15m: number;
    weight5m: number;
    weight1m: number;
  };
  regime: {
    breakoutThreshold: number;
    compressionThreshold: number;
  };
  tickers: {
    massiveTicker: string;
    massiveOptionsTicker: string | null;
  };
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SymbolProfileSummary {
  symbol: string;
  displayName: string;
  isActive: boolean;
  massiveTicker: string;
  crossSymbol: string;
  updatedAt: string | null;
}

type SymbolProfileQueryRow = {
  symbol?: unknown;
  display_name?: unknown;
  round_number_interval?: unknown;
  opening_range_minutes?: unknown;
  level_cluster_radius?: unknown;
  gex_scaling_factor?: unknown;
  gex_cross_symbol?: unknown;
  gex_strike_window?: unknown;
  flow_min_premium?: unknown;
  flow_min_volume?: unknown;
  flow_directional_min?: unknown;
  mtf_ema_fast?: unknown;
  mtf_ema_slow?: unknown;
  mtf_1h_weight?: unknown;
  mtf_15m_weight?: unknown;
  mtf_5m_weight?: unknown;
  mtf_1m_weight?: unknown;
  regime_breakout_threshold?: unknown;
  regime_compression_threshold?: unknown;
  massive_ticker?: unknown;
  massive_options_ticker?: unknown;
  is_active?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

interface SymbolProfileCacheEntry {
  expiresAtMs: number;
  value: SymbolProfile | null;
}

const symbolProfileCache = new Map<string, SymbolProfileCacheEntry>();

const SYMBOL_PROFILE_SELECT_FIELDS = [
  'symbol',
  'display_name',
  'round_number_interval',
  'opening_range_minutes',
  'level_cluster_radius',
  'gex_scaling_factor',
  'gex_cross_symbol',
  'gex_strike_window',
  'flow_min_premium',
  'flow_min_volume',
  'flow_directional_min',
  'mtf_ema_fast',
  'mtf_ema_slow',
  'mtf_1h_weight',
  'mtf_15m_weight',
  'mtf_5m_weight',
  'mtf_1m_weight',
  'regime_breakout_threshold',
  'regime_compression_threshold',
  'massive_ticker',
  'massive_options_ticker',
  'is_active',
  'created_at',
  'updated_at',
].join(',');

function normalizeSymbol(input: string | null | undefined, fallback = 'SPX'): string {
  const value = typeof input === 'string' ? input.trim().toUpperCase() : '';
  return value.length > 0 ? value : fallback;
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parsePositiveNumber(value: unknown, fallback: number): number {
  const parsed = parseFiniteNumber(value);
  if (parsed == null || parsed <= 0) return fallback;
  return parsed;
}

function parsePositiveInteger(value: unknown, fallback: number): number {
  const parsed = parseFiniteNumber(value);
  if (parsed == null || parsed <= 0) return fallback;
  return Math.max(1, Math.round(parsed));
}

function parseWeight(value: unknown, fallback: number): number {
  const parsed = parseFiniteNumber(value);
  if (parsed == null || parsed < 0) return fallback;
  return parsed;
}

function normalizeWeights(weights: {
  weight1h: number;
  weight15m: number;
  weight5m: number;
  weight1m: number;
}): {
  weight1h: number;
  weight15m: number;
  weight5m: number;
  weight1m: number;
} {
  const sum = weights.weight1h + weights.weight15m + weights.weight5m + weights.weight1m;
  if (!Number.isFinite(sum) || sum <= 0) {
    return {
      weight1h: LEGACY_DEFAULTS.multiTF.weight1h,
      weight15m: LEGACY_DEFAULTS.multiTF.weight15m,
      weight5m: LEGACY_DEFAULTS.multiTF.weight5m,
      weight1m: LEGACY_DEFAULTS.multiTF.weight1m,
    };
  }

  return {
    weight1h: weights.weight1h / sum,
    weight15m: weights.weight15m / sum,
    weight5m: weights.weight5m / sum,
    weight1m: weights.weight1m / sum,
  };
}

function deriveFallbackMassiveTicker(symbol: string): string {
  if (symbol === 'SPX') return 'I:SPX';
  return symbol.startsWith('I:') ? symbol : `I:${symbol}`;
}

function deriveFallbackCrossSymbol(symbol: string): string {
  if (symbol === 'SPX') return 'SPY';
  return symbol;
}

function buildDefaultProfile(symbolInput?: string): SymbolProfile {
  const symbol = normalizeSymbol(symbolInput, 'SPX');
  const crossSymbol = deriveFallbackCrossSymbol(symbol);

  return {
    symbol,
    displayName: symbol === 'SPX' ? 'S&P 500 Index' : symbol,
    level: {
      roundNumberInterval: LEGACY_DEFAULTS.level.roundNumberInterval,
      openingRangeMinutes: LEGACY_DEFAULTS.level.openingRangeMinutes,
      clusterRadiusPoints: LEGACY_DEFAULTS.level.clusterRadiusPoints,
    },
    gex: {
      scalingFactor: LEGACY_DEFAULTS.gex.scalingFactor,
      crossSymbol,
      strikeWindowPoints: LEGACY_DEFAULTS.gex.strikeWindowPoints,
    },
    flow: {
      minPremium: LEGACY_DEFAULTS.flow.minPremium,
      minVolume: LEGACY_DEFAULTS.flow.minVolume,
      directionalMinPremium: LEGACY_DEFAULTS.flow.directionalMinPremium,
    },
    multiTF: {
      emaFast: LEGACY_DEFAULTS.multiTF.emaFast,
      emaSlow: LEGACY_DEFAULTS.multiTF.emaSlow,
      weight1h: LEGACY_DEFAULTS.multiTF.weight1h,
      weight15m: LEGACY_DEFAULTS.multiTF.weight15m,
      weight5m: LEGACY_DEFAULTS.multiTF.weight5m,
      weight1m: LEGACY_DEFAULTS.multiTF.weight1m,
    },
    regime: {
      breakoutThreshold: LEGACY_DEFAULTS.regime.breakoutThreshold,
      compressionThreshold: LEGACY_DEFAULTS.regime.compressionThreshold,
    },
    tickers: {
      massiveTicker: deriveFallbackMassiveTicker(symbol),
      massiveOptionsTicker: symbol === 'SPX' ? 'O:SPX*' : null,
    },
    isActive: true,
    createdAt: null,
    updatedAt: null,
  };
}

function isSymbolProfileRow(value: unknown): value is SymbolProfileQueryRow {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function toSymbolProfile(row: SymbolProfileQueryRow, fallbackSymbol?: string): SymbolProfile {
  const defaultProfile = buildDefaultProfile(
    normalizeSymbol(parseOptionalString(row.symbol) || fallbackSymbol || 'SPX'),
  );

  const rawCrossSymbol = normalizeSymbol(parseOptionalString(row.gex_cross_symbol), defaultProfile.gex.crossSymbol);
  const normalizedWeights = normalizeWeights({
    weight1h: parseWeight(row.mtf_1h_weight, defaultProfile.multiTF.weight1h),
    weight15m: parseWeight(row.mtf_15m_weight, defaultProfile.multiTF.weight15m),
    weight5m: parseWeight(row.mtf_5m_weight, defaultProfile.multiTF.weight5m),
    weight1m: parseWeight(row.mtf_1m_weight, defaultProfile.multiTF.weight1m),
  });

  return {
    ...defaultProfile,
    displayName: parseOptionalString(row.display_name) || defaultProfile.displayName,
    level: {
      roundNumberInterval: parsePositiveNumber(row.round_number_interval, defaultProfile.level.roundNumberInterval),
      openingRangeMinutes: parsePositiveInteger(row.opening_range_minutes, defaultProfile.level.openingRangeMinutes),
      clusterRadiusPoints: parsePositiveNumber(row.level_cluster_radius, defaultProfile.level.clusterRadiusPoints),
    },
    gex: {
      scalingFactor: parsePositiveNumber(row.gex_scaling_factor, defaultProfile.gex.scalingFactor),
      crossSymbol: rawCrossSymbol,
      strikeWindowPoints: parsePositiveNumber(row.gex_strike_window, defaultProfile.gex.strikeWindowPoints),
    },
    flow: {
      minPremium: parsePositiveNumber(row.flow_min_premium, defaultProfile.flow.minPremium),
      minVolume: parsePositiveInteger(row.flow_min_volume, defaultProfile.flow.minVolume),
      directionalMinPremium: parsePositiveNumber(row.flow_directional_min, defaultProfile.flow.directionalMinPremium),
    },
    multiTF: {
      emaFast: parsePositiveInteger(row.mtf_ema_fast, defaultProfile.multiTF.emaFast),
      emaSlow: parsePositiveInteger(row.mtf_ema_slow, defaultProfile.multiTF.emaSlow),
      weight1h: normalizedWeights.weight1h,
      weight15m: normalizedWeights.weight15m,
      weight5m: normalizedWeights.weight5m,
      weight1m: normalizedWeights.weight1m,
    },
    regime: {
      breakoutThreshold: parsePositiveNumber(row.regime_breakout_threshold, defaultProfile.regime.breakoutThreshold),
      compressionThreshold: parsePositiveNumber(row.regime_compression_threshold, defaultProfile.regime.compressionThreshold),
    },
    tickers: {
      massiveTicker: parseOptionalString(row.massive_ticker) || defaultProfile.tickers.massiveTicker,
      massiveOptionsTicker: parseOptionalString(row.massive_options_ticker),
    },
    isActive: typeof row.is_active === 'boolean' ? row.is_active : defaultProfile.isActive,
    createdAt: parseOptionalString(row.created_at),
    updatedAt: parseOptionalString(row.updated_at),
  };
}

function cacheKeyForSymbol(symbol: string, includeInactive: boolean): string {
  return `${symbol}|${includeInactive ? 'all' : 'active'}`;
}

function readCachedProfile(symbol: string, includeInactive: boolean): SymbolProfile | null | undefined {
  const key = cacheKeyForSymbol(symbol, includeInactive);
  const cached = symbolProfileCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAtMs <= Date.now()) {
    symbolProfileCache.delete(key);
    return undefined;
  }
  return cached.value;
}

function writeCachedProfile(symbol: string, includeInactive: boolean, profile: SymbolProfile | null): void {
  const key = cacheKeyForSymbol(symbol, includeInactive);
  symbolProfileCache.set(key, {
    value: profile,
    expiresAtMs: Date.now() + SYMBOL_PROFILE_CACHE_TTL_MS,
  });
}

function toSummary(profile: SymbolProfile): SymbolProfileSummary {
  return {
    symbol: profile.symbol,
    displayName: profile.displayName,
    isActive: profile.isActive,
    massiveTicker: profile.tickers.massiveTicker,
    crossSymbol: profile.gex.crossSymbol,
    updatedAt: profile.updatedAt,
  };
}

export function clearSymbolProfileCache(): void {
  symbolProfileCache.clear();
}

export async function getSymbolProfileBySymbol(
  symbolInput: string,
  options?: {
    includeInactive?: boolean;
    failOpen?: boolean;
    bypassCache?: boolean;
  },
): Promise<SymbolProfile | null> {
  const symbol = normalizeSymbol(symbolInput, 'SPX');
  const includeInactive = options?.includeInactive === true;
  const failOpen = options?.failOpen !== false;

  if (!options?.bypassCache) {
    const cached = readCachedProfile(symbol, includeInactive);
    if (cached !== undefined) {
      return cached;
    }
  }

  try {
    const { data, error } = await supabase
      .from('symbol_profiles')
      .select(SYMBOL_PROFILE_SELECT_FIELDS)
      .eq('symbol', symbol)
      .maybeSingle();

    if (error) throw error;

    const profile = isSymbolProfileRow(data)
      ? toSymbolProfile(data, symbol)
      : null;

    const normalized = profile && (includeInactive || profile.isActive)
      ? profile
      : null;

    writeCachedProfile(symbol, includeInactive, normalized);
    return normalized;
  } catch (error) {
    if (!failOpen) {
      throw error;
    }
    logger.warn('Failed to load symbol profile; using fail-open fallback', {
      symbol,
      includeInactive,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function listSymbolProfiles(options?: {
  includeInactive?: boolean;
  failOpen?: boolean;
}): Promise<SymbolProfile[]> {
  const includeInactive = options?.includeInactive === true;
  const failOpen = options?.failOpen !== false;

  try {
    const { data, error } = await supabase
      .from('symbol_profiles')
      .select(SYMBOL_PROFILE_SELECT_FIELDS)
      .order('symbol', { ascending: true });

    if (error) throw error;

    const rows: unknown[] = Array.isArray(data) ? data : [];
    return rows
      .filter(isSymbolProfileRow)
      .map((row) => toSymbolProfile(row))
      .filter((profile) => includeInactive || profile.isActive);
  } catch (error) {
    if (!failOpen) {
      throw error;
    }
    logger.warn('Failed to list symbol profiles; returning empty list', {
      includeInactive,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export async function resolveSymbolProfile(options?: {
  symbol?: string;
  profile?: SymbolProfile | null;
}): Promise<SymbolProfile> {
  const requestedSymbol = normalizeSymbol(options?.symbol || options?.profile?.symbol || 'SPX');

  if (options?.profile && options.profile.symbol === requestedSymbol && options.profile.isActive) {
    return options.profile;
  }

  const loaded = await getSymbolProfileBySymbol(requestedSymbol, {
    includeInactive: false,
    failOpen: true,
  });

  if (loaded) return loaded;
  return buildDefaultProfile(requestedSymbol);
}

export function summarizeSymbolProfile(profile: SymbolProfile): SymbolProfileSummary {
  return toSummary(profile);
}

export function toLegacyRegimeSignalThresholds(profile: SymbolProfile): {
  breakout: number;
  compression: number;
} {
  const breakoutOffset = profile.regime.breakoutThreshold - SEEDED_REGIME_SIGNAL_THRESHOLDS.breakout;
  const compressionOffset = profile.regime.compressionThreshold - SEEDED_REGIME_SIGNAL_THRESHOLDS.compression;

  const breakout = Math.max(0.2, Math.min(0.95, LEGACY_REGIME_SIGNAL_THRESHOLDS.breakout + breakoutOffset));
  const compression = Math.max(0.2, Math.min(0.95, LEGACY_REGIME_SIGNAL_THRESHOLDS.compression + compressionOffset));

  return {
    breakout,
    compression,
  };
}
