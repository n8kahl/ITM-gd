import { test, expect } from '@playwright/test';
import {
  enableDashboardBypass,
  setupDashboardShellMocks,
  setupAllDashboardMocks,
} from './dashboard-test-helpers';

const DASHBOARD_URL = '/members?e2eBypassAuth=1';

test.describe.configure({ mode: 'serial' });

test.describe('Dashboard Quick Actions', () => {
  test.beforeEach(async ({ page }) => {
    await enableDashboardBypass(page);
    await setupDashboardShellMocks(page);
  });

  test('renders all three quick action buttons', async ({ page }) => {
    test.setTimeout(60_000);
    await setupAllDashboardMocks(page);
    await page.goto(DASHBOARD_URL);

    const equityRegion = page.getByRole('region', { name: 'Equity and quick actions' });
    await expect(equityRegion).toBeVisible();

    // Verify all three quick action buttons are visible
    await expect(equityRegion.getByRole('link', { name: /Log Trade/i })).toBeVisible();
    await expect(equityRegion.getByRole('link', { name: /Ask AI Coach/i })).toBeVisible();
    await expect(equityRegion.getByRole('button', { name: /Share Last Win/i })).toBeVisible();
  });

  test('Log Trade links to journal with new entry param', async ({ page }) => {
    test.setTimeout(60_000);
    await setupAllDashboardMocks(page);
    await page.goto(DASHBOARD_URL);

    const equityRegion = page.getByRole('region', { name: 'Equity and quick actions' });
    const logTradeLink = equityRegion.getByRole('link', { name: /Log Trade/i });

    await expect(logTradeLink).toBeVisible();

    // Verify link href contains /members/journal
    const href = await logTradeLink.getAttribute('href');
    expect(href).toContain('/members/journal');
  });

  test('Ask AI Coach links to ai-coach page', async ({ page }) => {
    test.setTimeout(60_000);
    await setupAllDashboardMocks(page);
    await page.goto(DASHBOARD_URL);

    const equityRegion = page.getByRole('region', { name: 'Equity and quick actions' });
    const aiCoachLink = equityRegion.getByRole('link', { name: /Ask AI Coach/i });

    await expect(aiCoachLink).toBeVisible();

    // Verify link href contains /members/ai-coach
    const href = await aiCoachLink.getAttribute('href');
    expect(href).toContain('/members/ai-coach');
  });

  test('Quick Actions heading is visible', async ({ page }) => {
    test.setTimeout(60_000);
    await setupAllDashboardMocks(page);
    await page.goto(DASHBOARD_URL);

    const equityRegion = page.getByRole('region', { name: 'Equity and quick actions' });
    await expect(equityRegion).toBeVisible();

    // Verify "Quick Actions" heading text
    await expect(equityRegion.getByText(/Quick Actions/i)).toBeVisible();
  });
});
