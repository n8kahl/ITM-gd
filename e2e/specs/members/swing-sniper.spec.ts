import { expect, test, type Page, type Route } from '@playwright/test'
import { authenticateAsMember } from '../../helpers/member-auth'

const SWING_SNIPER_URL = '/members/swing-sniper?e2eBypassAuth=1'
const SWING_SNIPER_LEAD_ROLE_ID = '1465515598640447662'

async function enableMemberBypass(page: Page): Promise<void> {
  await authenticateAsMember(page, { bypassMiddleware: true })
  await page.context().addCookies([
    {
      name: 'e2e_bypass_auth',
      value: '1',
      domain: '127.0.0.1',
      path: '/',
    },
    {
      name: 'e2e_bypass_auth',
      value: '1',
      domain: 'localhost',
      path: '/',
    },
  ])
}

function buildStructureLab(symbol: 'NVDA' | 'TSLA', direction: 'long_vol' | 'short_vol') {
  const isLongVol = direction === 'long_vol'
  return {
    generatedAt: '2026-03-09T15:30:00.000Z',
    symbol,
    direction,
    notes: [
      'Evaluated 14 structure candidates across long premium, spreads, calendars, diagonals, and butterflies.',
      'Scenario and payoff outputs are deterministic approximations for decision support.',
    ],
    recommendations: [
      {
        id: `${symbol.toLowerCase()}-${isLongVol ? 'long-straddle' : 'call-credit'}`,
        strategy: isLongVol ? 'long_straddle' : 'call_credit_spread',
        strategyLabel: isLongVol ? 'Long Straddle' : 'Call Credit Spread',
        thesisFit: isLongVol ? 89.4 : 83.7,
        debitOrCredit: isLongVol ? 'debit' : 'credit',
        netPremium: isLongVol ? 34.25 : 2.1,
        maxLoss: isLongVol ? 3425 : 610,
        maxProfit: isLongVol ? null : 210,
        breakevenLow: isLongVol ? (symbol === 'NVDA' ? 884 : 225) : (symbol === 'NVDA' ? 940 : 252),
        breakevenHigh: isLongVol ? (symbol === 'NVDA' ? 955 : 257) : (symbol === 'NVDA' ? 972 : 265),
        probabilityOfProfit: isLongVol ? 41.2 : 67.4,
        entryWindow: isLongVol
          ? 'Enter 5-10 trading days before the catalyst while IV remains below realized volatility.'
          : 'Deploy after event volatility expansion once directional momentum starts to fade.',
        invalidation: isLongVol
          ? 'Exit if IV reprices above the fair-value band before realized move starts to expand.'
          : 'Exit if spot breaks through the short strike with expanding realized volatility.',
        contractSummary: isLongVol
          ? `Buy 1 2026-03-21 ${symbol === 'NVDA' ? 920 : 240}C / Buy 1 2026-03-21 ${symbol === 'NVDA' ? 920 : 240}P`
          : `Sell 1 2026-03-21 ${symbol === 'NVDA' ? 960 : 258}C / Buy 1 2026-03-21 ${symbol === 'NVDA' ? 980 : 265}C`,
        spreadQuality: isLongVol ? 'fair' : 'tight',
        liquidityScore: isLongVol ? 74.6 : 81.3,
        contracts: isLongVol
          ? [
            {
              leg: 'Buy call',
              side: 'buy',
              optionType: 'call',
              expiry: '2026-03-21',
              strike: symbol === 'NVDA' ? 920 : 240,
              quantity: 1,
              mark: symbol === 'NVDA' ? 18.2 : 7.4,
              bid: symbol === 'NVDA' ? 17.9 : 7.2,
              ask: symbol === 'NVDA' ? 18.5 : 7.6,
              spreadPct: 3.2,
              delta: 0.51,
              openInterest: 8120,
              volume: 6430,
            },
            {
              leg: 'Buy put',
              side: 'buy',
              optionType: 'put',
              expiry: '2026-03-21',
              strike: symbol === 'NVDA' ? 920 : 240,
              quantity: 1,
              mark: symbol === 'NVDA' ? 16.05 : 6.8,
              bid: symbol === 'NVDA' ? 15.8 : 6.6,
              ask: symbol === 'NVDA' ? 16.3 : 7.0,
              spreadPct: 3.1,
              delta: -0.48,
              openInterest: 7042,
              volume: 5311,
            },
          ]
          : [
            {
              leg: 'Sell call',
              side: 'sell',
              optionType: 'call',
              expiry: '2026-03-21',
              strike: symbol === 'NVDA' ? 960 : 258,
              quantity: 1,
              mark: symbol === 'NVDA' ? 3.2 : 1.9,
              bid: symbol === 'NVDA' ? 3.1 : 1.8,
              ask: symbol === 'NVDA' ? 3.3 : 2.0,
              spreadPct: 3.1,
              delta: 0.28,
              openInterest: 9920,
              volume: 9012,
            },
            {
              leg: 'Buy call',
              side: 'buy',
              optionType: 'call',
              expiry: '2026-03-21',
              strike: symbol === 'NVDA' ? 980 : 265,
              quantity: 1,
              mark: symbol === 'NVDA' ? 1.1 : 0.8,
              bid: symbol === 'NVDA' ? 1.0 : 0.75,
              ask: symbol === 'NVDA' ? 1.2 : 0.85,
              spreadPct: 8.3,
              delta: 0.18,
              openInterest: 6230,
              volume: 5821,
            },
          ],
        whyThisStructure: isLongVol
          ? [
            'Pure long-vol expression for large post-catalyst movement in either direction.',
            'Keeps directional bias secondary while catalyst uncertainty is high.',
          ]
          : [
            'Captures rich front premium with defined risk.',
            'Fits elevated-IV environments where realized movement is expected to mean-revert.',
          ],
        risks: isLongVol
          ? ['Premium decay accelerates if the move stalls.', 'A pre-event IV spike can reduce edge quality.']
          : ['Upside surprise moves can challenge the short strike quickly.', 'Pin risk rises into expiry.'],
        scenarioSummary: isLongVol
          ? {
            bearCase: `Bear (${symbol === 'NVDA' ? '870' : '226'}): +$1,120`,
            baseCase: `Base (${symbol === 'NVDA' ? '918' : '241'}): -$3,425`,
            bullCase: `Bull (${symbol === 'NVDA' ? '965' : '255'}): +$980`,
          }
          : {
            bearCase: `Bear (${symbol === 'NVDA' ? '880' : '228'}): +$210`,
            baseCase: `Base (${symbol === 'NVDA' ? '918' : '241'}): +$210`,
            bullCase: `Bull (${symbol === 'NVDA' ? '975' : '266'}): -$610`,
          },
        payoffDiagram: [
          { price: symbol === 'NVDA' ? 830 : 215, pnl: isLongVol ? 2200 : 180, returnPct: -10 },
          { price: symbol === 'NVDA' ? 875 : 227, pnl: isLongVol ? 1050 : 210, returnPct: -5 },
          { price: symbol === 'NVDA' ? 918 : 241, pnl: isLongVol ? -3425 : 210, returnPct: 0 },
          { price: symbol === 'NVDA' ? 960 : 255, pnl: isLongVol ? 900 : -220, returnPct: 5 },
          { price: symbol === 'NVDA' ? 1010 : 268, pnl: isLongVol ? 2950 : -610, returnPct: 10 },
        ],
        payoffDistribution: [
          { label: '-1.50σ', probability: 10, expectedPnl: isLongVol ? 220 : 18, expectedReturnPct: -9.4 },
          { label: '-0.75σ', probability: 20, expectedPnl: isLongVol ? 140 : 42, expectedReturnPct: -4.8 },
          { label: 'At spot', probability: 40, expectedPnl: isLongVol ? -1370 : 84, expectedReturnPct: 0 },
          { label: '+0.75σ', probability: 20, expectedPnl: isLongVol ? 210 : -44, expectedReturnPct: 4.7 },
          { label: '+1.50σ', probability: 10, expectedPnl: isLongVol ? 295 : -61, expectedReturnPct: 9.2 },
        ],
      },
    ],
  }
}

