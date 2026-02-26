import { test, expect } from '@playwright/test';
import {
  enableDashboardBypass,
  setupDashboardShellMocks,
  setupAllDashboardMocks,
  setupMarketDataMocks,
} from './dashboard-test-helpers';

const DASHBOARD_URL = '/members?e2eBypassAuth=1';

test.describe.configure({ mode: 'serial' });

test.describe('Dashboard Market Ticker Component', () => {
  test.beforeEach(async ({ page }) => {
    await enableDashboardBypass(page);
    await setupDashboardShellMocks(page);
  });

  test.setTimeout(60_000);

  test('renders market indices with prices', async ({ page }) => {
    await setupAllDashboardMocks(page);
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    const marketTickerRegion = page.locator('region[aria-label="Live market ticker"]');
    await expect(marketTickerRegion).toBeVisible();

    const spxIndicator = marketTickerRegion.locator('text=/SPX|S&P 500/');
    await expect(spxIndicator).toBeVisible();
  });

  test('shows market status badge', async ({ page }) => {
    await setupAllDashboardMocks(page);
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    const marketTickerRegion = page.locator('region[aria-label="Live market ticker"]');
    await expect(marketTickerRegion).toBeVisible();

    const statusBadge = marketTickerRegion.locator(
      'text=/Market Open|Pre-Market|After Hours|Market Closed/'
    );
    await expect(statusBadge).toBeVisible();
  });

  test('displays price changes with direction', async ({ page }) => {
    await setupAllDashboardMocks(page);
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    const marketTickerRegion = page.locator('region[aria-label="Live market ticker"]');
    await expect(marketTickerRegion).toBeVisible();

    const priceData = marketTickerRegion.locator('text=/\\d+\\.\\d{2}/');
    await expect(priceData.first()).toBeVisible();
  });

  test('renders all major indices', async ({ page }) => {
    await setupAllDashboardMocks(page);
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    const marketTickerRegion = page.locator('region[aria-label="Live market ticker"]');
    await expect(marketTickerRegion).toBeVisible();

    const indices = ['SPX', 'NDX', 'SPY', 'QQQ'];
    for (const index of indices) {
      const indexElement = marketTickerRegion.locator(`text=${index}`);
      await expect(indexElement).toBeVisible();
    }
  });

  test('market ticker loads without errors', async ({ page }) => {
    let hasConsoleErrors = false;

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        hasConsoleErrors = true;
      }
    });

    await setupAllDashboardMocks(page);
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    const marketTickerRegion = page.locator('region[aria-label="Live market ticker"]');
    await expect(marketTickerRegion).toBeVisible();

    expect(hasConsoleErrors).toBe(false);
  });
});
