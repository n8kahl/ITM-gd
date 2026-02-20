import type { Page, Route } from '@playwright/test'

interface SPXMockOptions {
  delayMs?: number
  omitPrediction?: boolean
  alignCoachMessagesToChart?: boolean
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
    alternatives: [
      {
        description: '6035C 2026-03-20',
        strike: 6035,
        expiry: '2026-03-20',
        type: 'call',
        delta: 0.29,
        bid: 20.4,
        ask: 20.9,
        spreadPct: 2.4,
        liquidityScore: 78,
        maxLoss: 2090,
        healthScore: 76,
        healthTier: 'green',
        tag: 'safer',
        tradeoff: 'Lower delta for less directional sensitivity.',
        score: 87,
      },
    ],
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
    alternatives: [
      {
        description: '6015P 2026-03-20',
        strike: 6015,
        expiry: '2026-03-20',
        type: 'put',
        delta: -0.31,
        bid: 22.2,
        ask: 22.8,
        spreadPct: 2.6,
        liquidityScore: 73,
        maxLoss: 2280,
        healthScore: 71,
        healthTier: 'amber',
        tag: 'safer',
        tradeoff: 'Cheaper premium with slightly less participation.',
        score: 85,
      },
      {
        description: '6025P 2026-03-20',
        strike: 6025,
        expiry: '2026-03-20',
        type: 'put',
        delta: -0.41,
        bid: 30.8,
        ask: 31.4,
        spreadPct: 1.9,
        liquidityScore: 82,
        maxLoss: 3140,
        healthScore: 79,
        healthTier: 'green',
        tag: 'higher_conviction',
        tradeoff: 'Higher delta conviction but increased premium outlay.',
        score: 90,
      },
    ],
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
      content: 'Primary setup ready near 6030. Fade-at-wall setup has 4/5 confluence and watch 6025 for invalidation.',
      structuredData: { setupId: 'setup-1' },
      timestamp: nowIso,
    },
    {
      id: 'coach-state-2',
      type: 'alert',
      priority: 'alert',
      setupId: 'setup-2',
      content: 'Breakout vacuum trigger at 6018 remains active. If price reclaims 6024, reduce exposure.',
      structuredData: { setupId: 'setup-2' },
      timestamp: '2026-02-15T15:11:00.000Z',
    },
  ],
  generatedAt: nowIso,
}

