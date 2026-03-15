import { expect, test, type Page, type Route } from '@playwright/test'

import { authenticateAsMember } from '../../helpers/member-auth'

const MONEY_MAKER_URL = '/members/money-maker?e2eBypassAuth=1'
const MONEY_MAKER_ADMIN_URL = '/members/money-maker?e2eBypassAuth=1&e2eBypassRole=admin'

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

async function setupMoneyMakerShellMocks(page: Page): Promise<void> {
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
          { tab_id: 'money-maker', required_tier: 'admin', is_active: true, is_required: false, mobile_visible: true, sort_order: 3, label: 'Money Maker', icon: 'Target', path: '/members/money-maker', badge_text: 'Beta', badge_variant: 'emerald' },
          { tab_id: 'profile', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 99, label: 'Profile', icon: 'UserCircle', path: '/members/profile' },
        ],
      }),
    })
  })

  await page.route('**/api/members/money-maker/watchlist*', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        watchlists: [
          { symbol: 'SPY' },
          { symbol: 'TSLA' },
        ],
      }),
    })
  })

  await page.route('**/api/members/money-maker/snapshot*', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        signals: [
          {
            id: 'signal-spy',
            symbol: 'SPY',
            timestamp: 1773168720000,
            strategyType: 'KING_AND_QUEEN',
            strategyLabel: 'King & Queen',
            direction: 'long',
            patienceCandle: {
              pattern: 'hammer',
              bar: {
                timestamp: 1773168720000,
                open: 611.3,
                high: 612.1,
                low: 610.9,
                close: 611.9,
                volume: 1000,
              },
              bodyToRangeRatio: 0.2,
              dominantWickRatio: 0.55,
              timeframe: '5m',
            },
            confluenceZone: {
              priceLow: 611.7,
              priceHigh: 612.1,
              score: 4.5,
              label: 'strong',
              levels: [
                { source: 'VWAP', price: 611.9, weight: 1.5 },
                { source: 'Hourly Low', price: 611.8, weight: 1.4 },
              ],
              isKingQueen: true,
            },
            entry: 612.2,
            stop: 611.2,
            target: 613.5,
            riskRewardRatio: 2.1,
            orbRegime: 'trending_up',
            trendStrength: 82,
            signalRank: 1,
            status: 'ready',
            ttlSeconds: 300,
            expiresAt: 1773169020000,
          },
          {
            id: 'signal-aapl',
            symbol: 'AAPL',
            timestamp: 1773168720000,
            strategyType: 'FIB_REJECT',
            strategyLabel: 'Fib Reject',
            direction: 'short',
            patienceCandle: {
              pattern: 'inverted_hammer',
              bar: {
                timestamp: 1773168720000,
                open: 187.2,
                high: 187.5,
                low: 186.7,
                close: 186.9,
                volume: 900,
              },
              bodyToRangeRatio: 0.22,
              dominantWickRatio: 0.52,
              timeframe: '5m',
            },
            confluenceZone: {
              priceLow: 186.9,
              priceHigh: 187.3,
              score: 4.1,
              label: 'strong',
              levels: [
                { source: 'VWAP', price: 187.1, weight: 1.5 },
                { source: 'ORB High', price: 187.2, weight: 1.2 },
              ],
              isKingQueen: true,
            },
            entry: 186.7,
            stop: 187.35,
            target: 185.9,
            riskRewardRatio: 2.3,
            orbRegime: 'trending_down',
            trendStrength: 76,
            signalRank: 2,
            status: 'ready',
            ttlSeconds: 300,
            expiresAt: 1773169020000,
          },
        ],
        symbolSnapshots: [
          {
            symbol: 'SPY',
            price: 612.45,
            priceChange: 4.08,
            priceChangePercent: 0.67,
            orbRegime: 'trending_up',
            lastCandleAt: 1773168720000,
            hourlyLevels: {
              nearestSupport: 611.8,
              nextSupport: 610.9,
              nearestResistance: 613.5,
              nextResistance: 614.2,
            },
            indicators: {
              vwap: 611.9,
              ema8: 612.1,
              ema21: 610.75,
              ema34: 610.15,
              sma200: 603.2,
            },
            strongestConfluence: {
              label: 'strong',
              priceLow: 611.7,
              priceHigh: 612.1,
              score: 4.5,
              levels: [
                { source: 'VWAP', price: 611.9, weight: 1.5 },
                { source: 'Hourly High', price: 613.0, weight: 1.2 },
              ],
              isKingQueen: true,
            },
          },
          {
            symbol: 'TSLA',
            price: 238.18,
            priceChange: -1.05,
            priceChangePercent: -0.44,
            orbRegime: 'choppy',
            lastCandleAt: 1773168720000,
            hourlyLevels: {
              nearestSupport: 237.9,
              nextSupport: 237.2,
              nearestResistance: 239.1,
              nextResistance: 240.0,
            },
            indicators: {
              vwap: 238.55,
              ema8: 238.31,
              ema21: 237.92,
              ema34: 237.4,
              sma200: 229.4,
            },
            strongestConfluence: {
              label: 'moderate',
              priceLow: 237.75,
              priceHigh: 238.55,
              score: 3.8,
              levels: [
                { source: 'EMA 8', price: 238.31, weight: 1.1 },
                { source: 'Open Price', price: 237.8, weight: 0.9 },
              ],
              isKingQueen: false,
            },
          },
          {
            symbol: 'AAPL',
            price: 186.52,
            priceChange: -0.8,
            priceChangePercent: -0.43,
            orbRegime: 'trending_down',
            lastCandleAt: 1773168720000,
            hourlyLevels: {
              nearestSupport: 185.9,
              nextSupport: 185.1,
              nearestResistance: 187.2,
              nextResistance: 188.1,
            },
            indicators: {
              vwap: 187.1,
              ema8: 186.88,
              ema21: 187.02,
              ema34: 187.22,
              sma200: 180.4,
            },
            strongestConfluence: {
              label: 'strong',
              priceLow: 186.9,
              priceHigh: 187.3,
              score: 4.1,
              levels: [
                { source: 'VWAP', price: 187.1, weight: 1.5 },
                { source: 'ORB High', price: 187.2, weight: 1.2 },
              ],
              isKingQueen: true,
            },
          },
        ],
        timestamp: 1773168720000,
      }),
    })
  })

  await page.route('**/api/members/money-maker/workspace*', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    const url = new URL(route.request().url())
    const symbol = url.searchParams.get('symbol')

    if (symbol === 'SPY') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          symbolSnapshot: {
            symbol: 'SPY',
            price: 612.45,
            priceChange: 4.08,
            priceChangePercent: 0.67,
            orbRegime: 'trending_up',
            strongestConfluence: {
              priceLow: 611.7,
              priceHigh: 612.1,
              score: 4.5,
              label: 'strong',
              levels: [
                { source: 'VWAP', price: 611.9, weight: 1.5 },
                { source: 'Hourly Low', price: 611.8, weight: 1.4 },
              ],
              isKingQueen: true,
            },
            hourlyLevels: {
              nearestSupport: 611.8,
              nextSupport: 610.9,
              nearestResistance: 613.5,
              nextResistance: 614.2,
            },
            indicators: {
              vwap: 611.9,
              ema8: 612.1,
              ema21: 610.75,
              ema34: 610.15,
              sma200: 603.2,
            },
            lastCandleAt: 1773168720000,
          },
          activeSignal: {
            id: 'signal-spy',
            symbol: 'SPY',
            timestamp: 1773168720000,
            strategyType: 'KING_AND_QUEEN',
            strategyLabel: 'King & Queen',
            direction: 'long',
            patienceCandle: {
              pattern: 'hammer',
              bar: {
                timestamp: 1773168720000,
                open: 611.3,
                high: 612.1,
                low: 610.9,
                close: 611.9,
                volume: 1000,
              },
              bodyToRangeRatio: 0.2,
              dominantWickRatio: 0.55,
              timeframe: '5m',
            },
            confluenceZone: {
              priceLow: 611.7,
              priceHigh: 612.1,
              score: 4.5,
              label: 'strong',
              levels: [
                { source: 'VWAP', price: 611.9, weight: 1.5 },
                { source: 'Hourly Low', price: 611.8, weight: 1.4 },
              ],
              isKingQueen: true,
            },
            entry: 612.2,
            stop: 611.2,
            target: 613.5,
            riskRewardRatio: 2.1,
            orbRegime: 'trending_up',
            trendStrength: 82,
            signalRank: 1,
            status: 'ready',
            ttlSeconds: 300,
            expiresAt: 1773169020000,
          },
          executionPlan: {
            symbol: 'SPY',
            signalId: 'signal-spy',
            executionState: 'triggered',
            triggerDistance: -0.25,
            triggerDistancePct: -0.04,
            entry: 612.2,
            stop: 611.2,
            target1: 613.5,
            target2: 614.2,
            riskPerShare: 1.0,
            rewardToTarget1: 1.3,
            rewardToTarget2: 2.0,
            riskRewardRatio: 2.1,
            entryQuality: 'acceptable',
            idealEntryLow: 612.2,
            idealEntryHigh: 612.35,
            chaseCutoff: 612.45,
            timeWarning: 'normal',
            invalidationReason: 'Long setup invalidates below 611.20 because it loses the patience-candle low and breaks the support-led structure.',
            holdWhile: ['Hold while price remains above 612.20 after trigger confirmation.'],
            reduceWhen: ['Reduce or take gains when target 1 at 613.50 is hit.'],
            exitImmediatelyWhen: ['Exit immediately if stop 611.20 is breached.'],
          },
          contracts: [
            {
              label: 'primary',
              optionSymbol: 'SPY 2026-03-20 C 613',
              expiry: '2026-03-20',
              strike: 613,
              type: 'call',
              bid: 2.1,
              ask: 2.2,
              mid: 2.15,
              spreadPct: 4.7,
              delta: 0.48,
              theta: -0.07,
              impliedVolatility: 0.22,
              openInterest: 1200,
              volume: 340,
              premiumPerContract: 220,
              dte: 6,
              quality: 'green',
              explanation: 'Best balance of delta fit and spread quality.',
            },
          ],
          generatedAt: 1773168720000,
          degradedReason: null,
        }),
      })
      return
    }

    if (symbol === 'AAPL') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          symbolSnapshot: {
            symbol: 'AAPL',
            price: 186.52,
            priceChange: -0.8,
            priceChangePercent: -0.43,
            orbRegime: 'trending_down',
            strongestConfluence: {
              priceLow: 186.9,
              priceHigh: 187.3,
              score: 4.1,
              label: 'strong',
              levels: [
                { source: 'VWAP', price: 187.1, weight: 1.5 },
                { source: 'ORB High', price: 187.2, weight: 1.2 },
              ],
              isKingQueen: true,
            },
            hourlyLevels: {
              nearestSupport: 185.9,
              nextSupport: 185.1,
              nearestResistance: 187.2,
              nextResistance: 188.1,
            },
            indicators: {
              vwap: 187.1,
              ema8: 186.88,
              ema21: 187.02,
              ema34: 187.22,
              sma200: 180.4,
            },
            lastCandleAt: 1773168720000,
          },
          activeSignal: {
            id: 'signal-aapl',
            symbol: 'AAPL',
            timestamp: 1773168720000,
            strategyType: 'FIB_REJECT',
            strategyLabel: 'Fib Reject',
            direction: 'short',
            patienceCandle: {
              pattern: 'inverted_hammer',
              bar: {
                timestamp: 1773168720000,
                open: 187.2,
                high: 187.5,
                low: 186.7,
                close: 186.9,
                volume: 900,
              },
              bodyToRangeRatio: 0.22,
              dominantWickRatio: 0.52,
              timeframe: '5m',
            },
            confluenceZone: {
              priceLow: 186.9,
              priceHigh: 187.3,
              score: 4.1,
              label: 'strong',
              levels: [
                { source: 'VWAP', price: 187.1, weight: 1.5 },
                { source: 'ORB High', price: 187.2, weight: 1.2 },
              ],
              isKingQueen: true,
            },
            entry: 186.7,
            stop: 187.35,
            target: 185.9,
            riskRewardRatio: 2.3,
            orbRegime: 'trending_down',
            trendStrength: 76,
            signalRank: 2,
            status: 'ready',
            ttlSeconds: 300,
            expiresAt: 1773169020000,
          },
          executionPlan: {
            symbol: 'AAPL',
            signalId: 'signal-aapl',
            executionState: 'triggered',
            triggerDistance: -0.18,
            triggerDistancePct: -0.1,
            entry: 186.7,
            stop: 187.35,
            target1: 185.9,
            target2: 185.1,
            riskPerShare: 0.65,
            rewardToTarget1: 0.8,
            rewardToTarget2: 1.6,
            riskRewardRatio: 2.3,
            entryQuality: 'acceptable',
            idealEntryLow: 186.6,
            idealEntryHigh: 186.7,
            chaseCutoff: 186.5,
            timeWarning: 'normal',
            invalidationReason: 'Short setup invalidates above 187.35 because it reclaims the patience-candle high and restores failed bearish structure.',
            holdWhile: ['Hold while price remains below 186.70 after trigger confirmation.'],
            reduceWhen: ['Reduce or take gains when target 1 at 185.90 is hit.'],
            exitImmediatelyWhen: ['Exit immediately if stop 187.35 is breached.'],
          },
          contracts: [
            {
              label: 'primary',
              optionSymbol: 'AAPL 2026-03-20 P 186',
              expiry: '2026-03-20',
              strike: 186,
              type: 'put',
              bid: 1.95,
              ask: 2.05,
              mid: 2.0,
              spreadPct: 5.0,
              delta: -0.46,
              theta: -0.06,
              impliedVolatility: 0.24,
              openInterest: 980,
              volume: 210,
              premiumPerContract: 205,
              dte: 6,
              quality: 'green',
              explanation: 'Best balance of delta fit and spread quality.',
            },
          ],
          generatedAt: 1773168720000,
          degradedReason: null,
        }),
      })
      return
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Workspace not found' }),
    })
  })
}

