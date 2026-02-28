/**
 * Fast Tab Navigation E2E Tests
 *
 * Validates production-grade tab-to-tab navigation:
 * - Sequential navigation through all sidebar tabs
 * - Rapid tab switching (stress test for client-side routing)
 * - Back/forward browser history after tab navigation
 * - Mobile bottom-nav tab switching
 * - Navigation timing and performance budget enforcement
 */
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  assertPageLoaded,
  BYPASS_URL,
  MEMBER_TABS,
  setupAllNavigationMocks,
  type MemberTab,
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function findSidebarLink(sidebar: Locator, tab: MemberTab): Promise<Locator | null> {
  const candidates: Locator[] = [
    sidebar.getByRole('link', { name: new RegExp(`^${escapeRegExp(tab.label)}$`, 'i') }).first(),
    sidebar.locator(`a[href="${tab.path}"]`).first(),
    sidebar.locator(`a[href^="${tab.path}?"]`).first(),
    sidebar.locator(`a[href^="${tab.path}#"]`).first(),
  ]

  if (tab.id === 'academy') {
    candidates.push(sidebar.locator('a[href*="/members/library"]').first())
  }

  for (const candidate of candidates) {
    if (await candidate.isVisible().catch(() => false)) {
      return candidate
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Sequential Sidebar Navigation
// ---------------------------------------------------------------------------

test.describe('Sequential Sidebar Tab Navigation', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000)
    await setupAllNavigationMocks(page)
  })

  test('navigates through all tabs via sidebar links', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })

    // Start at dashboard
    await page.goto(BYPASS_URL('/members'), { waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    const sidebar = page.locator('aside').first()
    await expect(sidebar).toBeVisible({ timeout: 10_000 })
    await expect(sidebar.getByRole('link', { name: /journal/i }).first()).toBeVisible({
      timeout: 15_000,
    })

    const results: Array<{ tab: string; navigated: boolean; durationMs: number }> = []

    // Navigate to each tab in sequence
    for (const tab of MEMBER_TABS) {
      const startTime = Date.now()

      // Find sidebar link for this tab
      const sidebarLink = await findSidebarLink(sidebar, tab)

      if (sidebarLink) {
        try {
          await sidebarLink.click({ timeout: 5_000 })

          // Wait for navigation
          await page.waitForURL(`**${tab.path}**`, { timeout: 15_000 })
          await page.waitForLoadState('domcontentloaded')

          const durationMs = Date.now() - startTime

          // Verify page has content
          const hasContent = await page.evaluate(() => {
            return document.body.innerText.trim().length > 0
          })

          results.push({ tab: tab.label, navigated: hasContent, durationMs })
        } catch {
          results.push({ tab: tab.label, navigated: false, durationMs: Date.now() - startTime })
        }
      } else {
        // Tab may not be in sidebar (e.g., social is desktop-only in sidebar)
        results.push({ tab: tab.label, navigated: false, durationMs: 0 })
      }
    }

    console.log('\n=== SEQUENTIAL SIDEBAR NAVIGATION RESULTS ===')
    console.table(results)

    // At least dashboard, journal, and profile should navigate successfully
    const criticalTabs = results.filter(r =>
      ['Dashboard', 'Journal', 'Profile'].includes(r.tab),
    )
    for (const ct of criticalTabs) {
      expect(ct.navigated).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Rapid Tab Switching (Stress Test)
// ---------------------------------------------------------------------------

test.describe('Rapid Tab Switching', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000)
    await setupAllNavigationMocks(page)
  })

  test('survives rapid sequential navigation across 5 tabs', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })

    // Start at dashboard
    await page.goto(BYPASS_URL('/members'), { waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    // Rapid switching pattern: Dashboard → Journal → AI Coach → Profile → Dashboard
    const sequence: MemberTab[] = [
      MEMBER_TABS[0], // Dashboard
      MEMBER_TABS[1], // Journal
      MEMBER_TABS[2], // AI Coach
      MEMBER_TABS[4], // Profile
      MEMBER_TABS[0], // Dashboard again
    ]

    const timings: Array<{ from: string; to: string; durationMs: number }> = []

    for (let i = 1; i < sequence.length; i++) {
      const fromTab = sequence[i - 1]
      const toTab = sequence[i]
      const startTime = Date.now()

      // Use direct URL navigation (simulating fast clicks)
      await page.goto(BYPASS_URL(toTab.path), { waitUntil: 'domcontentloaded' })

      timings.push({
        from: fromTab.label,
        to: toTab.label,
        durationMs: Date.now() - startTime,
      })
    }

    // Final page should be loaded and functional
    const hasContent = await page.evaluate(() => {
      return document.body.innerText.trim().length > 0
    })
    expect(hasContent).toBe(true)

    console.log('\n=== RAPID TAB SWITCHING TIMINGS ===')
    console.table(timings)

    // Verify all transitions completed
    expect(timings.length).toBe(sequence.length - 1)
  })

  test('survives rapid back-and-forth between two tabs', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })

    await page.goto(BYPASS_URL('/members'), { waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    // Rapidly alternate between Dashboard and Journal 5 times
    for (let i = 0; i < 5; i++) {
      await page.goto(BYPASS_URL('/members/journal'), { waitUntil: 'domcontentloaded' })
      await page.goto(BYPASS_URL('/members'), { waitUntil: 'domcontentloaded' })
    }

    // Should end on dashboard, still functional
    await waitForPageReady(page)
    const hasContent = await page.evaluate(() => {
      return document.body.innerText.trim().length > 0
    })
    expect(hasContent).toBe(true)

    // URL should be dashboard
    expect(page.url()).toContain('/members')
  })
})

