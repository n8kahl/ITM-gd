import type { Page, Route } from '@playwright/test'

interface SPXMockOptions {
  delayMs?: number
}

const nowIso = '2026-02-15T15:12:00.000Z'

const mockClusterZone = {
  id: 'cluster-1',
  priceLow: 6028,
  priceHigh: 6032,
  clusterScore: 4.2,
  type: 'defended',
  sources: [
    { source: 'spx_call_wall', category: 'options', price: 6030, instrument: 'SPX' },
    { source: 'fib_618_daily', category: 'fibonacci', price: 6031, instrument: 'SPX' },
  ],
  testCount: 2,
  lastTestAt: '2026-02-15T15:00:00.000Z',
  held: true,
  holdRate: 68,
}

const mockSetups = [
  {
    id: 'setup-1',
    type: 'fade_at_wall',
    direction: 'bullish',
    entryZone: { low: 6028, high: 6030 },
    stop: 6024,
    target1: { price: 6038, label: 'Target 1' },
    target2: { price: 6044, label: 'Target 2' },
    confluenceScore: 4,
    confluenceSources: ['level_quality', 'gex_alignment', 'flow_confirmation', 'regime_alignment'],
    clusterZone: mockClusterZone,
    regime: 'ranging',
    status: 'ready',
    probability: 71,
    recommendedContract: null,
    createdAt: '2026-02-15T15:05:00.000Z',
    triggeredAt: null,
  },
  {
    id: 'setup-2',
    type: 'breakout_vacuum',
    direction: 'bearish',
    entryZone: { low: 6018, high: 6020 },
    stop: 6024,
    target1: { price: 6008, label: 'Target 1' },
    target2: { price: 5996, label: 'Target 2' },
    confluenceScore: 5,
    confluenceSources: ['level_quality', 'gex_alignment', 'flow_confirmation', 'fibonacci_touch', 'regime_alignment'],
    clusterZone: {
      ...mockClusterZone,
      id: 'cluster-2',
      priceLow: 6018,
      priceHigh: 6020,
      clusterScore: 4.8,
      type: 'fortress',
    },
    regime: 'breakout',
    status: 'triggered',
    probability: 78,
    recommendedContract: null,
    createdAt: '2026-02-15T15:08:00.000Z',
    triggeredAt: '2026-02-15T15:10:00.000Z',
  },
]

const contractBySetupId: Record<string, Record<string, unknown>> = {
  'setup-1': {
    description: '6030C 2026-03-20',
    strike: 6030,
    expiry: '2026-03-20',
    type: 'call',
    delta: 0.34,
    gamma: 0.021,
    theta: -0.031,
    vega: 0.081,
    bid: 24.1,
    ask: 24.6,
    riskReward: 2.12,
    expectedPnlAtTarget1: 182,
    expectedPnlAtTarget2: 336,
    maxLoss: 2460,
    reasoning: 'Bullish fade setup with positive gamma support.',
  },
  'setup-2': {
    description: '6020P 2026-03-20',
    strike: 6020,
    expiry: '2026-03-20',
    type: 'put',
    delta: -0.36,
    gamma: 0.023,
    theta: -0.033,
    vega: 0.082,
    bid: 26.5,
    ask: 27.0,
    riskReward: 2.35,
    expectedPnlAtTarget1: 214,
    expectedPnlAtTarget2: 392,
    maxLoss: 2700,
    reasoning: 'Breakout continuation aligned with bearish flow and vacuum.',
  },
}

export const coachLongMessage = [
  'Price is pressing into the 6030 defended zone with supportive gamma.',
  'Scale only after acceptance above VWAP and keep risk fixed to your predefined stop.',
  'If flow diverges for more than two prints, reduce size and wait for confirmation before re-entry.',
].join(' ')

const coachState = {
  messages: [
    {
      id: 'coach-state-1',
      type: 'pre_trade',
      priority: 'setup',
      setupId: 'setup-1',
      content: 'Primary setup ready: fade_at_wall with 4/5 confluence.',
      structuredData: { setupId: 'setup-1' },
      timestamp: nowIso,
    },
  ],
  generatedAt: nowIso,
}

function buildChartBars() {
  const start = 1739605200 // 2025-02-15T14:00:00Z
  let price = 6024

  return Array.from({ length: 120 }).map((_, idx) => {
    const open = price
    const drift = Math.sin(idx / 8) * 1.2
    const close = Number((open + drift + 0.15).toFixed(2))
    const high = Number((Math.max(open, close) + 1.4).toFixed(2))
    const low = Number((Math.min(open, close) - 1.3).toFixed(2))
    price = close

    return {
      time: start + idx * 300,
      open,
      high,
      low,
      close,
      volume: 1200 + idx * 4,
    }
  })
}