function buildMonitoringPayload(saved: boolean) {
  return {
    generatedAt: '2026-03-09T15:30:00.000Z',
    savedTheses: saved
      ? [
        {
          symbol: 'NVDA',
          savedAt: '2026-03-09T15:30:00.000Z',
          score: 92,
          setupLabel: 'Cheap event gamma into catalyst window',
          direction: 'long_vol',
          thesis: 'Current IV sits below the recent realized tape while earnings in 8D can reprice premium quickly.',
          ivRankAtSave: 42,
          ivRankNow: 44,
          edgeState: 'stable',
          monitorNote: 'Waiting for earnings window.',
          currentPrice: 918.44,
          monitoring: {
            status: 'active',
            healthScore: 79.4,
            primaryRisk: null,
            exitBias: 'hold',
            note: 'Thesis remains active and within expected volatility drift.',
          },
        },
      ]
      : [],
    portfolio: {
      openPositions: 1,
      totalPnl: 184,
      totalPnlPct: 8.4,
      riskLevel: 'moderate',
      warnings: [],
      netGreeks: {
        delta: 36.2,
        gamma: 0.18,
        theta: -22.4,
        vega: 71.2,
        rho: 1.3,
      },
      symbolExposure: [
        {
          symbol: 'NVDA',
          positionCount: 1,
          pnl: 184,
          pnlPct: 8.4,
          netDelta: 36.2,
          netTheta: -22.4,
        },
      ],
    },
    positionAdvice: [
      {
        positionId: 'pos-1',
        symbol: 'NVDA',
        severity: 'medium',
        type: 'take_profit',
        message: 'Position is up 8.4%. Consider taking partial profits.',
        suggestedAction: 'take_partial_profit (50%)',
      },
    ],
    alerts: [
      {
        id: 'position-pos-1',
        source: 'position',
        symbol: 'NVDA',
        severity: 'medium',
        title: 'NVDA take profit',
        message: 'Position is up 8.4%. Consider taking partial profits.',
        suggestedAction: 'take_partial_profit (50%)',
      },
    ],
    notes: [
      'Risk Sentinel compares save-time IV state against current IV rank drift to score thesis health.',
      'Exit guidance is advisory only and does not trigger broker-side automation.',
    ],
  }
}

