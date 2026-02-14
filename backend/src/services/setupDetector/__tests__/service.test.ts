import {
  SetupDetectorService,
  SETUP_DETECTOR_POLL_INTERVAL_CLOSED,
  SETUP_DETECTOR_POLL_INTERVAL_EXTENDED,
  SETUP_DETECTOR_POLL_INTERVAL_OPEN,
} from '../index';
import { SetupSignal } from '../types';

jest.mock('../../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

interface MockSupabase {
  from: jest.Mock;
  watchlistSelect: jest.Mock;
  detectedSelect: jest.Mock;
  detectedInsert: jest.Mock;
  trackedSelect: jest.Mock;
  trackedInsert: jest.Mock;
}

interface MockSupabaseOptions {
  watchlistRows?: Array<{ user_id: string; symbols: string[]; is_default: boolean; updated_at: string }>;
  dedupeRows?: Array<Record<string, unknown>>;
  detectedInsertRow?: Record<string, unknown> | null;
  pendingRows?: Array<Record<string, unknown>>;
  cooldownRows?: Array<Record<string, unknown>>;
  trackedInsertRow?: Record<string, unknown> | null;
}

function createMockSupabase(options?: MockSupabaseOptions): MockSupabase {
  const watchlistRows = options?.watchlistRows ?? [
    {
      user_id: 'user-1',
      symbols: ['SPX'],
      is_default: true,
      updated_at: '2026-02-09T14:00:00.000Z',
    },
  ];

  const dedupeRows = options?.dedupeRows ?? [];
  const detectedInsertRow = options?.detectedInsertRow ?? {
    id: 'det-1',
    symbol: 'SPX',
    setup_type: 'orb_breakout',
    direction: 'long',
    confidence: 82,
    detected_at: '2026-02-09T15:00:00.000Z',
    signal_data: { currentPrice: 6012.5, description: 'SPX ORB long', dedupeKey: 'orb:15:long' },
    trade_suggestion: { entry: 6012.5, stopLoss: 6004, target: 6024 },
  };

  const pendingRows = options?.pendingRows ?? [];
  const cooldownRows = options?.cooldownRows ?? [];
  const trackedInsertRow = options?.trackedInsertRow ?? { id: 'tracked-1' };

  const watchlistOrderSecond = jest.fn().mockResolvedValue({ data: watchlistRows, error: null });
  const watchlistOrderFirst = jest.fn().mockReturnValue({ order: watchlistOrderSecond });
  const watchlistSelect = jest.fn().mockReturnValue({ order: watchlistOrderFirst });

  const detectedLimit = jest.fn().mockResolvedValue({ data: dedupeRows, error: null });
  const detectedOrder = jest.fn().mockReturnValue({ limit: detectedLimit });
  const detectedEq3 = jest.fn().mockReturnValue({ order: detectedOrder });
  const detectedEq2 = jest.fn().mockReturnValue({ eq: detectedEq3 });
  const detectedEq1 = jest.fn().mockReturnValue({ eq: detectedEq2 });
  const detectedSelect = jest.fn().mockReturnValue({ eq: detectedEq1 });

  const detectedSingle = jest.fn().mockResolvedValue({ data: detectedInsertRow, error: null });
  const detectedInsertSelect = jest.fn().mockReturnValue({ single: detectedSingle });
  const detectedInsert = jest.fn().mockReturnValue({ select: detectedInsertSelect });

  const trackedLimit = jest.fn()
    .mockResolvedValueOnce({ data: pendingRows, error: null })
    .mockResolvedValue({ data: cooldownRows, error: null });
  const trackedGte = jest.fn().mockReturnValue({ limit: trackedLimit });
  const trackedIn = jest.fn().mockReturnValue({ gte: trackedGte });
  const trackedEq2 = jest.fn().mockReturnValue({ gte: trackedGte, in: trackedIn, limit: trackedLimit });
  const trackedEq1 = jest.fn().mockReturnValue({ eq: trackedEq2 });
  const trackedSelect = jest.fn().mockReturnValue({ eq: trackedEq1 });

  const trackedMaybeSingle = jest.fn().mockResolvedValue({ data: trackedInsertRow, error: null });
  const trackedInsertSelect = jest.fn().mockReturnValue({ maybeSingle: trackedMaybeSingle });
  const trackedInsert = jest.fn().mockReturnValue({ select: trackedInsertSelect });

  const from = jest.fn((table: string) => {
    if (table === 'ai_coach_watchlists') {
      return { select: watchlistSelect };
    }

    if (table === 'ai_coach_detected_setups') {
      return {
        select: detectedSelect,
        insert: detectedInsert,
      };
    }

    if (table === 'ai_coach_tracked_setups') {
      return {
        select: trackedSelect,
        insert: trackedInsert,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    from,
    watchlistSelect,
    detectedSelect,
    detectedInsert,
    trackedSelect,
    trackedInsert,
  };
}

describe('SetupDetectorService', () => {
  const baseNow = new Date('2026-02-09T15:00:00.000Z');

  const signal: SetupSignal = {
    type: 'orb_breakout',
    symbol: 'SPX',
    direction: 'long',
    confidence: 82,
    currentPrice: 6012.5,
    description: 'SPX ORB breakout',
    dedupeKey: 'orb:15:long',
    signalData: {
      orbHigh: 6005,
      orbLow: 5995,
      currentPrice: 6012.5,
      description: 'SPX ORB breakout',
    },
    tradeSuggestion: {
      strategy: 'orb breakout',
      entry: 6012.5,
      stopLoss: 6004,
      target: 6024,
    },
    detectedAt: baseNow.toISOString(),
  };

  it('persists and distributes detected setups to tracked setups', async () => {
    const mockSupabase = createMockSupabase();
    const publishSetupDetected = jest.fn();
    const detectSetupsForSymbol = jest.fn().mockResolvedValue([signal]);

    const service = new SetupDetectorService({
      supabase: mockSupabase as any,
      now: () => baseNow,
      getMarketStatus: () => ({ status: 'open' } as any),
      detectSetupsForSymbol,
      publishSetupDetected,
    });

    await service.runCycleOnce();

    expect(detectSetupsForSymbol).toHaveBeenCalledWith('SPX', baseNow.toISOString());
    expect(mockSupabase.detectedInsert).toHaveBeenCalled();
    expect(mockSupabase.trackedInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      symbol: 'SPX',
      setup_type: 'orb_breakout',
      status: 'active',
    }));
    expect(publishSetupDetected).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      symbol: 'SPX',
      setupType: 'orb_breakout',
      trackedSetupId: 'tracked-1',
      detectedSetupId: 'det-1',
    }));
  });

  it('skips duplicate signal persistence when dedupe key is recent', async () => {
    const mockSupabase = createMockSupabase({
      dedupeRows: [
        {
          id: 'det-existing',
          detected_at: '2026-02-09T14:57:00.000Z',
          signal_data: { dedupeKey: 'orb:15:long' },
        },
      ],
    });

    const publishSetupDetected = jest.fn();
    const detectSetupsForSymbol = jest.fn().mockResolvedValue([signal]);

    const service = new SetupDetectorService({
      supabase: mockSupabase as any,
      now: () => baseNow,
      getMarketStatus: () => ({ status: 'open' } as any),
      detectSetupsForSymbol,
      publishSetupDetected,
    });

    await service.runCycleOnce();

    expect(mockSupabase.detectedInsert).not.toHaveBeenCalled();
    expect(mockSupabase.trackedInsert).not.toHaveBeenCalled();
    expect(publishSetupDetected).not.toHaveBeenCalled();
  });

  it('does not create new tracked setup when a pending setup already exists for the symbol', async () => {
    const mockSupabase = createMockSupabase({
      pendingRows: [{ id: 'tracked-existing' }],
    });
    const publishSetupDetected = jest.fn();
    const detectSetupsForSymbol = jest.fn().mockResolvedValue([signal]);

    const service = new SetupDetectorService({
      supabase: mockSupabase as any,
      now: () => baseNow,
      getMarketStatus: () => ({ status: 'open' } as any),
      detectSetupsForSymbol,
      publishSetupDetected,
    });

    await service.runCycleOnce();

    expect(mockSupabase.detectedInsert).toHaveBeenCalled();
    expect(mockSupabase.trackedInsert).not.toHaveBeenCalled();
    expect(publishSetupDetected).not.toHaveBeenCalled();
  });

  it('does not process setup detection outside regular market hours', async () => {
    const mockSupabase = createMockSupabase();
    const detectSetupsForSymbol = jest.fn().mockResolvedValue([signal]);

    const service = new SetupDetectorService({
      supabase: mockSupabase as any,
      now: () => baseNow,
      getMarketStatus: () => ({ status: 'closed' } as any),
      detectSetupsForSymbol,
      publishSetupDetected: jest.fn(),
    });

    await service.runCycleOnce();

    expect(mockSupabase.from).not.toHaveBeenCalled();
    expect(detectSetupsForSymbol).not.toHaveBeenCalled();
  });

  it('uses adaptive polling intervals by session status', () => {
    const service = new SetupDetectorService({
      supabase: createMockSupabase() as any,
      now: () => baseNow,
      getMarketStatus: () => ({ status: 'open' } as any),
      detectSetupsForSymbol: jest.fn(),
      publishSetupDetected: jest.fn(),
    });

    expect(service.getPollingInterval()).toBe(SETUP_DETECTOR_POLL_INTERVAL_OPEN);

    const serviceExtended = new SetupDetectorService({
      supabase: createMockSupabase() as any,
      now: () => baseNow,
      getMarketStatus: () => ({ status: 'after-hours' } as any),
      detectSetupsForSymbol: jest.fn(),
      publishSetupDetected: jest.fn(),
    });

    expect(serviceExtended.getPollingInterval()).toBe(SETUP_DETECTOR_POLL_INTERVAL_EXTENDED);

    const serviceClosed = new SetupDetectorService({
      supabase: createMockSupabase() as any,
      now: () => baseNow,
      getMarketStatus: () => ({ status: 'closed' } as any),
      detectSetupsForSymbol: jest.fn(),
      publishSetupDetected: jest.fn(),
    });

    expect(serviceClosed.getPollingInterval()).toBe(SETUP_DETECTOR_POLL_INTERVAL_CLOSED);
  });
});