const chartResponse = {
  symbol: 'SPX',
  timeframe: '5m',
  bars: buildChartBars(),
  count: 120,
  timestamp: nowIso,
  cached: true,
}

const gexByStrike = [
  { strike: 6000, gex: -1800 },
  { strike: 6010, gex: -1200 },
  { strike: 6020, gex: -500 },
  { strike: 6030, gex: 900 },
  { strike: 6040, gex: 1400 },
  { strike: 6050, gex: 1900 },
]

const gexProfile = {
  spx: {
    netGex: 2300,
    flipPoint: 6026,
    callWall: 6050,
    putWall: 6000,
    zeroGamma: 6026,
    gexByStrike,
    keyLevels: [{ strike: 6050, gex: 1900, type: 'call_wall' }],
    expirationBreakdown: {
      '2026-02-20': { netGex: 1300, callWall: 6050, putWall: 6010 },
      '2026-03-20': { netGex: 1000, callWall: 6040, putWall: 6000 },
    },
    timestamp: nowIso,
  },
  spy: {
    netGex: 1100,
    flipPoint: 602,
    callWall: 604,
    putWall: 600,
    zeroGamma: 602,
    gexByStrike: [
      { strike: 600, gex: -900 },
      { strike: 602, gex: 300 },
      { strike: 604, gex: 900 },
    ],
    keyLevels: [{ strike: 604, gex: 900, type: 'call_wall' }],
    expirationBreakdown: {
      '2026-02-20': { netGex: 700, callWall: 604, putWall: 601 },
      '2026-03-20': { netGex: 400, callWall: 603, putWall: 600 },
    },
    timestamp: nowIso,
  },
  combined: {
    netGex: 3400,
    flipPoint: 6025,
    callWall: 6050,
    putWall: 6000,
    zeroGamma: 6025,
    gexByStrike,
    keyLevels: [{ strike: 6050, gex: 2200, type: 'call_wall' }],
    expirationBreakdown: {
      '2026-02-20': { netGex: 2000, callWall: 6050, putWall: 6010 },
      '2026-03-20': { netGex: 1400, callWall: 6040, putWall: 6000 },
    },
    timestamp: nowIso,
  },
}

const levelsResponse = {
  levels: [
    {
      id: 'level-1',
      symbol: 'SPX',
      category: 'options',
      source: 'SPX Call Wall',
      price: 6050,
      strength: 'critical',
      timeframe: '0dte',
      metadata: { description: 'Primary call wall' },
      chartStyle: {
        color: '#10B981',
        lineStyle: 'solid',
        lineWidth: 2,
        labelFormat: 'CW',
      },
    },
    {
      id: 'level-2',
      symbol: 'SPX',
      category: 'fibonacci',
      source: 'fib_618_daily',
      price: 6031,
      strength: 'strong',
      timeframe: 'daily',
      metadata: { description: 'Daily 61.8 retracement' },
      chartStyle: {
        color: '#F4D078',
        lineStyle: 'dashed',
        lineWidth: 1,
        labelFormat: 'F',
      },
    },
    {
      id: 'level-3',
      symbol: 'SPY',
      category: 'spy_derived',
      source: 'SPY Call Wall (Converted)',
      price: 6049,
      strength: 'moderate',
      timeframe: '0dte',
      metadata: { description: 'SPY mapped level' },
      chartStyle: {
        color: '#7DD3FC',
        lineStyle: 'dot-dash',
        lineWidth: 1,
        labelFormat: 'S',
      },
    },
  ],
  generatedAt: nowIso,
}

const clustersResponse = {
  zones: [mockClusterZone],
  generatedAt: nowIso,
}

const fibonacciResponse = {
  levels: [
    {
      ratio: 0.618,
      price: 6031,
      timeframe: 'daily',
      direction: 'retracement',
      swingHigh: 6060,
      swingLow: 5990,
      crossValidated: true,
    },
  ],
  count: 1,
  generatedAt: nowIso,
}

const flowResponse = {
  events: [
    {
      id: 'flow-1',
      type: 'sweep',
      symbol: 'SPX',
      strike: 6050,
      expiry: '2026-03-20',
      size: 850,
      direction: 'bullish',
      premium: 120000,
      timestamp: nowIso,
    },
  ],
  count: 1,
  generatedAt: nowIso,
}

const regimeResponse = {
  regime: 'ranging',
  direction: 'bullish',
  probability: 64,
  magnitude: 'medium',
  confidence: 72,
  timestamp: nowIso,
  prediction: {
    regime: 'ranging',
    direction: { bullish: 48, bearish: 29, neutral: 23 },
    magnitude: { small: 30, medium: 55, large: 15 },
    timingWindow: { description: 'Supportive pullback window', actionable: true },
    nextTarget: {
      upside: { price: 6044, zone: 'upper-cluster' },
      downside: { price: 6018, zone: 'lower-cluster' },
    },
    probabilityCone: [
      { minutesForward: 5, high: 6038, low: 6025, center: 6031, confidence: 71 },
      { minutesForward: 15, high: 6048, low: 6018, center: 6032, confidence: 64 },
    ],
    confidence: 72,
  },
}

