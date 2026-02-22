import {
  __resetSetupPWinCalibrationCacheForTests,
  loadSetupPWinCalibrationModel,
} from '../setupCalibration';

const mockRange = jest.fn();
const mockOrderSecond = jest.fn(() => ({ range: mockRange }));
const mockOrderFirst = jest.fn(() => ({ order: mockOrderSecond }));
const mockLte = jest.fn(() => ({ order: mockOrderFirst }));
const mockGte = jest.fn(() => ({ lte: mockLte }));
const mockSelect = jest.fn(() => ({ gte: mockGte }));
const mockFrom = jest.fn((_table?: string) => ({ select: mockSelect }));

jest.mock('../../../config/database', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

jest.mock('../../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

interface CalibrationTestRow {
  session_date: string;
  setup_type: string;
  regime: string;
  first_seen_at: string;
  triggered_at: string;
  final_outcome: string;
}

function makeRow(input: {
  sessionDate: string;
  setupType: string;
  regime: string;
  firstSeenAt: string;
  finalOutcome: string;
}): CalibrationTestRow {
  return {
    session_date: input.sessionDate,
    setup_type: input.setupType,
    regime: input.regime,
    first_seen_at: input.firstSeenAt,
    triggered_at: input.firstSeenAt,
    final_outcome: input.finalOutcome,
  };
}

describe('spx/setupCalibration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetSetupPWinCalibrationCacheForTests();
    delete process.env.SPX_SETUP_CALIBRATION_BLEND_MIN_WEIGHT;
    delete process.env.SPX_SETUP_CALIBRATION_BLEND_MAX_WEIGHT;
  });

  it('uses setup/regime/time-bucket calibration when resolved sample exists', async () => {
    const rows: CalibrationTestRow[] = [
      makeRow({
        sessionDate: '2026-02-10',
        setupType: 'orb_breakout',
        regime: 'breakout',
        firstSeenAt: '2026-02-10T14:35:00.000Z',
        finalOutcome: 't2_before_stop',
      }),
      makeRow({
        sessionDate: '2026-02-11',
        setupType: 'orb_breakout',
        regime: 'breakout',
        firstSeenAt: '2026-02-11T14:36:00.000Z',
        finalOutcome: 't1_before_stop',
      }),
      makeRow({
        sessionDate: '2026-02-12',
        setupType: 'orb_breakout',
        regime: 'breakout',
        firstSeenAt: '2026-02-12T14:37:00.000Z',
        finalOutcome: 't1_before_stop',
      }),
      makeRow({
        sessionDate: '2026-02-13',
        setupType: 'orb_breakout',
        regime: 'breakout',
        firstSeenAt: '2026-02-13T14:38:00.000Z',
        finalOutcome: 't2_before_stop',
      }),
      makeRow({
        sessionDate: '2026-02-14',
        setupType: 'orb_breakout',
        regime: 'breakout',
        firstSeenAt: '2026-02-14T14:39:00.000Z',
        finalOutcome: 't1_before_stop',
      }),
      makeRow({
        sessionDate: '2026-02-15',
        setupType: 'orb_breakout',
        regime: 'breakout',
        firstSeenAt: '2026-02-15T14:40:00.000Z',
        finalOutcome: 't2_before_stop',
      }),
      makeRow({
        sessionDate: '2026-02-16',
        setupType: 'orb_breakout',
        regime: 'breakout',
        firstSeenAt: '2026-02-16T14:41:00.000Z',
        finalOutcome: 't1_before_stop',
      }),
      makeRow({
        sessionDate: '2026-02-17',
        setupType: 'orb_breakout',
        regime: 'breakout',
        firstSeenAt: '2026-02-17T14:42:00.000Z',
        finalOutcome: 't1_before_stop',
      }),
      makeRow({
        sessionDate: '2026-02-18',
        setupType: 'orb_breakout',
        regime: 'breakout',
        firstSeenAt: '2026-02-18T14:43:00.000Z',
        finalOutcome: 'stop_before_t1',
      }),
      makeRow({
        sessionDate: '2026-02-19',
        setupType: 'orb_breakout',
        regime: 'breakout',
        firstSeenAt: '2026-02-19T14:44:00.000Z',
        finalOutcome: 't1_before_stop',
      }),
    ];

    mockRange.mockResolvedValueOnce({ data: rows, error: null });

    const model = await loadSetupPWinCalibrationModel({
      asOfDateEt: '2026-02-20',
      forceRefresh: true,
    });
    const result = model.calibrate({
      setupType: 'orb_breakout',
      regime: 'breakout',
      firstSeenMinuteEt: 12,
      rawPWin: 0.52,
    });

    expect(result.source).toBe('setup_regime_bucket');
    expect(result.sampleSize).toBe(10);
    expect(result.empiricalPWin).toBeGreaterThan(0.7);
    expect(result.pWin).toBeGreaterThan(0.52);

    await loadSetupPWinCalibrationModel({ asOfDateEt: '2026-02-20' });
    expect(mockRange).toHaveBeenCalledTimes(1);
  });

  it('falls back to heuristic probability when no resolved rows are available', async () => {
    mockRange.mockResolvedValueOnce({ data: [], error: null });

    const model = await loadSetupPWinCalibrationModel({
      asOfDateEt: '2026-02-20',
      forceRefresh: true,
    });
    const result = model.calibrate({
      setupType: 'trend_pullback',
      regime: 'trending',
      firstSeenMinuteEt: 180,
      rawPWin: 0.61,
    });

    expect(result.source).toBe('heuristic');
    expect(result.sampleSize).toBe(0);
    expect(result.blendWeight).toBe(0);
    expect(result.empiricalPWin).toBeNull();
    expect(result.pWin).toBe(0.61);
  });
});
