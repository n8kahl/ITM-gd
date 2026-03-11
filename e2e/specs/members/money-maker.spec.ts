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
        signals: [],
        symbolSnapshots: [
          {
            symbol: 'SPY',
            price: 612.45,
            priceChangePercent: 0.67,
            orbRegime: 'trending_up',
            lastCandleAt: 1773168720000,
            indicators: {
              vwap: 611.9,
              ema8: 612.1,
              ema21: 610.75,
              sma200: 603.2,
            },
            strongestConfluence: {
              label: 'strong',
              score: 4.5,
              levels: [
                { source: 'VWAP', price: 611.9 },
                { source: 'Hourly High', price: 613.0 },
              ],
            },
          },
          {
            symbol: 'TSLA',
            price: 238.18,
            priceChangePercent: -0.44,
            orbRegime: 'choppy',
            lastCandleAt: 1773168720000,
            indicators: {
              vwap: 238.55,
              ema8: 238.31,
              ema21: 237.92,
              sma200: 229.4,
            },
            strongestConfluence: {
              label: 'moderate',
              score: 3.8,
              levels: [
                { source: 'EMA 8', price: 238.31 },
                { source: 'Open Price', price: 237.8 },
              ],
            },
          },
        ],
        timestamp: 1773168720000,
      }),
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
    await expect(spyCard).toContainText('Strongest zone: strong')

    const tslaCard = page.getByTestId('money-maker-card-TSLA')
    await expect(tslaCard).toBeVisible()
    await expect(tslaCard).toContainText('$238.18')
    await expect(tslaCard).toContainText('-0.44%')
    await expect(tslaCard).toContainText('choppy')
    await expect(tslaCard).toContainText('Strongest zone: moderate')
  })

  test('blocks direct route access for non-admin members', async ({ page }) => {
    await page.goto(MONEY_MAKER_URL, { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('money-maker-access-denied')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Money Maker Access Required' })).toBeVisible()
    await expect(page.getByText('Money Maker is currently restricted to backend admin accounts while the live strategy engine is validated.')).toBeVisible()
    await expect(page.getByTestId('money-maker-shell')).toHaveCount(0)
  })
})