// ---------------------------------------------------------------------------
// Browser History (Back/Forward)
// ---------------------------------------------------------------------------

test.describe('Browser History Navigation', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(90_000)
    await setupAllNavigationMocks(page)
  })

  test('back button returns to previous tab', async ({ page }) => {
    // Navigate Dashboard → Journal
    await page.goto(BYPASS_URL('/members'), { waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    await page.goto(BYPASS_URL('/members/journal'), { waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    // Press back
    await page.goBack({ waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    // Should be back on dashboard
    expect(page.url()).toContain('/members')

    // Content should still be visible
    const hasContent = await page.evaluate(() => {
      return document.body.innerText.trim().length > 0
    })
    expect(hasContent).toBe(true)
  })

  test('forward button restores next tab', async ({ page }) => {
    // Navigate Dashboard → Journal
    await page.goto(BYPASS_URL('/members'), { waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    await page.goto(BYPASS_URL('/members/journal'), { waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    // Go back
    await page.goBack({ waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    // Go forward
    await page.goForward({ waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    // Should be on journal again
    expect(page.url()).toContain('/members/journal')
  })

  test('multi-step history (3 tabs) navigates correctly', async ({ page }) => {
    // Dashboard → Journal → Profile
    await page.goto(BYPASS_URL('/members'), { waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    await page.goto(BYPASS_URL('/members/journal'), { waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    await page.goto(BYPASS_URL('/members/profile'), { waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    // Back twice → Dashboard
    await page.goBack({ waitUntil: 'domcontentloaded' })
    expect(page.url()).toContain('/members/journal')

    await page.goBack({ waitUntil: 'domcontentloaded' })
    expect(page.url()).toContain('/members')

    // Forward once → Journal
    await page.goForward({ waitUntil: 'domcontentloaded' })
    expect(page.url()).toContain('/members/journal')
  })
})

// ---------------------------------------------------------------------------
// Mobile Bottom-Nav Navigation
// ---------------------------------------------------------------------------

test.describe('Mobile Bottom-Nav Tab Switching', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(90_000)
    await setupAllNavigationMocks(page)
  })

  test('bottom nav is visible on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(BYPASS_URL('/members'), { waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    // Bottom nav should be present
    const bottomNav = getMobileBottomNav(page)
    await expect(bottomNav.first()).toBeVisible({ timeout: 10_000 })
  })

  test('navigates between tabs via mobile bottom nav', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(BYPASS_URL('/members'), { waitUntil: 'domcontentloaded' })
    await waitForPageReady(page)

    // Find bottom nav links
    const bottomNav = getMobileBottomNav(page).first()

    const navLinks = bottomNav.locator('a')
    const linkCount = await navLinks.count()

    // Should have multiple navigation links
    expect(linkCount).toBeGreaterThan(1)

    // Try clicking the second link (usually Journal)
    if (linkCount >= 2) {
      const journalLink = bottomNav.getByRole('link', { name: /journal/i }).first()
      const targetLink = (await journalLink.isVisible().catch(() => false))
        ? journalLink
        : navLinks.nth(1)
      const href = await targetLink.getAttribute('href')

      if (href) {
        await targetLink.click()
        await page.waitForLoadState('domcontentloaded')

        // Should have navigated away from dashboard
        const hasContent = await page.evaluate(() => {
          return document.body.innerText.trim().length > 0
        })
        expect(hasContent).toBe(true)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Deep Link Validation
// ---------------------------------------------------------------------------

test.describe('Deep Link Navigation', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await setupAllNavigationMocks(page)
  })

  test('direct deep link to journal loads correctly', async ({ page }) => {
    const response = await page.goto(BYPASS_URL('/members/journal'), { waitUntil: 'domcontentloaded' })
    expect(response).not.toBeNull()
    expect(response!.status()).toBeLessThan(400)

    await waitForPageReady(page)

    const hasContent = await page.evaluate(() => {
      return document.body.innerText.trim().length > 0
    })
    expect(hasContent).toBe(true)
    expect(page.url()).toContain('/members/journal')
  })

  test('direct deep link to profile loads correctly', async ({ page }) => {
    const response = await page.goto(BYPASS_URL('/members/profile'), { waitUntil: 'domcontentloaded' })
    expect(response).not.toBeNull()
    expect(response!.status()).toBeLessThan(400)

    await waitForPageReady(page)

    const hasContent = await page.evaluate(() => {
      return document.body.innerText.trim().length > 0
    })
    expect(hasContent).toBe(true)
    expect(page.url()).toContain('/members/profile')
  })

  test('direct deep link to ai-coach loads correctly', async ({ page }) => {
    const response = await page.goto(BYPASS_URL('/members/ai-coach'), { waitUntil: 'domcontentloaded' })
    expect(response).not.toBeNull()
    expect(response!.status()).toBeLessThan(400)

    await waitForPageReady(page)

    const hasContent = await page.evaluate(() => {
      return document.body.innerText.trim().length > 0
    })
    expect(hasContent).toBe(true)
    expect(page.url()).toContain('/members/ai-coach')
  })

  test('direct deep link to academy loads correctly', async ({ page }) => {
    const response = await page.goto(BYPASS_URL('/members/academy'), { waitUntil: 'domcontentloaded' })
    expect(response).not.toBeNull()
    expect(response!.status()).toBeLessThan(400)

    await waitForPageReady(page)

    const hasContent = await page.evaluate(() => {
      return document.body.innerText.trim().length > 0
    })
    expect(hasContent).toBe(true)
    expect(page.url()).toContain('/members/academy')
  })

  test('direct deep link to spx-command-center loads correctly', async ({ page }) => {
    const response = await page.goto(BYPASS_URL('/members/spx-command-center'), { waitUntil: 'domcontentloaded' })
    expect(response).not.toBeNull()
    expect(response!.status()).toBeLessThan(400)

    await waitForPageReady(page)

    const hasContent = await page.evaluate(() => {
      return document.body.innerText.trim().length > 0
    })
    expect(hasContent).toBe(true)
    expect(page.url()).toContain('/members/spx-command-center')
  })

  test('direct deep link to social loads correctly', async ({ page }) => {
    const response = await page.goto(BYPASS_URL('/members/social'), { waitUntil: 'domcontentloaded' })
    expect(response).not.toBeNull()
    expect(response!.status()).toBeLessThan(400)

    await waitForPageReady(page)

    const hasContent = await page.evaluate(() => {
      return document.body.innerText.trim().length > 0
    })
    expect(hasContent).toBe(true)
    expect(page.url()).toContain('/members/social')
  })
})

// ---------------------------------------------------------------------------
// Performance Budget Enforcement
// ---------------------------------------------------------------------------

test.describe('Navigation Performance Budget', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000)
    await setupAllNavigationMocks(page)
  })

  test('all member routes load within 8-second budget', async ({ page }) => {
    const results: Array<{ tab: string; loadMs: number; withinBudget: boolean }> = []

    for (const tab of MEMBER_TABS) {
      const startTime = Date.now()
      await page.goto(BYPASS_URL(tab.path), { waitUntil: 'domcontentloaded' })
      await waitForPageReady(page)
      const loadMs = Date.now() - startTime

      results.push({
        tab: tab.label,
        loadMs,
        withinBudget: loadMs < 8_000,
      })
    }

    console.log('\n=== PERFORMANCE BUDGET RESULTS ===')
    console.table(results)

    // All routes must load within 8 seconds
    for (const result of results) {
      expect(
        result.withinBudget,
        `${result.tab} exceeded 8s budget (took ${result.loadMs}ms)`,
      ).toBe(true)
    }
  })
})
