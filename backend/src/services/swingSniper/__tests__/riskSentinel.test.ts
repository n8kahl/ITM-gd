import { buildSwingSniperRiskSentinel } from '../riskSentinel';

const mockGetWatchlistState = jest.fn();
const mockAnalyzeIVProfile = jest.fn();
const mockGetUserPositions = jest.fn();
const mockAnalyzePosition = jest.fn();
const mockAnalyzePortfolio = jest.fn();
const mockGenerateAdvice = jest.fn();

jest.mock('../persistence', () => ({
  getSwingSniperWatchlistState: (...args: unknown[]) => mockGetWatchlistState(...args),
}));

jest.mock('../../options/ivAnalysis', () => ({
  analyzeIVProfile: (...args: unknown[]) => mockAnalyzeIVProfile(...args),
}));

jest.mock('../../options/positionAnalyzer', () => ({
  getUserPositions: (...args: unknown[]) => mockGetUserPositions(...args),
  analyzePosition: (...args: unknown[]) => mockAnalyzePosition(...args),
  analyzePortfolio: (...args: unknown[]) => mockAnalyzePortfolio(...args),
}));

jest.mock('../../positions/exitAdvisor', () => ({
  ExitAdvisor: jest.fn().mockImplementation(() => ({
    generateAdvice: (...args: unknown[]) => mockGenerateAdvice(...args),
  })),
}));

describe('buildSwingSniperRiskSentinel', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetWatchlistState.mockResolvedValue({
      symbols: ['NVDA'],
      selectedSymbol: 'NVDA',
      filters: { preset: 'all', minScore: 0 },
      savedTheses: [
        {
          symbol: 'NVDA',
          savedAt: '2026-03-09T12:00:00.000Z',
          score: 88,
          setupLabel: 'Cheap event gamma into catalyst window',
          direction: 'long_vol',
          thesis: 'IV is below realized into earnings.',
          ivRankAtSave: 42,
          catalystLabel: 'NVDA earnings',
          catalystDate: '2026-03-17',
          monitorNote: 'Waiting for earnings window.',
        },
      ],
    });

    mockAnalyzeIVProfile.mockResolvedValue({
      currentPrice: 918.44,
      ivRank: {
        ivRank: 51,
      },
    });
  });

  it('returns thesis monitoring even when there are no open positions', async () => {
    mockGetUserPositions.mockResolvedValue([]);

    const result = await buildSwingSniperRiskSentinel('user-1');

    expect(result.savedTheses).toHaveLength(1);
    expect(result.savedTheses[0].monitoring).toEqual(expect.objectContaining({
      status: expect.any(String),
      healthScore: expect.any(Number),
      exitBias: expect.any(String),
    }));
    expect(result.portfolio.openPositions).toBe(0);
    expect(result.positionAdvice).toHaveLength(0);
  });

  it('returns portfolio exposure and position advice when positions exist', async () => {
    const positions = [
      {
        id: 'pos-1',
        symbol: 'NVDA',
        type: 'call',
        strike: 900,
        expiry: '2026-03-21',
        quantity: 1,
        entryPrice: 12,
        entryDate: '2026-03-01',
      },
    ];

    mockGetUserPositions.mockResolvedValue(positions);
    mockAnalyzePosition.mockResolvedValue({
      position: positions[0],
      currentValue: 1500,
      costBasis: 1200,
      pnl: 300,
      pnlPct: 25,
      daysHeld: 8,
      daysToExpiry: 12,
      breakeven: 912,
      maxGain: 'unlimited',
      maxLoss: 1200,
      riskRewardRatio: undefined,
      greeks: {
        delta: 40,
        gamma: 0.2,
        theta: -28,
        vega: 80,
        rho: 2,
      },
    });

    mockAnalyzePortfolio.mockResolvedValue({
      positions: [],
      portfolio: {
        totalValue: 1500,
        totalCostBasis: 1200,
        totalPnl: 300,
        totalPnlPct: 25,
        portfolioGreeks: {
          delta: 40,
          gamma: 0.2,
          theta: -28,
          vega: 80,
          rho: 2,
        },
        risk: {
          maxLoss: 1200,
          maxGain: 'unlimited',
          buyingPowerUsed: 1200,
        },
        riskAssessment: {
          overall: 'moderate',
          warnings: [],
        },
      },
    });

    mockGenerateAdvice.mockReturnValue([
      {
        positionId: 'pos-1',
        type: 'take_profit',
        urgency: 'medium',
        message: 'Position up 25%. Consider taking partial profits.',
        suggestedAction: {
          action: 'take_partial_profit',
          closePct: 50,
        },
      },
    ]);

    const result = await buildSwingSniperRiskSentinel('user-1');

    expect(result.portfolio.openPositions).toBe(1);
    expect(result.portfolio.totalPnl).toBe(300);
    expect(result.positionAdvice).toHaveLength(1);
    expect(result.alerts.some((alert) => alert.source === 'position')).toBe(true);
  });
});
