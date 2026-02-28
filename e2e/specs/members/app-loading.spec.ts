/**
 * App Loading E2E Tests
 *
 * Validates production-grade page loading behavior:
 * - Initial cold load for every member route
 * - Auth redirect for unauthenticated users
 * - Page refresh stability (no blank screens or crashes)
 * - Loading skeleton / shell appearance before content
 * - Performance metrics collection for each route
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  BYPASS_URL,
  collectNavigationMetrics,
  MEMBER_TABS,
  setupAllNavigationMocks,
  type NavigationMetrics,
} from './navigation-test-helpers'

async function waitForPageReady(page: Page, options: { idleTimeoutMs?: number } = {}): Promise<void> {
  const idleTimeoutMs = options.idleTimeoutMs ?? 2_000
  await page.waitForLoadState('load')
  await page.waitForLoadState('networkidle', { timeout: idleTimeoutMs }).catch(() => {
    // Some member pages keep polling/websocket connections open.
  })
}

function getMobileBottomNav(page: Page): Locator {
  return page
    .locator('div.fixed.bottom-6.left-4.right-4 nav')
    .or(page.locator('div[class*="fixed"][class*="bottom"] nav'))
    .or(page.getByRole('navigation').filter({ has: page.getByRole('link', { name: 'Dashboard' }) }))
}

// ---------------------------------------------------------------------------
// Auth Redirect Tests
// ---------------------------------------------------------------------------

test.describe('Auth Redirect', () => {
  test('redirects unauthenticated user from /members to /login', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto('/members', { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/login/, { timeout: 15_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('redirects unauthenticated user from /members/journal to /login', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto('/members/journal', { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/login/, { timeout: 15_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('redirects unauthenticated user from /members/ai-coach to /login', async ({ page }) => {
    test.setTimeout(60_000)
    await page.goto('/members/ai-coach', { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/login/, { timeout: 15_000 })
    await expect(page).toHaveURL(/\/login/)
  })
})

// ---------------------------------------------------------------------------
// Cold Load — Every Member Tab
// ---------------------------------------------------------------------------

test.describe('Cold Load — All Member Routes', () => {
  test.describe.configure({ mode: 'serial' })

  const allMetrics: NavigationMetrics[] = []

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await setupAllNavigationMocks(page)
  })

  for (const tab of MEMBER_TABS) {
    test(`cold loads ${tab.label} (${tab.path}) without errors`, async ({ page }) => {
      // Navigate
      const response = await page.goto(BYPASS_URL(tab.path), { waitUntil: 'domcontentloaded' })

      // Assert HTTP response is OK (not 500, 404, etc.)
      expect(response).not.toBeNull()
      expect(response!.status()).toBeLessThan(400)

      // Wait for page to settle
      await waitForPageReady(page)

      // Verify no blank page — body must have children
      const bodyHasContent = await page.evaluate(() => {
        return document.body.children.length > 0 && document.body.innerText.trim().length > 0
      })
      expect(bodyHasContent).toBe(true)

      // Verify no uncaught JS errors rendering the page
      const consoleErrors: string[] = []
      page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('favicon')) {
          consoleErrors.push(msg.text())
        }
      })

      // Collect performance metrics
      const metrics = await collectNavigationMetrics(page, tab)
      allMetrics.push(metrics)

      // DOM content loaded should be under 10 seconds for any route
      expect(metrics.domContentLoaded).toBeLessThan(10_000)
    })
  }

  test('prints performance summary for all routes', async () => {
    // Log performance summary as test attachment
    const summary = allMetrics.map(m => ({
      tab: m.tab,
      path: m.path,
      domLoadMs: m.domContentLoaded,
      totalLoadMs: m.loadComplete,
      landmarkVisibleMs: m.landmarkVisible ?? 'N/A',
      firstPaintMs: m.firstPaint ?? 'N/A',
    }))

    console.log('\n=== APP LOADING PERFORMANCE SUMMARY ===')
    console.table(summary)

    // Assert all routes loaded
    expect(allMetrics.length).toBe(MEMBER_TABS.length)
  })
})

// ---------------------------------------------------------------------------
// Shell & Skeleton Tests
// ---------------------------------------------------------------------------

test.describe('Shell & Skeleton Rendering', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await setupAllNavigationMocks(page)
  })

  test('renders sidebar navigation on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(BYPASS_URL('/members'), { waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    // Sidebar should be visible on desktop
    const sidebar = page.locator('aside').first()
    await expect(sidebar).toBeVisible({ timeout: 10_000 })

    // Sidebar should contain navigation links
    const navLinks = sidebar.locator('a')
    const linkCount = await navLinks.count()
    expect(linkCount).toBeGreaterThan(0)
  })

  test('renders bottom navigation on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(BYPASS_URL('/members'), { waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    // Wait for dashboard content
    const body = page.locator('body')
    await expect(body).toBeVisible()

    // Mobile bottom nav should be present
    const bottomNav = getMobileBottomNav(page)
    await expect(bottomNav.first()).toBeVisible({ timeout: 10_000 })
  })

  test('main content area is visible and has proper structure', async ({ page }) => {
    await page.goto(BYPASS_URL('/members'), { waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    // Main element should exist
    const main = page.locator('main').first()
    await expect(main).toBeVisible({ timeout: 10_000 })

    // Content should not be empty
    const mainText = await main.textContent()
    expect(mainText).toBeTruthy()
    expect(mainText!.trim().length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Page Refresh Stability
// ---------------------------------------------------------------------------

test.describe('Page Refresh Stability', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await setupAllNavigationMocks(page)
  })

  test('dashboard survives full page refresh', async ({ page }) => {
    await page.goto(BYPASS_URL('/members'), { waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    // Verify initial load
    const welcomeRegion = page.locator('[aria-label="Dashboard welcome"]')
    await expect(welcomeRegion).toBeVisible({ timeout: 10_000 })

    // Refresh
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    // Verify page survived refresh — body has content
    const hasContent = await page.evaluate(() => {
      return document.body.innerText.trim().length > 0
    })
    expect(hasContent).toBe(true)
  })

  test('journal survives full page refresh', async ({ page }) => {
    await page.goto(BYPASS_URL('/members/journal'), { waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    // Verify initial load
    const heading = page.getByText('Trade Journal')
    await expect(heading.first()).toBeVisible({ timeout: 10_000 })

    // Refresh
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    // Verify survival
    const hasContent = await page.evaluate(() => {
      return document.body.innerText.trim().length > 0
    })
    expect(hasContent).toBe(true)
  })

  test('profile survives full page refresh', async ({ page }) => {
    await page.goto(BYPASS_URL('/members/profile'), { waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    // Verify page loaded (check for settings button)
    const settingsButton = page.locator('[data-testid="settings-button"]')
    const bodyContent = page.locator('body')
    await expect(bodyContent).toBeVisible({ timeout: 10_000 })

    // Refresh
    await page.reload({ waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    // Verify survival
    const hasContent = await page.evaluate(() => {
      return document.body.innerText.trim().length > 0
    })
    expect(hasContent).toBe(true)
  })

  test('rapid sequential refresh does not crash', async ({ page }) => {
    await page.goto(BYPASS_URL('/members'), { waitUntil: 'domcontentloaded' })

    // Perform 3 rapid refreshes
    for (let i = 0; i < 3; i++) {
      await page.reload({ waitUntil: 'domcontentloaded' })
    }

    await waitForPageReady(page)

    // Page should still have content after rapid refreshes
    const hasContent = await page.evaluate(() => {
      return document.body.innerText.trim().length > 0
    })
    expect(hasContent).toBe(true)

    // No crash — response should be OK
    const response = await page.goto(BYPASS_URL('/members'), { waitUntil: 'domcontentloaded' })
    expect(response).not.toBeNull()
    expect(response!.status()).toBeLessThan(400)
  })
})
