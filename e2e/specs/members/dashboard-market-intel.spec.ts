import { test, expect } from '@playwright/test';
import {
  enableDashboardBypass,
  setupDashboardShellMocks,
  setupAllDashboardMocks,
  setupAIInsightsMocks,
  setupMarketDataMocks,
} from './dashboard-test-helpers';

const DASHBOARD_URL = '/members?e2eBypassAuth=1';

test.describe.configure({ mode: 'serial' });

test.describe('Dashboard Market Intelligence Component', () => {
  test.beforeEach(async ({ page }) => {
    await enableDashboardBypass(page);
    await setupDashboardShellMocks(page);
  });

  test.setTimeout(60_000);

  test('renders market intelligence section', async ({ page }) => {
    await setupAllDashboardMocks(page);
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    const marketIntelRegion = page.locator('region[aria-label="Market intelligence"]');
    await expect(marketIntelRegion).toBeVisible();
  });

  test('shows market movers with gainers', async ({ page }) => {
    await setupAllDashboardMocks(page);
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    const marketIntelRegion = page.locator('region[aria-label="Market intelligence"]');
    await expect(marketIntelRegion).toBeVisible();

    const nvdaSymbol = marketIntelRegion.locator('text=NVDA');
    await expect(nvdaSymbol).toBeVisible();
  });

  test('shows market movers gainers and losers tabs', async ({ page }) => {
    await setupAllDashboardMocks(page);
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    const marketIntelRegion = page.locator('region[aria-label="Market intelligence"]');
    await expect(marketIntelRegion).toBeVisible();

    const gainersTab = marketIntelRegion.locator('text=/Gainers|Movers/'i);
    const losersTab = marketIntelRegion.locator('text=/Losers/i');

    await expect(gainersTab).toBeVisible();
    await expect(losersTab).toBeVisible();
  });

  test('shows market analytics card', async ({ page }) => {
    await setupAllDashboardMocks(page);
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    const marketIntelRegion = page.locator('region[aria-label="Market intelligence"]');
    await expect(marketIntelRegion).toBeVisible();

    const analyticsContent = marketIntelRegion.locator('text=/Risk-On|Risk-Off|Analytics/i');
    await expect(analyticsContent).toBeVisible();
  });

  test('shows earnings radar', async ({ page }) => {
    await setupAllDashboardMocks(page);
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    const marketIntelRegion = page.locator('region[aria-label="Market intelligence"]');
    await expect(marketIntelRegion).toBeVisible();

    const earningsRadar = marketIntelRegion.locator('text=/Earnings|AAPL/i');
    await expect(earningsRadar).toBeVisible();
  });

  test('displays all market intelligence cards', async ({ page }) => {
    await setupAllDashboardMocks(page);
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    const marketIntelRegion = page.locator('region[aria-label="Market intelligence"]');
    await expect(marketIntelRegion).toBeVisible();

    const cardCount = await marketIntelRegion.locator('[role="article"], [role="region"]').count();
    expect(cardCount).toBeGreaterThanOrEqual(3);
  });

  test('market intelligence loads without errors', async ({ page }) => {
    let hasConsoleErrors = false;

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        hasConsoleErrors = true;
      }
    });

    await setupAllDashboardMocks(page);
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    const marketIntelRegion = page.locator('region[aria-label="Market intelligence"]');
    await expect(marketIntelRegion).toBeVisible();

    expect(hasConsoleErrors).toBe(false);
  });

  test('shows stock splits calendar', async ({ page }) => {
    await setupAllDashboardMocks(page);
    await page.goto(DASHBOARD_URL);
    await page.waitForLoadState('networkidle');

    const marketIntelRegion = page.locator('region[aria-label="Market intelligence"]');
    await expect(marketIntelRegion).toBeVisible();

    const splitsCalendar = marketIntelRegion.locator('text=/Splits|Calendar/i');
    await expect(splitsCalendar).toBeVisible();
  });
});