function buildBacktestPayload(symbol: 'NVDA' | 'TSLA') {
  const isNvda = symbol === 'NVDA'
  return {
    generatedAt: '2026-03-09T15:30:00.000Z',
    symbol,
    status: 'ready',
    windowDays: 360,
    snapshotsConsidered: 12,
    summary: {
      sampleSize: 12,
      resolvedSamples: 9,
      hitRatePct: isNvda ? 66.7 : 58.3,
      weightedHitRatePct: isNvda ? 64.1 : 55.2,
      averageMovePct: isNvda ? 3.1 : 1.2,
      medianMovePct: isNvda ? 2.7 : 1.1,
      bestMovePct: isNvda ? 9.4 : 4.3,
      worstMovePct: isNvda ? -4.8 : -3.1,
      averageHorizonDays: 8.2,
    },
    confidence: {
      confidenceWeight: isNvda ? 1.08 : 1.01,
      baseScore: isNvda ? 92 : 81,
      adjustedScore: isNvda ? 99 : 82,
      stance: isNvda ? 'boost' : 'neutral',
      rationale: isNvda
        ? ['Weighted hit rate is 64.1%, supporting a confidence uplift.']
        : ['Weighted hit rate is 55.2%, so confidence remains near baseline.'],
    },
    outcomes: [
      {
        snapshotDate: '2026-03-01',
        direction: isNvda ? 'long_vol' : 'short_vol',
        entryPrice: isNvda ? 901.2 : 238.4,
        exitPrice: isNvda ? 930.7 : 242.1,
        horizonDays: 8,
        movePct: isNvda ? 3.27 : 1.55,
        absoluteMovePct: isNvda ? 3.27 : 1.55,
        thresholdPct: isNvda ? 2.4 : 2.2,
        success: true,
        weight: 1.03,
      },
    ],
    caveats: isNvda ? [] : ['Sample size is small, so confidence overlays should be treated as provisional.'],
    notes: [
      'Outcomes are based on archived Swing Sniper signal snapshots and daily close replay.',
    ],
  }
}