function buildCoachMessagesPayload(options?: { alignToChart?: boolean }) {
  if (!options?.alignToChart) {
    return coachState.messages
  }

  const bars = chartResponse.bars
  const alignedTimes = [
    bars[Math.max(0, bars.length - 10)]?.time,
    bars[Math.max(0, bars.length - 6)]?.time,
    bars[Math.max(0, bars.length - 3)]?.time,
  ].filter((time): time is number => Number.isFinite(time))

  return coachState.messages.map((message, index) => {
    const alignedTime = alignedTimes[index % alignedTimes.length]
    if (!alignedTime) return message
    return {
      ...message,
      timestamp: new Date(alignedTime * 1000).toISOString(),
    }
  })
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
    {
      id: 'flow-2',
      type: 'block',
      symbol: 'SPX',
      strike: 6025,
      expiry: '2026-03-20',
      size: 620,
      direction: 'bearish',
      premium: 86000,
      timestamp: '2026-02-15T15:10:00.000Z',
    },
    {
      id: 'flow-3',
      type: 'sweep',
      symbol: 'SPY',
      strike: 603,
      expiry: '2026-03-20',
      size: 730,
      direction: 'bullish',
      premium: 54000,
      timestamp: '2026-02-15T15:09:00.000Z',
    },
  ],
  count: 3,
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
  const { delayMs = 0, omitPrediction = false, alignCoachMessagesToChart = false } = options
  let coachMessageSequence = 0
  const coachMessagesPayload = buildCoachMessagesPayload({ alignToChart: alignCoachMessagesToChart })
  const coachStatePayload = {
    ...coachState,
    messages: coachMessagesPayload,
  }
  const regimePayload = omitPrediction
    ? {
      ...regimeResponse,
      prediction: {
        ...regimeResponse.prediction,
        probabilityCone: [],
      },
    }
    : regimeResponse
  const snapshotPayload = omitPrediction
    ? {
      ...snapshotResponse,
      prediction: {
        ...(snapshotResponse.prediction || {}),
        probabilityCone: [],
      },
      coachMessages: coachMessagesPayload,
    }
    : {
      ...snapshotResponse,
      coachMessages: coachMessagesPayload,
    }

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
      coachMessageSequence += 1
      const sequence = coachMessageSequence
      let requestSetupId = 'setup-1'
      const rawBody = req.postData()
      if (rawBody) {
        try {
          const parsed = JSON.parse(rawBody) as { setupId?: string }
          if (typeof parsed.setupId === 'string' && parsed.setupId.trim()) {
            requestSetupId = parsed.setupId
          }
        } catch {
          requestSetupId = 'setup-1'
        }
      }
      const eventOne = {
        id: `coach-live-1-${sequence}`,
        type: 'in_trade',
        priority: 'alert',
        setupId: requestSetupId,
        content: coachLongMessage,
        structuredData: {
          setupId: requestSetupId,
          recommendedActions: ['Consider Entry', 'Adjust Stop', 'Take Partial'],
        },
        timestamp: new Date(Date.parse(nowIso) + sequence * 1_000).toISOString(),
      }
      const eventTwo = {
        id: `coach-live-2-${sequence}`,
        type: 'behavioral',
        priority: 'behavioral',
        setupId: requestSetupId,
        content: 'Execution quality is stable. Keep entries rules-based.',
        structuredData: {
          discipline: 'good',
          recommendedActions: ['Hold / Wait', 'Reduce Size'],
        },
        timestamp: new Date(Date.parse(nowIso) + sequence * 1_000 + 250).toISOString(),
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

    if (req.method() === 'POST' && endpoint === 'coach/decision') {
      let setupId: string | null = 'setup-1'
      let tradeMode: 'scan' | 'evaluate' | 'in_trade' = 'evaluate'

      const rawBody = req.postData()
      if (rawBody) {
        try {
          const parsed = JSON.parse(rawBody) as {
            setupId?: string
            tradeMode?: 'scan' | 'evaluate' | 'in_trade'
          }
          if (typeof parsed.setupId === 'string' && parsed.setupId.trim()) {
            setupId = parsed.setupId
          }
          if (parsed.tradeMode === 'scan' || parsed.tradeMode === 'evaluate' || parsed.tradeMode === 'in_trade') {
            tradeMode = parsed.tradeMode
          }
        } catch {
          setupId = 'setup-1'
        }
      }

      const setup = mockSetups.find((item) => item.id === setupId) || null
      const verdict = tradeMode === 'in_trade' ? 'REDUCE' : (setup?.status === 'triggered' ? 'ENTER' : 'WAIT')
      const confidence = verdict === 'ENTER' ? 78 : verdict === 'REDUCE' ? 71 : 63

      await fulfillJson(route, {
        decisionId: `coach-decision-${Date.now()}`,
        setupId: setup?.id || setupId || null,
        verdict,
        confidence,
        primaryText: verdict === 'ENTER'
          ? `Entry window is open for ${setup?.direction || 'the selected'} setup. Execute with strict risk controls.`
          : verdict === 'REDUCE'
            ? 'Risk is elevated for this active trade. Tighten stop and reduce size if confirmation weakens.'
            : 'Wait for cleaner confirmation before executing this setup.',
        why: verdict === 'ENTER'
          ? ['Confluence is elevated with supportive setup structure.', 'Flow remains aligned with the setup direction.']
          : verdict === 'REDUCE'
            ? ['Flow opposition has increased against your position.', 'Stop proximity has tightened risk tolerance.']
            : ['Current context does not justify immediate entry.'],
        riskPlan: {
          stop: setup?.stop ?? null,
          maxRiskDollars: setup ? 340 : 280,
          positionGuidance: verdict === 'ENTER'
            ? 'Start controlled and add only on confirmation.'
            : 'Preserve risk budget while waiting for confirmation.',
        },
        actions: tradeMode === 'in_trade'
          ? [
            { id: 'EXIT_TRADE_FOCUS', label: 'Exit Trade Focus', style: 'secondary', payload: { setupId: setup?.id || setupId } },
            { id: 'OPEN_HISTORY', label: 'Open Coach History', style: 'ghost' },
          ]
          : [
            { id: 'ENTER_TRADE_FOCUS', label: 'Enter Trade Focus', style: 'primary', payload: { setupId: setup?.id || setupId } },
            { id: 'REVERT_AI_CONTRACT', label: 'Use AI Contract', style: 'secondary', payload: { setupId: setup?.id || setupId } },
            { id: 'OPEN_HISTORY', label: 'Open Coach History', style: 'ghost' },
          ],
        severity: verdict === 'REDUCE' ? 'warning' : 'routine',
        freshness: {
          generatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          stale: false,
        },
        contextHash: 'sha256:e2e-mock',
        source: 'fallback_v1',
      })
      return
    }

    if (endpoint === 'levels') {
      await fulfillJson(route, levelsResponse)
      return
    }

    if (endpoint === 'snapshot') {
      await fulfillJson(route, snapshotPayload)
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
      await fulfillJson(route, regimePayload)
      return
    }

    if (endpoint === 'basis') {
      await fulfillJson(route, basisResponse)
      return
    }

    if (endpoint === 'coach/state') {
      await fulfillJson(route, coachStatePayload)
      return
    }

    if (endpoint === 'contract-select') {
      let setupId = url.searchParams.get('setupId') || ''
      if (!setupId && req.method() === 'POST') {
        const rawBody = req.postData()
        if (rawBody) {
          try {
            const parsed = JSON.parse(rawBody) as { setupId?: string; setup?: { id?: string } }
            setupId = parsed.setupId || parsed.setup?.id || ''
          } catch {
            setupId = ''
          }
        }
      }
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
