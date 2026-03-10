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

function buildDossier(symbol: 'NVDA' | 'TSLA') {
  if (symbol === 'TSLA') {
    return {
      symbol: 'TSLA',
      orc_score: 76,
      view: 'Short vol',
      catalyst_label: 'CPI in 3D',
      headline: 'Front-month premium looks stretched versus realized movement.',
      thesis: {
        summary: 'TSLA is flagged because implied volatility is rich and catalyst overlap suggests selective mean reversion setups.',
        risks: [
          'If realized volatility expands sharply, premium can stay elevated longer than expected.',
          'Macro shock risk can invalidate early decay assumptions.',
        ],
        narrative_shifts: [
          'Headline tone is mixed and less one-sided than the prior window.',
          'Macro sensitivity is dominating single-name narrative.',
        ],
        factors: {
          volatility: 79,
          catalyst: 72,
          liquidity: 81,
        },
      },
      vol_map: {
        surface_read: 'Near-dated term remains elevated relative to realized movement, especially in the front week.',
        iv_rank: 74,
        iv_percentile: 71,
        rv_20d: 33.4,
        iv_now: 52.1,
        skew: 'Put heavy',
        term_shape: 'Contango',
        term_structure: [
          { label: '7D', iv: 54 },
          { label: '14D', iv: 52 },
          { label: '21D', iv: 49 },
          { label: '35D', iv: 45 },
          { label: '49D', iv: 43 },
        ],
        iv_rv_history: Array.from({ length: 10 }, (_, index) => ({
          date: `2026-03-${String(index + 1).padStart(2, '0')}`,
          iv: 52.1,
          rv: 31 + index * 0.4,
        })),
      },
      catalysts: [
        {
          days_out: 3,
          date: '2026-03-12',
          label: 'CPI',
          context: 'Rates-sensitive macro print can expand realized range.',
          severity: 'high',
        },
      ],
      structures: [
        {
          name: 'Call Butterfly',
          fit_score: 8.4,
          rationale: 'Defined-risk approach for range-bound decay after macro event premium extension.',
          entry_type: 'Debit',
          max_loss: '$420',
          pop: 'High',
          style: 'Butterfly',
          contracts: null,
          scenario_distribution: null,
          payoff_diagram: null,
        },
      ],
      risk: {
        killers: [
          'Sustained post-event realized expansion above expected range.',
        ],
        exit_framework: 'If realized movement expands and IV fails to mean-revert, reduce risk rather than waiting for decay.',
      },
    }
  }

  return {
    symbol: 'NVDA',
    orc_score: 88,
    view: 'Long vol',
    catalyst_label: 'Earnings in 8D',
    headline: 'Front-month implied volatility looks cheap relative to the event stack and realized baseline.',
    thesis: {
      summary: 'NVDA is on the board because event timing is compressing while front volatility remains underpriced relative to recent realized movement.',
      risks: [
        'If IV reprices higher before entry, edge quality compresses quickly.',
        'A muted event outcome can leave theta in control.',
      ],
      narrative_shifts: [
        'Headline tone has turned more constructive on enterprise AI demand.',
        'Analyst language shifted from valuation pressure toward execution confidence.',
      ],
      factors: {
        volatility: 91,
        catalyst: 86,
        liquidity: 94,
      },
    },
    vol_map: {
      surface_read: 'Near-term expiry sits below what the catalyst stack would usually imply.',
      iv_rank: 39,
      iv_percentile: 37,
      rv_20d: 41.2,
      iv_now: 34.6,
      skew: 'Balanced',
      term_shape: 'Backwardation',
      term_structure: [
        { label: '7D', iv: 35 },
        { label: '14D', iv: 37 },
        { label: '21D', iv: 36 },
        { label: '35D', iv: 33 },
        { label: '49D', iv: 31 },
      ],
      iv_rv_history: Array.from({ length: 10 }, (_, index) => ({
        date: `2026-03-${String(index + 1).padStart(2, '0')}`,
        iv: 34.6,
        rv: 39 + index * 0.2,
      })),
    },
    catalysts: [
      {
        days_out: 8,
        date: '2026-03-17',
        label: 'Earnings',
        context: 'Expected move remains under historical average for this event profile.',
        severity: 'high',
      },
      {
        days_out: 3,
        date: '2026-03-12',
        label: 'CPI',
        context: 'Macro overlap can amplify event volatility repricing.',
        severity: 'high',
      },
    ],
    structures: [
      {
        name: 'Call Calendar',
        fit_score: 9.1,
        rationale: 'Best when event exposure is desired without paying full front-gamma cost.',
        entry_type: 'Debit',
        max_loss: 'Defined',
        pop: 'Medium',
        style: 'Calendar',
        contracts: [
          {
            leg: 'Buy far call',
            side: 'buy',
            optionType: 'call',
            expiry: '2026-04-17',
            strike: 920,
            quantity: 1,
            mark: 28.4,
            bid: 28.2,
            ask: 28.6,
            spreadPct: 1.4,
            delta: 0.52,
            openInterest: 9210,
            volume: 6500,
          },
          {
            leg: 'Sell near call',
            side: 'sell',
            optionType: 'call',
            expiry: '2026-03-21',
            strike: 920,
            quantity: 1,
            mark: 14.2,
            bid: 14.1,
            ask: 14.3,
            spreadPct: 1.4,
            delta: 0.5,
            openInterest: 11120,
            volume: 8400,
          },
        ],
        scenario_distribution: [
          { label: '-1.50σ', probability: 10, expectedPnl: -140, expectedReturnPct: -8.2 },
          { label: '-0.75σ', probability: 20, expectedPnl: -50, expectedReturnPct: -4.1 },
          { label: 'At spot', probability: 40, expectedPnl: 95, expectedReturnPct: 0 },
          { label: '+0.75σ', probability: 20, expectedPnl: 180, expectedReturnPct: 4.2 },
          { label: '+1.50σ', probability: 10, expectedPnl: 120, expectedReturnPct: 8.3 },
        ],
        payoff_diagram: [
          { price: 860, pnl: -320, returnPct: -8 },
          { price: 890, pnl: -120, returnPct: -4 },
          { price: 918, pnl: 60, returnPct: 0 },
          { price: 945, pnl: 210, returnPct: 3 },
          { price: 970, pnl: 80, returnPct: 6 },
        ],
      },
    ],
    risk: {
      killers: [
        'Pre-event IV expansion above fair-value band.',
        'Catalyst significance drops materially.',
      ],
      exit_framework: 'If IV rises above the expected band before realized movement confirms, trim or close to protect edge.',
    },
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
          score: 88,
          setupLabel: 'Long vol into earnings window',
          direction: 'long_vol',
          thesis: 'Front-month implied volatility looks cheap relative to the event stack and realized baseline.',
          ivRankAtSave: 42,
          ivRankNow: 44,
          edgeState: 'stable',
          monitorNote: 'Monitor IV drift into catalyst window.',
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
      openPositions: 0,
      totalPnl: 0,
      totalPnlPct: 0,
      riskLevel: 'low',
      warnings: ['No open positions found.'],
      netGreeks: {
        delta: 0,
        gamma: 0,
        theta: 0,
        vega: 0,
        rho: 0,
      },
      symbolExposure: [],
    },
    positionAdvice: [],
    alerts: saved
      ? [
        {
          id: 'thesis-nvda',
          source: 'thesis',
          symbol: 'NVDA',
          severity: 'low',
          title: 'NVDA thesis active',
          message: 'No immediate thesis invalidation triggers are active.',
          suggestedAction: null,
        },
      ]
      : [],
    notes: ['Risk Sentinel compares save-time IV state against current drift.'],
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

  await page.route('**/api/members/swing-sniper/board*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generated_at: '2026-03-09T15:30:00.000Z',
        regime: {
          label: 'Pre-event vol expansion',
          market_posture: 'Index range-bound',
          bias: 'Long vol favored in select names',
        },
        ideas: [
          {
            symbol: 'NVDA',
            orc_score: 88,
            view: 'Long vol',
            catalyst_label: 'Earnings in 8D',
            window_days: 8,
            blurb: 'Front-month IV looks cheap relative to event stack.',
            factors: { volatility: 91, catalyst: 86, liquidity: 94 },
          },
          {
            symbol: 'TSLA',
            orc_score: 76,
            view: 'Short vol',
            catalyst_label: 'CPI in 3D',
            window_days: 3,
            blurb: 'Premium remains elevated versus realized movement.',
            factors: { volatility: 79, catalyst: 72, liquidity: 81 },
          },
        ],
      }),
    })
  })

  await page.route('**/api/members/swing-sniper/memo*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generated_at: '2026-03-09T15:30:00.000Z',
        regime: {
          label: 'Pre-event vol expansion',
          market_posture: 'Index range-bound',
        },
        desk_note: 'Large-cap tech remains the cleanest long-vol pocket where event timing and realized-move history still justify premium.',
        themes: [
          'Event-sensitive long vol favored in select mega-cap tech.',
          'Do not chase already-expanded premium unless regime changed.',
        ],
        saved_theses: state.saved
          ? [
            {
              symbol: 'NVDA',
              label: 'Long vol into earnings window',
              saved_at: '2026-03-09T15:30:00.000Z',
            },
          ]
          : [],
        action_queue: state.saved ? ['Review NVDA structure before close.'] : [],
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
                score: 88,
                setupLabel: 'Long vol into earnings window',
                direction: 'long_vol',
                thesis: 'Front-month implied volatility looks cheap relative to the event stack and realized baseline.',
                ivRankAtSave: 42,
                catalystLabel: 'Earnings in 8D',
                catalystDate: '2026-03-17',
                monitorNote: 'Monitor IV drift into catalyst window.',
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
              score: 88,
              setupLabel: 'Long vol into earnings window',
              direction: 'long_vol',
              thesis: 'Front-month implied volatility looks cheap relative to the event stack and realized baseline.',
              ivRankAtSave: 42,
              catalystLabel: 'Earnings in 8D',
              catalystDate: '2026-03-17',
              monitorNote: 'Monitor IV drift into catalyst window.',
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
      body: JSON.stringify(buildDossier(symbol as 'NVDA' | 'TSLA')),
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

  test('renders the production board, dossier, and memo rail without internal status panels', async ({ page }) => {
    await setupSwingSniperMocks(page)

    await page.goto(SWING_SNIPER_URL, { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('swing-sniper-shell')).toBeVisible()
    await expect(page.getByText('Signal Board')).toBeVisible()
    await expect(page.getByRole('button', { name: /NVDA/ })).toBeVisible()
    await expect(page.getByTestId('swing-sniper-dossier').getByRole('heading', { name: 'NVDA' })).toBeVisible()
    await expect(page.getByText('Swing Sniper Memo')).toBeVisible()

    await expect(page.getByText('Research stack ready')).toHaveCount(0)
    await expect(page.getByText('What landed')).toHaveCount(0)
    await expect(page.getByText('Dependency preflight')).toHaveCount(0)

    await page.getByTestId('swing-sniper-dossier').getByRole('button', { name: 'Vol Map' }).click()
    await expect(page.getByText('Surface read')).toBeVisible()

    await page.getByTestId('swing-sniper-dossier').getByRole('button', { name: 'Catalysts' }).click()
    await expect(page.getByText('Catalyst stack')).toBeVisible()

    await page.getByTestId('swing-sniper-dossier').getByRole('button', { name: 'Structure' }).click()
    await expect(page.getByText('Call Calendar')).toBeVisible()

    await page.getByRole('button', { name: /TSLA/ }).click()
    await expect(page.getByTestId('swing-sniper-dossier').getByRole('heading', { name: 'TSLA' })).toBeVisible()
  })

  test('saves a thesis and reflects it in the memo rail', async ({ page }) => {
    await setupSwingSniperMocks(page)

    await page.goto(SWING_SNIPER_URL, { waitUntil: 'domcontentloaded' })

    await page.getByRole('button', { name: 'Save thesis' }).click()

    await expect(page.getByText('Saved thesis queue')).toBeVisible()
    await expect(page.getByText('NVDA - Long vol into earnings window')).toBeVisible()
    await expect(page.getByText('Action queue')).toBeVisible()
  })

  test('blocks deep-link access when the lead/admin gate is not met', async ({ page }) => {
    await setupSwingSniperDeniedMocks(page)

    await page.goto(SWING_SNIPER_URL, { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('swing-sniper-access-denied')).toBeVisible()
    await expect(page.getByText('Swing Sniper Access Required')).toBeVisible()
  })
})
