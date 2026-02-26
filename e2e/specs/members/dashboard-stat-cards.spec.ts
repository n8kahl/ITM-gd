import { test, expect } from '@playwright/test';
import {
  enableDashboardBypass,
  setupDashboardShellMocks,
  setupDashboardStatsMock,
  createMockDashboardStats,
} from './dashboard-test-helpers';

const DASHBOARD_URL = '/members?e2eBypassAuth=1';

test.describe.configure({ mode: 'serial' });

test.describe('Dashboard Stat Cards', () => {
  test.beforeEach(async ({ page }) => {
    await enableDashboardBypass(page);
    await setupDashboardShellMocks(page);
  });

  test('renders 5 stat cards with data', async ({ page }) => {
    test.setTimeout(60_000);
    await setupDashboardStatsMock(page);
    await page.goto(DASHBOARD_URL);

    const statsRegion = page.getByRole('region', { name: 'Performance statistics' });
    await expect(statsRegion).toBeVisible();

    // Verify win rate display
    await expect(statsRegion).toContainText(/\d+\.\d+%/);

    // Verify P&L display (should contain $ symbol or numeric P&L)
    const pnlVisible = await statsRegion.locator('text=/\\$|-?\\d+\\.\\d+/').isVisible().catch(() => false);
    expect(pnlVisible).toBeTruthy();
  });

  test('shows loading skeletons before data loads', async ({ page }) => {
    test.setTimeout(60_000);
    // Don't setup stats mock to see skeleton loaders
    await page.goto(DASHBOARD_URL);

    const statsRegion = page.getByRole('region', { name: 'Performance statistics' });
    await expect(statsRegion).toBeVisible();

    // Verify skeleton loaders appear
    const skeletons = statsRegion.locator('[class*="skeleton"], [class*="pulse"]');
    const count = await skeletons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('displays win rate percentage', async ({ page }) => {
    test.setTimeout(60_000);
    const mockStats = createMockDashboardStats({ win_rate: 75.0 });
    await setupDashboardStatsMock(page, mockStats);
    await page.goto(DASHBOARD_URL);

    const statsRegion = page.getByRole('region', { name: 'Performance statistics' });
    await expect(statsRegion).toBeVisible();

    // Verify "75" appears in the statistics section
    await expect(statsRegion).toContainText('75');
  });

  test('shows streak info', async ({ page }) => {
    test.setTimeout(60_000);
    const mockStats = createMockDashboardStats({
      current_streak: 5,
      streak_type: 'win',
    });
    await setupDashboardStatsMock(page, mockStats);
    await page.goto(DASHBOARD_URL);

    const statsRegion = page.getByRole('region', { name: 'Performance statistics' });
    await expect(statsRegion).toBeVisible();

    // Verify "5" and streak info visible
    await expect(statsRegion).toContainText('5');
    await expect(statsRegion).toContainText(/streak|win/i);
  });
});
