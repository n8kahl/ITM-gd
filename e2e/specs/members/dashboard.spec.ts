import { test, expect } from '@playwright/test';
import {
  enableDashboardBypass,
  setupDashboardShellMocks,
  setupAllDashboardMocks,
} from './dashboard-test-helpers';

const DASHBOARD_URL = '/members?e2eBypassAuth=1';

test.describe.configure({ mode: 'serial' });

test.describe('Members Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await enableDashboardBypass(page);
    await setupDashboardShellMocks(page);
  });

  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/members');
    await page.waitForURL('**/login**');
    expect(page.url()).toContain('/login');
  });

  test('renders all dashboard sections with mock data', async ({ page }) => {
    await setupAllDashboardMocks(page);
    await page.goto(DASHBOARD_URL);

    // Verify all 7 region labels are visible
    await expect(page.getByRole('region', { name: 'Dashboard welcome' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Live market ticker' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Performance statistics' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Equity and quick actions' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Recent trades' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Market brief, AI insights and calendar' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Market intelligence' })).toBeVisible();
  });

  test('displays welcome greeting with username', async ({ page }) => {
    await setupAllDashboardMocks(page);
    await page.goto(DASHBOARD_URL);

    const welcomeRegion = page.getByRole('region', { name: 'Dashboard welcome' });
    await expect(welcomeRegion).toBeVisible();

    // Verify welcome text contains the mock username "E2ETrader"
    await expect(welcomeRegion).toContainText('E2ETrader');
  });

  test('shows market status indicator', async ({ page }) => {
    await setupAllDashboardMocks(page);
    await page.goto(DASHBOARD_URL);

    const welcomeRegion = page.getByRole('region', { name: 'Dashboard welcome' });
    await expect(welcomeRegion).toBeVisible();

    // Verify one of the market status indicators is visible
    const marketStatusOptions = ['Market Open', 'Pre-Market', 'After Hours', 'Market Closed'];
    let found = false;
    for (const status of marketStatusOptions) {
      if (await welcomeRegion.getByText(status).isVisible().catch(() => false)) {
        found = true;
        break;
      }
    }
    expect(found).toBeTruthy();
  });

  test('shows current date', async ({ page }) => {
    await setupAllDashboardMocks(page);
    await page.goto(DASHBOARD_URL);

    const welcomeRegion = page.getByRole('region', { name: 'Dashboard welcome' });
    await expect(welcomeRegion).toBeVisible();

    // Verify the year 2026 is visible
    await expect(welcomeRegion).toContainText('2026');
  });
});