function buildDossier(symbol: 'NVDA' | 'TSLA', saved: boolean) {
  if (symbol === 'TSLA') {
    return {
      symbol: 'TSLA',
      companyName: 'Tesla, Inc.',
      currentPrice: 241.32,
      score: 81,
      direction: 'short_vol',
      setupLabel: 'Rich front premium above realized tape',
      expressionPreview: 'Defined-risk premium sale after event',
      thesis: 'Premium is already elevated versus realized movement, so the cleaner edge is to wait for post-catalyst decay.',
      summary: 'Rich front premium above realized tape. Premium is already elevated versus realized movement, so the cleaner edge is to wait for post-catalyst decay.',
      saved,
      asOf: '2026-03-09T15:30:00.000Z',
      reasoning: [
        'IV benchmark is 52.1% against 20D RV at 33.4%, which is rich by 18.7 vol points.',
        'Term structure is contango and skew is put heavy.',
        'No earnings window is currently in the near-term catalyst stack, so macro timing matters more.',
        'Headline tone is mixed. The cleaner edge still comes from the vol surface and the upcoming event stack.',
      ],
      keyStats: [
        { label: 'Current IV', value: '52.1%', tone: 'negative' },
        { label: '20D RV', value: '33.4%' },
        { label: 'IV Rank', value: '74', tone: 'negative' },
        { label: 'IV Percentile', value: '71' },
        { label: 'Expected Move', value: '--' },
        { label: 'Next Catalyst', value: 'Macro-led' },
      ],
      volMap: {
        overlayMode: 'current_iv_benchmark',
        overlayPoints: Array.from({ length: 10 }, (_, index) => ({
          date: `2026-03-${String(index + 1).padStart(2, '0')}`,
          label: `Mar ${index + 1}`,
          iv: 52.1,
          rv: 31 + index * 0.3,
        })),
        currentIV: 52.1,
        realizedVol10: 31.8,
        realizedVol20: 33.4,
        realizedVol30: 29.9,
        ivRank: 74,
        ivPercentile: 71,
        skewDirection: 'put_heavy',
        termStructureShape: 'contango',
        termStructure: [
          { date: '2026-03-20', dte: 11, atmIV: 52.1 },
          { date: '2026-04-17', dte: 39, atmIV: 45.6 },
        ],
        note: 'The overlay uses the current IV benchmark against trailing realized volatility over the last 30 sessions.',
      },
      catalysts: {
        densityStrip: Array.from({ length: 14 }, (_, index) => ({
          date: `2026-03-${String(index + 1).padStart(2, '0')}`,
          label: index === 0 ? 'Now' : `${index}D`,
          count: index === 3 ? 2 : 0,
          emphasis: index === 3 ? 'medium' : 'low',
        })),
        events: [
          {
            id: 'macro-cpi-2026-03-12',
            type: 'macro',
            title: 'CPI',
            date: '2026-03-12',
            daysUntil: 3,
            impact: 'high',
            summary: 'Inflation print can keep premium bid across the tape.',
          },
        ],
        narrative: 'Headline tone is mixed. The cleaner edge still comes from the vol surface and the upcoming event stack.',
      },
      risk: {
        invalidation: [
          'The thesis breaks if realized movement expands into the event window and premium stays bid.',
        ],
        watchItems: [
          'Regime context is Neutral. Read each setup through that lens before structuring risk.',
        ],
        notes: [
          'Structure Lab now proposes exact contract sets with deterministic scenario and payoff context.',
        ],
      },
      news: [
        {
          id: 'tsla-news-1',
          title: 'Tesla headlines stay mixed ahead of macro data',
          publishedAt: '2026-03-09T10:00:00.000Z',
          publisher: 'Massive News',
          summary: 'Investors are balancing delivery concerns with AI optimism.',
          url: 'https://example.com/tsla-news-1',
        },
      ],
      structureLab: buildStructureLab('TSLA', 'short_vol'),
    }
  }

  return {
    symbol: 'NVDA',
    companyName: 'NVIDIA Corporation',
    currentPrice: 918.44,
    score: 92,
    direction: 'long_vol',
    setupLabel: 'Cheap event gamma into catalyst window',
    expressionPreview: 'Calendar / strangle compare',
    thesis: 'Current IV sits below the recent realized tape while earnings in 8D can reprice premium quickly.',
    summary: 'Cheap event gamma into catalyst window. Current IV sits below the recent realized tape while earnings in 8D can reprice premium quickly.',
    saved,
    asOf: '2026-03-09T15:30:00.000Z',
    reasoning: [
      'IV benchmark is 34.6% against 20D RV at 41.2%, which is cheap by 6.6 vol points.',
      'Term structure is backwardation and skew is balanced.',
      'The next earnings window is 8D away with a 7.1% implied move.',
      'Recent headlines skew constructive, with the tape leaning toward growth and AI language.',
    ],
    keyStats: [
      { label: 'Current IV', value: '34.6%', tone: 'positive' },
      { label: '20D RV', value: '41.2%' },
      { label: 'IV Rank', value: '39', tone: 'positive' },
      { label: 'IV Percentile', value: '37' },
      { label: 'Expected Move', value: '7.1%' },
      { label: 'Next Catalyst', value: '8D' },
    ],
    volMap: {
      overlayMode: 'current_iv_benchmark',
      overlayPoints: Array.from({ length: 10 }, (_, index) => ({
        date: `2026-03-${String(index + 1).padStart(2, '0')}`,
        label: `Mar ${index + 1}`,
        iv: 34.6,
        rv: 39 + index * 0.2,
      })),
      currentIV: 34.6,
      realizedVol10: 39.4,
      realizedVol20: 41.2,
      realizedVol30: 38.8,
      ivRank: 39,
      ivPercentile: 37,
      skewDirection: 'balanced',
      termStructureShape: 'backwardation',
      termStructure: [
        { date: '2026-03-17', dte: 8, atmIV: 34.6 },
        { date: '2026-04-17', dte: 39, atmIV: 31.4 },
      ],
      note: 'The overlay uses the current IV benchmark against trailing realized volatility over the last 30 sessions.',
    },
    catalysts: {
      densityStrip: Array.from({ length: 14 }, (_, index) => ({
        date: `2026-03-${String(index + 1).padStart(2, '0')}`,
        label: index === 0 ? 'Now' : `${index}D`,
        count: index === 3 ? 1 : index === 8 ? 2 : 0,
        emphasis: index === 8 ? 'medium' : 'low',
      })),
      events: [
        {
          id: 'nvda-earnings',
          type: 'earnings',
          title: 'NVDA earnings',
          date: '2026-03-17',
          daysUntil: 8,
          impact: 'high',
          summary: 'Implied move 7.1% with fair pricing.',
          timing: 'Expected 8D',
          expectedMovePct: 7.1,
        },
        {
          id: 'macro-cpi-2026-03-12',
          type: 'macro',
          title: 'CPI',
          date: '2026-03-12',
          daysUntil: 3,
          impact: 'high',
          summary: 'Inflation print can lift index and semiconductor vol together.',
        },
      ],
      narrative: 'Recent headlines skew constructive, with the tape leaning toward growth and AI language.',
    },
    risk: {
      invalidation: [
        'The thesis weakens if IV reprices sharply higher before the catalyst and the cheap-gamma edge disappears.',
      ],
      watchItems: [
        'Regime context is Risk-On. Read each setup through that lens before structuring risk.',
      ],
      notes: [
        'Projected post-event IV crush proxy: 29%.',
        'Structure Lab now proposes exact contract sets with deterministic scenario and payoff context.',
      ],
    },
    news: [
      {
        id: 'nvda-news-1',
        title: 'NVIDIA headlines lean constructive ahead of earnings',
        publishedAt: '2026-03-09T10:00:00.000Z',
        publisher: 'Massive News',
        summary: 'AI demand and margin language remain supportive in the current tape.',
        url: 'https://example.com/nvda-news-1',
      },
    ],
    structureLab: buildStructureLab('NVDA', 'long_vol'),
  }
}