const basisResponse = {
  current: 1.9,
  trend: 'stable',
  leading: 'neutral',
  ema5: 1.8,
  ema20: 1.7,
  zscore: 0.4,
  spxPrice: 6032,
  spyPrice: 603,
  timestamp: nowIso,
}

const snapshotResponse = {
  levels: levelsResponse.levels,
  clusters: clustersResponse.zones,
  fibLevels: fibonacciResponse.levels,
  gex: gexProfile,
  basis: basisResponse,
  setups: mockSetups,
  regime: {
    regime: regimeResponse.regime,
    direction: regimeResponse.direction,
    probability: regimeResponse.probability,
    magnitude: regimeResponse.magnitude,
    confidence: regimeResponse.confidence,
    timestamp: regimeResponse.timestamp,
  },
  prediction: regimeResponse.prediction,
  flow: flowResponse.events,
  coachMessages: coachState.messages,
  generatedAt: nowIso,
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

export async function setupSPXCommandCenterMocks(page: Page, options: SPXMockOptions = {}): Promise<void> {
  const { delayMs = 0 } = options

  await page.route('**/api/chart/SPX*', async (route) => {
    await delay(delayMs)
    await fulfillJson(route, chartResponse)
  })

  await page.route('**/api/spx/**', async (route) => {
    await delay(delayMs)

    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    const endpoint = path.split('/api/spx/')[1] || ''

    if (req.method() === 'POST' && endpoint === 'coach/message') {
      const eventOne = {
        id: 'coach-live-1',
        type: 'in_trade',
        priority: 'alert',
        setupId: 'setup-1',
        content: coachLongMessage,
        structuredData: { setupId: 'setup-1' },
        timestamp: nowIso,
      }
      const eventTwo = {
        id: 'coach-live-2',
        type: 'behavioral',
        priority: 'behavioral',
        setupId: 'setup-1',
        content: 'Execution quality is stable. Keep entries rules-based.',
        structuredData: { discipline: 'good' },
        timestamp: nowIso,
      }

      const sseBody = [
        'event: coach_message',
        `data: ${JSON.stringify(eventOne)}`,
        '',
        'event: coach_message',
        `data: ${JSON.stringify(eventTwo)}`,
        '',
        'event: done',
        'data: {"count":2}',
        '',
      ].join('\n')

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: {
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
        body: sseBody,
      })
      return
    }

    if (endpoint === 'levels') {
      await fulfillJson(route, levelsResponse)
      return
    }

    if (endpoint === 'snapshot') {
      await fulfillJson(route, snapshotResponse)
      return
    }

    if (endpoint === 'clusters') {
      await fulfillJson(route, clustersResponse)
      return
    }

    if (endpoint === 'gex') {
      await fulfillJson(route, gexProfile)
      return
    }

    if (endpoint === 'setups') {
      await fulfillJson(route, {
        setups: mockSetups,
        count: mockSetups.length,
        generatedAt: nowIso,
      })
      return
    }

    if (endpoint.startsWith('setups/')) {
      const id = endpoint.split('/')[1]
      const setup = mockSetups.find((item) => item.id === id)
      if (!setup) {
        await fulfillJson(route, { error: 'Not found' }, 404)
        return
      }
      await fulfillJson(route, setup)
      return
    }

    if (endpoint === 'fibonacci') {
      await fulfillJson(route, fibonacciResponse)
      return
    }

    if (endpoint === 'flow') {
      await fulfillJson(route, flowResponse)
      return
    }

    if (endpoint === 'regime') {
      await fulfillJson(route, regimeResponse)
      return
    }

    if (endpoint === 'basis') {
      await fulfillJson(route, basisResponse)
      return
    }

    if (endpoint === 'coach/state') {
      await fulfillJson(route, coachState)
      return
    }

    if (endpoint === 'contract-select') {
      const setupId = url.searchParams.get('setupId') || ''
      const contract = contractBySetupId[setupId]
      if (!contract) {
        await fulfillJson(route, { error: 'No recommendation' }, 404)
        return
      }
      await fulfillJson(route, contract)
      return
    }

    await fulfillJson(route, { error: 'Unmocked endpoint', endpoint }, 500)
  })
}

export const spxMockSetupIds = {
  primary: 'setup-1',
  secondary: 'setup-2',
}

export const spxMockContracts = {
  primaryDescription: String(contractBySetupId['setup-1'].description),
  secondaryDescription: String(contractBySetupId['setup-2'].description),
}