test.describe('Money Maker member surface', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await enableMemberBypass(page)
    await setupMoneyMakerShellMocks(page)
  })

  test('renders live symbol snapshots for admin-authorized users', async ({ page }) => {
    await page.goto(MONEY_MAKER_ADMIN_URL, { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('money-maker-shell')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Money Maker' })).toBeVisible()
    await expect(page.getByTestId('money-maker-grid')).toBeVisible()

    const spyCard = page.getByTestId('money-maker-card-SPY')
    await expect(spyCard).toBeVisible()
    await expect(spyCard).toContainText('$612.45')
    await expect(spyCard).toContainText('+0.67%')
    await expect(spyCard).toContainText('trending up')
    await expect(spyCard).toContainText('King & Queen')
    await expect(spyCard.getByRole('button', { name: 'Open Plan' })).toBeVisible()

    const tslaCard = page.getByTestId('money-maker-card-TSLA')
    await expect(tslaCard).toBeVisible()
    await expect(tslaCard).toContainText('$238.18')
    await expect(tslaCard).toContainText('-0.44%')
    await expect(tslaCard).toContainText('choppy')
    await expect(tslaCard).toContainText('Open Plan')
  })

  test('opens a bullish planner workspace from the board and shows calls-only guidance', async ({ page }) => {
    await page.goto(MONEY_MAKER_ADMIN_URL, { waitUntil: 'domcontentloaded' })

    const spyCard = page.getByTestId('money-maker-card-SPY')
    await spyCard.getByRole('button', { name: 'Open Plan' }).click()

    await expect(page.getByText('Execution map for SPY')).toBeVisible()

    await page.getByRole('tab', { name: 'Contracts' }).evaluate((element: HTMLElement) => element.click())
    await expect(page.getByText('SPY 2026-03-20 C 613')).toBeVisible()

    await page.getByRole('tab', { name: 'Exit Playbook' }).evaluate((element: HTMLElement) => element.click())
    await expect(page.getByText('Hold while price remains above 612.20 after trigger confirmation.')).toBeVisible()
  })

  test('opens a bearish planner workspace from the board and shows puts-only guidance', async ({ page }) => {
    await page.goto(MONEY_MAKER_ADMIN_URL, { waitUntil: 'domcontentloaded' })

    const aaplCard = page.getByTestId('money-maker-card-AAPL')
    await aaplCard.getByRole('button', { name: 'Open Plan' }).click()

    await expect(page.getByText('Execution map for AAPL')).toBeVisible()

    await page.getByRole('tab', { name: 'Contracts' }).evaluate((element: HTMLElement) => element.click())
    await expect(page.getByText('AAPL 2026-03-20 P 186')).toBeVisible()

    await page.getByRole('tab', { name: 'Trade Plan' }).evaluate((element: HTMLElement) => element.click())
    await expect(page.getByText('Do Not Chase')).toBeVisible()
  })

  test('blocks direct route access for non-admin members', async ({ page }) => {
    await page.goto(MONEY_MAKER_URL, { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('money-maker-access-denied')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Money Maker Access Required' })).toBeVisible()
    await expect(page.getByText('Money Maker is currently restricted to backend admin accounts while the live strategy engine is validated.')).toBeVisible()
    await expect(page.getByTestId('money-maker-shell')).toHaveCount(0)
  })
})