async function setupSwingSniperMocks(page: Page): Promise<void> {
  const state = {
    saved: false,
  }

  await page.route('**/api/config/roles*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })

  await page.route('**/api/config/tabs*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { tab_id: 'dashboard', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 1, label: 'Dashboard', icon: 'LayoutDashboard', path: '/members' },
          { tab_id: 'journal', required_tier: 'core', is_active: true, is_required: false, mobile_visible: true, sort_order: 2, label: 'Journal', icon: 'BookOpen', path: '/members/journal' },
          { tab_id: 'swing-sniper', required_tier: 'core', required_discord_role_ids: [SWING_SNIPER_LEAD_ROLE_ID], is_active: true, is_required: false, mobile_visible: true, sort_order: 5, label: 'Swing Sniper', icon: 'Radar', path: '/members/swing-sniper', badge_text: 'New', badge_variant: 'champagne' },
          { tab_id: 'profile', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 99, label: 'Profile', icon: 'UserCircle', path: '/members/profile' },
        ],
      }),
    })
  })

  await page.route('**/api/members/swing-sniper/health*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        status: 'ready',
        generatedAt: '2026-03-09T15:30:00.000Z',
        launchUniverseTarget: 150,
        dependencies: [
          { key: 'massive-core', label: 'Massive core market data', status: 'ready', message: 'Core connectivity is healthy.' },
          { key: 'options-reference', label: 'Options chain reference', status: 'ready', message: 'Options reference access is available.' },
        ],
        capabilities: {
          routeShell: true,
          opportunityBoard: true,
          dossier: true,
          structureLab: true,
          monitoring: true,
          backtesting: true,
        },
        notes: ['Risk Sentinel live.'],
      }),
    })
  })

  await page.route('**/api/members/swing-sniper/universe*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: '2026-03-09T15:30:00.000Z',
        universeSize: 24,
        symbolsScanned: 24,
        opportunities: [
          {
            symbol: 'NVDA',
            score: 92,
            direction: 'long_vol',
            setupLabel: 'Cheap event gamma into catalyst window',
            thesis: 'Current IV sits below the recent realized tape while earnings in 8D can reprice premium quickly.',
            currentPrice: 918.44,
            currentIV: 34.6,
            realizedVol20: 41.2,
            ivRank: 39,
            ivPercentile: 37,
            ivVsRvGap: -6.6,
            skewDirection: 'balanced',
            termStructureShape: 'backwardation',
            catalystLabel: 'Earnings 8D with 2 macro events nearby',
            catalystDate: '2026-03-17',
            catalystDaysUntil: 8,
            catalystDensity: 3,
            narrativeMomentum: 'positive',
            expressionPreview: 'Calendar / strangle compare',
            reasons: ['IV 34.6% vs 20D RV 41.2% (-6.6 pts).', 'Earnings 8D with 2 macro events nearby'],
            saved: state.saved,
            asOf: '2026-03-09T15:30:00.000Z',
          },
          {
            symbol: 'TSLA',
            score: 81,
            direction: 'short_vol',
            setupLabel: 'Rich front premium above realized tape',
            thesis: 'Premium is already elevated versus realized movement, so the cleaner edge is to wait for post-catalyst decay.',
            currentPrice: 241.32,
            currentIV: 52.1,
            realizedVol20: 33.4,
            ivRank: 74,
            ivPercentile: 71,
            ivVsRvGap: 18.7,
            skewDirection: 'put_heavy',
            termStructureShape: 'contango',
            catalystLabel: 'CPI 3D with a 2-event macro stack',
            catalystDate: '2026-03-12',
            catalystDaysUntil: 3,
            catalystDensity: 2,
            narrativeMomentum: 'mixed',
            expressionPreview: 'Defined-risk premium sale after event',
            reasons: ['IV 52.1% vs 20D RV 33.4% (+18.7 pts).', 'CPI 3D with a 2-event macro stack'],
            saved: false,
            asOf: '2026-03-09T15:30:00.000Z',
          },
        ],
        notes: ['Phase 1 ranks a focused liquid universe and saved symbols while the broader batched sweep is still pending.'],
      }),
    })
  })

  await page.route('**/api/members/swing-sniper/brief*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: '2026-03-09T15:30:00.000Z',
        regime: {
          label: 'Risk-On',
          description: 'Broad buying pressure across indices and sectors.',
          signals: ['SPX bullish momentum'],
        },
        memo: 'Regime: Risk-On. Broad buying pressure across indices and sectors. Nearest macro pressure points: CPI 03-12.',
        actionQueue: state.saved
          ? ['NVDA: stable edge (42 -> 44).']
          : ['Scan the top board names and save only ideas where the IV vs RV gap is obvious.'],
        savedTheses: state.saved
          ? [
            {
              symbol: 'NVDA',
              savedAt: '2026-03-09T15:30:00.000Z',
              score: 92,
              setupLabel: 'Cheap event gamma into catalyst window',
              direction: 'long_vol',
              thesis: 'Current IV sits below the recent realized tape while earnings in 8D can reprice premium quickly.',
              ivRankAtSave: 42,
              ivRankNow: 44,
              edgeState: 'stable',
              monitorNote: 'Waiting for earnings window.',
            },
          ]
          : [],
      }),
    })
  })

  await page.route('**/api/members/swing-sniper/monitoring*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildMonitoringPayload(state.saved)),
    })
  })

  await page.route('**/api/members/swing-sniper/backtest/*', async (route: Route) => {
    const url = route.request().url()
    const symbol = url.includes('/TSLA') ? 'TSLA' : 'NVDA'
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildBacktestPayload(symbol as 'NVDA' | 'TSLA')),
    })
  })

  await page.route('**/api/members/swing-sniper/watchlist', async (route: Route) => {
    if (route.request().method() === 'POST') {
      state.saved = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            symbols: ['NVDA'],
            selectedSymbol: 'NVDA',
            filters: { preset: 'all', minScore: 0 },
            savedTheses: [
              {
                symbol: 'NVDA',
                savedAt: '2026-03-09T15:30:00.000Z',
                score: 92,
                setupLabel: 'Cheap event gamma into catalyst window',
                direction: 'long_vol',
                thesis: 'Current IV sits below the recent realized tape while earnings in 8D can reprice premium quickly.',
                ivRankAtSave: 42,
                catalystLabel: 'NVDA earnings',
                catalystDate: '2026-03-17',
                monitorNote: 'Waiting for earnings window.',
              },
            ],
          },
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        symbols: state.saved ? ['NVDA'] : [],
        selectedSymbol: 'NVDA',
        filters: { preset: 'all', minScore: 0 },
        savedTheses: state.saved
          ? [
            {
              symbol: 'NVDA',
              savedAt: '2026-03-09T15:30:00.000Z',
              score: 92,
              setupLabel: 'Cheap event gamma into catalyst window',
              direction: 'long_vol',
              thesis: 'Current IV sits below the recent realized tape while earnings in 8D can reprice premium quickly.',
              ivRankAtSave: 42,
              catalystLabel: 'NVDA earnings',
              catalystDate: '2026-03-17',
              monitorNote: 'Waiting for earnings window.',
            },
          ]
          : [],
      }),
    })
  })

  await page.route('**/api/members/swing-sniper/dossier/*', async (route: Route) => {
    const url = route.request().url()
    const symbol = url.includes('/TSLA') ? 'TSLA' : 'NVDA'
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildDossier(symbol as 'NVDA' | 'TSLA', state.saved && symbol === 'NVDA')),
    })
  })
}

