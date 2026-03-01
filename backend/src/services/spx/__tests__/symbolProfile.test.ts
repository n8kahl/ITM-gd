import {
  clearSymbolProfileCache,
  getSymbolProfileBySymbol,
  listSymbolProfiles,
  resolveSymbolProfile,
  toLegacyRegimeSignalThresholds,
} from '../symbolProfile';

const mockFrom = jest.fn();

jest.mock('../../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../config/database', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

function createSingleBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  return builder;
}

function createListBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {
    select: jest.fn(() => builder),
    order: jest.fn().mockResolvedValue(result),
  };
  return builder;
}

describe('spx/symbolProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearSymbolProfileCache();
  });

  it('returns fail-open default profile when no active row exists', async () => {
    const singleBuilder = createSingleBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(singleBuilder);

    const profile = await resolveSymbolProfile({ symbol: 'spx' });

    expect(profile.symbol).toBe('SPX');
    expect(profile.level.openingRangeMinutes).toBe(30);
    expect(profile.gex.scalingFactor).toBe(0.1);
    expect(profile.flow.minPremium).toBe(10_000);
    expect(profile.multiTF.emaFast).toBe(21);
    expect(profile.isActive).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('symbol_profiles');
  });

  it('excludes inactive profiles by default and returns them when includeInactive=true', async () => {
    const inactiveRow = {
      symbol: 'SPX',
      display_name: 'S&P 500 Index',
      is_active: false,
      massive_ticker: 'I:SPX',
      gex_cross_symbol: 'SPY',
      gex_scaling_factor: 0.1,
    };

    const singleBuilder = createSingleBuilder({ data: inactiveRow, error: null });
    mockFrom.mockReturnValue(singleBuilder);

    const activeOnly = await getSymbolProfileBySymbol('SPX');
    const includeInactive = await getSymbolProfileBySymbol('SPX', { includeInactive: true });

    expect(activeOnly).toBeNull();
    expect(includeInactive).not.toBeNull();
    expect(includeInactive?.isActive).toBe(false);
  });

  it('normalizes MTF weights and maps seeded regime thresholds to legacy signal thresholds', async () => {
    const seededRow = {
      symbol: 'SPX',
      display_name: 'S&P 500 Index',
      round_number_interval: 50,
      opening_range_minutes: 30,
      level_cluster_radius: 3,
      gex_scaling_factor: 0.1,
      gex_cross_symbol: 'SPY',
      gex_strike_window: 220,
      flow_min_premium: 10_000,
      flow_min_volume: 10,
      flow_directional_min: 50_000,
      mtf_ema_fast: 21,
      mtf_ema_slow: 55,
      mtf_1h_weight: 5.5,
      mtf_15m_weight: 2,
      mtf_5m_weight: 1.5,
      mtf_1m_weight: 1,
      regime_breakout_threshold: 0.7,
      regime_compression_threshold: 0.65,
      massive_ticker: 'I:SPX',
      massive_options_ticker: 'O:SPX*',
      is_active: true,
    };

    const singleBuilder = createSingleBuilder({ data: seededRow, error: null });
    mockFrom.mockReturnValue(singleBuilder);

    const profile = await getSymbolProfileBySymbol('SPX', {
      includeInactive: true,
      failOpen: false,
    });

    expect(profile).not.toBeNull();
    const totalWeight = (profile?.multiTF.weight1h || 0)
      + (profile?.multiTF.weight15m || 0)
      + (profile?.multiTF.weight5m || 0)
      + (profile?.multiTF.weight1m || 0);
    expect(totalWeight).toBeCloseTo(1, 6);

    const thresholds = toLegacyRegimeSignalThresholds(profile!);
    expect(thresholds.breakout).toBeCloseTo(0.62, 6);
    expect(thresholds.compression).toBeCloseTo(0.7, 6);
  });

  it('lists and filters profile summaries by active status', async () => {
    const listBuilder = createListBuilder({
      data: [
        {
          symbol: 'SPX',
          display_name: 'S&P 500 Index',
          is_active: true,
          massive_ticker: 'I:SPX',
          gex_cross_symbol: 'SPY',
          gex_scaling_factor: 0.1,
        },
        {
          symbol: 'NDX',
          display_name: 'Nasdaq 100',
          is_active: false,
          massive_ticker: 'I:NDX',
          gex_cross_symbol: 'QQQ',
          gex_scaling_factor: 0.1,
        },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(listBuilder);

    const activeOnly = await listSymbolProfiles();
    const allProfiles = await listSymbolProfiles({ includeInactive: true });

    expect(activeOnly).toHaveLength(1);
    expect(activeOnly[0].symbol).toBe('SPX');
    expect(allProfiles).toHaveLength(2);
  });
});
