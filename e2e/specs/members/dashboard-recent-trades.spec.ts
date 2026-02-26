import { test, expect } from '@playwright/test';
import {
  enableDashboardBypass,
  setupDashboardShellMocks,
  setupAllDashboardMocks,
  setupRecentTradesMock,
  createMockRecentTrades,
} from './dashboard-test-helpers';

const DASHBOARD_URL = '/members?e2eBypassAuth=1';

test.describe.configure({ mode: 'serial' });

test.describe('Dashboard Recent Trades Component', () => {
  test.beforeEach(async ({ page }) => {
    await enableDashboardBypass(page);
    await setupDashboardShellMocks(page);
  });

  test.setTimeout(60_000);

  test('shows recent trades when data exists', async ({ page }) => {
    await setupAllDashboardMocks(page);
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    const recentTradesRegion = page.locator('region[aria-label="Recent trades"]');
    await expect(recentTradesRegion).toBeVisible();

    const recentTradesHeading = recentTradesRegion.locator('h3:has-text("Recent Trades")');
    await expect(recentTradesHeading).toBeVisible();

    const spySymbol = recentTradesRegion.locator('text=SPY').first();
    await expect(spySymbol).toBeVisible();
  });

  test('displays P&L with color coding', async ({ page }) => {
    const trades = [
      {
        id: 'trade-001',
        symbol: 'SPY',
        direction: 'LONG',
        entry_price: 450,
        exit_price: 451,
        quantity: 100,
        pnl: 150,
        pnl_pct: 0.33,
        entry_date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        exit_date: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        ai_grade: 'A',
        notes: 'Positive trade',
      },
      {
        id: 'trade-002',
        symbol: 'TSLA',
        direction: 'SHORT',
        entry_price: 250,
        exit_price: 251,
        quantity: 50,
        pnl: -80,
        pnl_pct: -0.32,
        entry_date: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        exit_date: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        ai_grade: 'C',
        notes: 'Negative trade',
      },
    ];

    await setupRecentTradesMock(page, trades);
    await setupDashboardShellMocks(page);
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    const recentTradesRegion = page.locator('region[aria-label="Recent trades"]');
    await expect(recentTradesRegion).toBeVisible();

    const spySymbol = recentTradesRegion.locator('text=SPY');
    await expect(spySymbol).toBeVisible();

    const tslaSymbol = recentTradesRegion.locator('text=TSLA');
    await expect(tslaSymbol).toBeVisible();

    const positivePnL = recentTradesRegion.locator('text=/\+150|\\$150/');
    const negativePnL = recentTradesRegion.locator('text=/-80|\\$-80/');

    await expect(
      page.locator('region[aria-label="Recent trades"]').locator('text=/150|80/')
    ).toHaveCount(2);
  });

  test('shows empty state when no trades', async ({ page }) => {
    await setupRecentTradesMock(page, []);
    await setupDashboardShellMocks(page);
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    const recentTradesRegion = page.locator('region[aria-label="Recent trades"]');
    await expect(recentTradesRegion).toBeVisible();

    const recentTradesHeading = recentTradesRegion.locator('h3:has-text("Recent Trades")');
    await expect(recentTradesHeading).toBeVisible();

    const tradeRows = recentTradesRegion.locator('[role="row"]');
    await expect(tradeRows).toHaveCount(0);
  });

  test('displays AI grade badges', async ({ page }) => {
    const trades = [
      {
        id: 'trade-grade-a',
        symbol: 'AAPL',
        direction: 'LONG',
        entry_price: 175,
        exit_price: 176,
        quantity: 100,
        pnl: 100,
        pnl_pct: 0.57,
        entry_date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        exit_date: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        ai_grade: 'A',
        notes: 'Grade A trade',
      },
      {
        id: 'trade-grade-b',
        symbol: 'MSFT',
        direction: 'LONG',
        entry_price: 380,
        exit_price: 381,
        quantity: 50,
        pnl: 50,
        pnl_pct: 0.26,
        entry_date: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        exit_date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        ai_grade: 'B',
        notes: 'Grade B trade',
      },
    ];

    await setupRecentTradesMock(page, trades);
    await setupDashboardShellMocks(page);
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    const recentTradesRegion = page.locator('region[aria-label="Recent trades"]');
    await expect(recentTradesRegion).toBeVisible();

    const gradeABadge = recentTradesRegion.locator('text=A').first();
    const gradeBBadge = recentTradesRegion.locator('text=B').first();

    await expect(gradeABadge).toBeVisible();
    await expect(gradeBBadge).toBeVisible();
  });
});