async function setupSwingSniperDeniedMocks(page: Page): Promise<void> {
  await page.route('**/api/config/roles*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })

  await page.route('**/api/config/tabs*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { tab_id: 'dashboard', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 1, label: 'Dashboard', icon: 'LayoutDashboard', path: '/members' },
          { tab_id: 'journal', required_tier: 'core', is_active: true, is_required: false, mobile_visible: true, sort_order: 2, label: 'Journal', icon: 'BookOpen', path: '/members/journal' },
          { tab_id: 'swing-sniper', required_tier: 'core', required_discord_role_ids: ['role-that-user-does-not-have'], is_active: true, is_required: false, mobile_visible: true, sort_order: 5, label: 'Swing Sniper', icon: 'Radar', path: '/members/swing-sniper', badge_text: 'New', badge_variant: 'champagne' },
          { tab_id: 'profile', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 99, label: 'Profile', icon: 'UserCircle', path: '/members/profile' },
        ],
      }),
    })
  })
}

test.describe('Swing Sniper member route', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableMemberBypass(page)
  })

  test('renders the live Phase 4 board, dossier, memo rail, and confidence surfaces', async ({ page }) => {
    await setupSwingSniperMocks(page)

    await page.goto(SWING_SNIPER_URL, { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('swing-sniper-shell')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Swing Sniper' })).toBeVisible()
    await expect(page.getByText('Research stack ready')).toBeVisible()
    await expect(page.getByRole('button', { name: /NVDA/ })).toContainText('Cheap event gamma into catalyst window')
    await expect(page.getByText('Market regime')).toBeVisible()
    await expect(page.getByText('Risk Sentinel').first()).toBeVisible()
    await expect(page.getByText('Portfolio PnL')).toBeVisible()

    await page.getByRole('button', { name: 'Vol Map' }).click()
    await expect(page.getByText('30-session IV vs RV overlay')).toBeVisible()

    await page.getByRole('button', { name: 'Catalysts' }).click()
    await expect(page.getByTestId('swing-sniper-dossier').getByText('Catalyst density strip')).toBeVisible()

    await page.getByRole('button', { name: 'Structure' }).click()
    await expect(page.getByTestId('swing-sniper-dossier').getByText('Long Straddle')).toBeVisible()
    await expect(page.getByTestId('swing-sniper-dossier').getByText('Structure lab notes')).toBeVisible()

    await page.getByRole('button', { name: /TSLA/ }).click()
    await expect(page.getByTestId('swing-sniper-dossier').getByRole('heading', { name: 'TSLA' })).toBeVisible()
    await expect(page.getByTestId('swing-sniper-dossier').getByText('Rich front premium above realized tape')).toBeVisible()

    await page.getByTestId('swing-sniper-dossier').getByRole('button', { name: 'Risk' }).click()
    await expect(page.getByTestId('swing-sniper-dossier').getByText('Adaptive confidence')).toBeVisible()
    await expect(page.getByText('Backtest confidence')).toBeVisible()
  })

  test('saves a thesis and reflects it in the memo rail', async ({ page }) => {
    await setupSwingSniperMocks(page)

    await page.goto(SWING_SNIPER_URL, { waitUntil: 'domcontentloaded' })

    await page.getByRole('button', { name: 'Save thesis' }).click()

    await expect(page.getByRole('button', { name: 'Update thesis' })).toBeVisible()
    await expect(page.getByText('Saved thesis queue')).toBeVisible()
    await expect(page.getByText('NVDA: stable edge (42 -> 44).')).toBeVisible()
    await expect(page.getByText('Saved at IV Rank 42, now 44.')).toBeVisible()
  })

  test('blocks deep-link access when the lead/admin gate is not met', async ({ page }) => {
    await setupSwingSniperDeniedMocks(page)

    await page.goto(SWING_SNIPER_URL, { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('swing-sniper-access-denied')).toBeVisible()
    await expect(page.getByText('Swing Sniper Access Required')).toBeVisible()
  })
})
