import { test, expect, Page, Route } from '@playwright/test'
import { authenticateAsMember } from '../helpers/member-auth'
import { setupMemberApiMocks } from '../helpers/api-mocks'
import { setupSPXCommandCenterMocks } from '../helpers/spx-mocks'

/**
 * UX Stress Test Suite — Click Audit & Tab Switch Performance
 *
 * Validates that the app remains responsive under rapid user interaction:
 * - Fast tab/route switching across member sections
 * - Rapid SPX mobile panel tab cycling
 * - Journal view toggling under load
 * - Back/forward navigation spam
 * - Concurrent interactions during loading states
 *
 * Each test measures frame responsiveness and asserts the UI never locks up
 * (defined as: page remains interactive and key elements render within thresholds).
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Routes that every member section loads */
const MEMBER_ROUTES = [
  '/members/journal',
  '/members/ai-coach',
  '/members/spx-command-center',
  '/members/profile',
  '/members/social',
  '/members/academy',
] as const

/** SPX mobile panel tab IDs (data-testid pattern) */
const SPX_MOBILE_TABS = ['brief', 'chart', 'setups', 'coach', 'levels'] as const

/**
 * Mock all API routes to return fast, deterministic responses.
 * This isolates UX performance from network latency.
 */
async function setupAllApiMocks(page: Page): Promise<void> {
  await setupMemberApiMocks(page)

  // Mock profile endpoints
  await page.route('**/api/members/profile*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        profile: {
          id: 'test-user-id-12345',
          display_name: 'Test User',
          bio: 'E2E stress test user',
          trading_style: 'day_trader',
          experience_level: 'intermediate',
        },
      }),
    })
  })

  // Mock social endpoints
  await page.route('**/api/social/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], count: 0 }),
    })
  })

  // Mock academy endpoints
  await page.route('**/api/academy-v3/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], modules: [] }),
    })
  })

  // Mock journal analytics
  await page.route('**/api/members/journal/analytics*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        analytics: { totalTrades: 0, winRate: 0, avgPnl: 0, totalPnl: 0, rows: [] },
      }),
    })
  })

  // Mock AI coach sessions
  await page.route('**/api/chat/sessions*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sessions: [], count: 0 }),
    })
  })

  // Mock Supabase REST calls
  await page.route('**/rest/v1/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  // Mock affiliate
  await page.route('**/api/members/affiliate*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ affiliate: null }),
    })
  })

  // Mock transcript
  await page.route('**/api/members/profile/transcript*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ transcript: [] }),
    })
  })
}

/**
 * Check that the page is responsive by verifying we can evaluate JS
 * and the document is not frozen. Returns elapsed ms.
 */
async function assertPageResponsive(page: Page, label: string, maxMs = 3000): Promise<number> {
  const start = Date.now()
  const result = await Promise.race([
    page.evaluate(() => {
      // Force a layout read to detect main-thread lock
      document.body.getBoundingClientRect()
      return Date.now()
    }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), maxMs)),
  ])
  const elapsed = Date.now() - start

  expect(result, `Page unresponsive during "${label}" — JS evaluate timed out after ${maxMs}ms`).not.toBeNull()

  return elapsed
}

/**
 * Measure Long Animation Frames (LoAF) or fall back to frame timing.
 * Returns the longest frame duration observed during the action.
 */
async function measureFrameJank(page: Page, action: () => Promise<void>): Promise<number> {
  // Inject a performance observer before the action
  await page.evaluate(() => {
    (window as any).__stressTestMaxFrameTime = 0;
    (window as any).__stressTestFrameTimestamps = [] as number[]

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const duration = entry.duration
        if (duration > (window as any).__stressTestMaxFrameTime) {
          (window as any).__stressTestMaxFrameTime = duration
        }
      }
    })

    // Try LoAF (Chrome 123+), fall back to longtask
    try {
      observer.observe({ type: 'long-animation-frame', buffered: false })
    } catch {
      try {
        observer.observe({ type: 'longtask', buffered: false })
      } catch {
        // Neither available — we'll use rAF timing below
      }
    }
    ;(window as any).__stressTestObserver = observer

    // rAF-based fallback: measure inter-frame gaps
    let lastFrame = performance.now()
    function tick() {
      const now = performance.now()
      const delta = now - lastFrame
      if (delta > (window as any).__stressTestMaxFrameTime) {
        (window as any).__stressTestMaxFrameTime = delta
      }
      lastFrame = now
      if ((window as any).__stressTestRunning) {
        requestAnimationFrame(tick)
      }
    }
    ;(window as any).__stressTestRunning = true
    requestAnimationFrame(tick)
  })

  await action()

  // Small settling period for any trailing re-renders
  await page.waitForTimeout(300)

  const maxFrameTime = await page.evaluate(() => {
    (window as any).__stressTestRunning = false
    const observer = (window as any).__stressTestObserver
    if (observer) observer.disconnect()
    return (window as any).__stressTestMaxFrameTime as number
  })

  return maxFrameTime
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('UX Stress Test — Click Audit', () => {
  test.beforeEach(async ({ page }) => {
    await setupAllApiMocks(page)
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
  })

  // =========================================================================
  // SECTION 1: Rapid Route Navigation
  // =========================================================================

  test.describe('Rapid Route Navigation', () => {
    test('STRESS-001: cycle through all member routes 3x without freeze', async ({ page }) => {
      await page.goto('/members/journal')
      await page.waitForLoadState('domcontentloaded')

      for (let cycle = 0; cycle < 3; cycle++) {
        for (const route of MEMBER_ROUTES) {
          await page.goto(route)
          // Don't wait for full load — stress test rapid switching
          await page.waitForLoadState('domcontentloaded')
        }
      }

      // After 18 navigations the page must still be responsive
      const elapsed = await assertPageResponsive(page, 'post-rapid-nav-cycle')
      expect(elapsed).toBeLessThan(2000)
    })

    test('STRESS-002: interrupt navigation mid-load by switching routes', async ({ page }) => {
      await page.goto('/members/journal')
      await page.waitForLoadState('domcontentloaded')

      // Fire navigations without awaiting completion — simulates frantic clicking
      const routes = [...MEMBER_ROUTES, ...MEMBER_ROUTES]
      for (const route of routes) {
        // Don't await — fire and immediately switch
        page.goto(route).catch(() => {
          /* navigation aborted — expected */
        })
        await page.waitForTimeout(150) // ~human click speed
      }

      // Wait for the last navigation to settle
      await page.waitForLoadState('domcontentloaded')
      const elapsed = await assertPageResponsive(page, 'post-interrupted-nav')
      expect(elapsed).toBeLessThan(2000)
    })

    test('STRESS-003: back/forward history spam (10 rapid clicks)', async ({ page }) => {
      // Build up history
      for (const route of MEMBER_ROUTES.slice(0, 4)) {
        await page.goto(route)
        await page.waitForLoadState('domcontentloaded')
      }

      // Spam back button
      for (let i = 0; i < 5; i++) {
        page.goBack().catch(() => {})
        await page.waitForTimeout(100)
      }

      // Spam forward button
      for (let i = 0; i < 5; i++) {
        page.goForward().catch(() => {})
        await page.waitForTimeout(100)
      }

      await page.waitForLoadState('domcontentloaded')
      const elapsed = await assertPageResponsive(page, 'post-history-spam')
      expect(elapsed).toBeLessThan(2000)
    })
  })

  // =========================================================================
  // SECTION 2: SPX Command Center Tab Stress
  // =========================================================================

  test.describe('SPX Command Center Tabs', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/members/spx-command-center')
      await page.waitForLoadState('domcontentloaded')
      // Wait for initial skeleton to clear
      await page.waitForTimeout(1500)
    })

    test('STRESS-010: rapid mobile tab cycling (5 full rotations)', async ({ page }) => {
      // Force mobile viewport for tab panel
      await page.setViewportSize({ width: 390, height: 844 })
      await page.waitForTimeout(500)

      const maxFrame = await measureFrameJank(page, async () => {
        for (let rotation = 0; rotation < 5; rotation++) {
          for (const tabId of SPX_MOBILE_TABS) {
            // Click mobile tab by text or test-id
            const tabButton = page.locator(`[data-tab="${tabId}"], button:has-text("${tabId}")`).first()
            if (await tabButton.isVisible({ timeout: 1000 }).catch(() => false)) {
              await tabButton.click()
              await page.waitForTimeout(80) // Rapid but not instant
            }
          }
        }
      })

      // Max frame should be under 500ms for acceptable UX (no freeze)
      console.log(`STRESS-010: max frame time = ${Math.round(maxFrame)}ms`)
      expect(maxFrame, 'Frame exceeded 500ms — likely freeze during SPX tab switch').toBeLessThan(500)

      const elapsed = await assertPageResponsive(page, 'post-spx-tab-cycling')
      expect(elapsed).toBeLessThan(2000)
    })

    test('STRESS-011: toggle between chart and coach tabs 20 times', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.waitForTimeout(500)

      const chartTab = page.locator('[data-tab="chart"], button:has-text("chart")').first()
      const coachTab = page.locator('[data-tab="coach"], button:has-text("coach")').first()

      const maxFrame = await measureFrameJank(page, async () => {
        for (let i = 0; i < 20; i++) {
          const tab = i % 2 === 0 ? coachTab : chartTab
          if (await tab.isVisible({ timeout: 1000 }).catch(() => false)) {
            await tab.click()
            await page.waitForTimeout(50)
          }
        }
      })

      console.log(`STRESS-011: max frame time (chart↔coach) = ${Math.round(maxFrame)}ms`)
      expect(maxFrame, 'Chart ↔ Coach toggle freeze detected').toBeLessThan(500)
    })

    test('STRESS-012: desktop layout — rapid view mode toggles', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.waitForTimeout(500)

      // Look for view mode toggle (spatial, standard, etc.)
      const viewToggles = page.locator('[data-testid*="view-mode"], [data-testid*="layout-toggle"], button[aria-label*="view"]')
      const toggleCount = await viewToggles.count()

      if (toggleCount >= 2) {
        const maxFrame = await measureFrameJank(page, async () => {
          for (let i = 0; i < 10; i++) {
            const idx = i % toggleCount
            await viewToggles.nth(idx).click()
            await page.waitForTimeout(100)
          }
        })

        console.log(`STRESS-012: max frame time (view toggle) = ${Math.round(maxFrame)}ms`)
        expect(maxFrame).toBeLessThan(500)
      }

      await assertPageResponsive(page, 'post-view-toggle')
    })
  })

  // =========================================================================
  // SECTION 3: Journal View Switching
  // =========================================================================

  test.describe('Journal Stress', () => {
    test.beforeEach(async ({ page }) => {
      // Mock journal with a larger dataset
      await page.route('**/api/members/journal', async (route: Route) => {
        if (route.request().method() === 'GET') {
          const entries = Array.from({ length: 100 }, (_, i) => ({
            id: `entry-${i}`,
            symbol: ['SPX', 'AAPL', 'TSLA', 'NVDA', 'QQQ'][i % 5],
            direction: i % 2 === 0 ? 'long' : 'short',
            pnl: Math.round((Math.random() - 0.3) * 500),
            trade_date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
            entry_price: 100 + Math.random() * 50,
            exit_price: 100 + Math.random() * 50,
            notes: `Trade note ${i}`,
            tags: ['scalp', 'swing'][i % 2],
            created_at: new Date().toISOString(),
          }))

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: entries,
              streaks: { current_streak: 5, longest_streak: 10, total_entries: 100, total_winners: 65, total_losers: 35 },
            }),
          })
        } else {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
        }
      })

      await page.goto('/members/journal')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)
    })

    test('STRESS-020: toggle cards ↔ table view 20 times with 100 entries', async ({ page }) => {
      // Find view toggle (select or buttons)
      const viewSelect = page.getByLabel('View').or(page.locator('select').first())

      if (await viewSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        const maxFrame = await measureFrameJank(page, async () => {
          for (let i = 0; i < 20; i++) {
            const value = i % 2 === 0 ? 'table' : 'cards'
            await viewSelect.selectOption(value).catch(() => {})
            await page.waitForTimeout(80)
          }
        })

        console.log(`STRESS-020: max frame time (journal view toggle) = ${Math.round(maxFrame)}ms`)
        expect(maxFrame, 'Journal view toggle freeze detected').toBeLessThan(500)
      }

      await assertPageResponsive(page, 'post-journal-view-toggle')
    })

    test('STRESS-021: rapid filter changes on journal', async ({ page }) => {
      const symbolFilters = ['SPX', 'AAPL', 'TSLA', 'NVDA', 'QQQ', '']
      const symbolInput = page.locator('input[placeholder*="symbol" i], input[placeholder*="filter" i], input[placeholder*="search" i]').first()

      if (await symbolInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        const maxFrame = await measureFrameJank(page, async () => {
          for (const sym of [...symbolFilters, ...symbolFilters]) {
            await symbolInput.fill(sym)
            await page.waitForTimeout(50)
          }
        })

        console.log(`STRESS-021: max frame time (filter changes) = ${Math.round(maxFrame)}ms`)
        expect(maxFrame).toBeLessThan(500)
      }

      await assertPageResponsive(page, 'post-journal-filter-spam')
    })
  })

  // =========================================================================
  // SECTION 4: AI Coach Interaction Stress
  // =========================================================================

  test.describe('AI Coach Stress', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/members/ai-coach')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)
    })

    test('STRESS-030: rapid session switching (create + switch back)', async ({ page }) => {
      // Mock stream endpoint to return immediately
      await page.route('**/api/chat/stream', async (route: Route) => {
        const body = 'event: session\ndata: {"sessionId":"sess-1"}\n\nevent: token\ndata: {"content":"Test response"}\n\nevent: done\ndata: {"messageId":"msg-1","tokensUsed":10}\n\n'
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body,
        })
      })

      // Look for new session button
      const newSessionBtn = page.locator('button:has-text("New"), button[aria-label*="new session" i], button[aria-label*="new chat" i]').first()

      if (await newSessionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        const maxFrame = await measureFrameJank(page, async () => {
          for (let i = 0; i < 10; i++) {
            await newSessionBtn.click()
            await page.waitForTimeout(150)
          }
        })

        console.log(`STRESS-030: max frame time (session switching) = ${Math.round(maxFrame)}ms`)
        expect(maxFrame).toBeLessThan(500)
      }

      await assertPageResponsive(page, 'post-session-switch-spam')
    })

    test('STRESS-031: navigate away from AI Coach mid-stream and back', async ({ page }) => {
      // Mock slow stream
      await page.route('**/api/chat/stream', async (route: Route) => {
        // Deliberately slow — send tokens with delay
        const chunks = [
          'event: session\ndata: {"sessionId":"sess-1"}\n\n',
          'event: status\ndata: {"phase":"thinking"}\n\n',
          'event: token\ndata: {"content":"Analyzing"}\n\n',
          'event: token\ndata: {"content":" your"}\n\n',
          'event: token\ndata: {"content":" chart..."}\n\n',
          'event: done\ndata: {"messageId":"msg-1","tokensUsed":10}\n\n',
        ]

        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: chunks.join(''),
        })
      })

      // Try to trigger a send
      const input = page.locator('textarea, input[type="text"]').first()
      if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
        await input.fill('analyze this')
        await input.press('Enter')
        await page.waitForTimeout(200)
      }

      // Navigate away mid-stream
      for (let i = 0; i < 3; i++) {
        await page.goto('/members/journal')
        await page.waitForTimeout(200)
        await page.goto('/members/ai-coach')
        await page.waitForTimeout(200)
      }

      const elapsed = await assertPageResponsive(page, 'post-ai-coach-mid-stream-nav')
      expect(elapsed).toBeLessThan(2000)
    })
  })

  // =========================================================================
  // SECTION 5: Sidebar Navigation Slam
  // =========================================================================

  test.describe('Sidebar Navigation Slam', () => {
    test('STRESS-040: click every sidebar link in rapid succession', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto('/members/journal')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      // Find sidebar nav links
      const sidebarLinks = page.locator('nav a[href^="/members/"], aside a[href^="/members/"]')
      const linkCount = await sidebarLinks.count()

      if (linkCount > 0) {
        const maxFrame = await measureFrameJank(page, async () => {
          // Click each link 3 times through
          for (let cycle = 0; cycle < 3; cycle++) {
            for (let i = 0; i < linkCount; i++) {
              const link = sidebarLinks.nth(i)
              if (await link.isVisible({ timeout: 500 }).catch(() => false)) {
                await link.click()
                await page.waitForTimeout(100)
              }
            }
          }
        })

        console.log(`STRESS-040: max frame time (sidebar slam, ${linkCount} links x3) = ${Math.round(maxFrame)}ms`)
        expect(maxFrame, 'Sidebar navigation slam caused a freeze').toBeLessThan(500)
      }

      await assertPageResponsive(page, 'post-sidebar-slam')
    })

    test('STRESS-041: mobile bottom nav rapid tapping', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto('/members/journal')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      // Find mobile bottom nav links
      const bottomNavLinks = page.locator('nav[class*="bottom"] a, nav[class*="fixed"] a[href^="/members/"]')
      const linkCount = await bottomNavLinks.count()

      if (linkCount > 0) {
        const maxFrame = await measureFrameJank(page, async () => {
          for (let cycle = 0; cycle < 5; cycle++) {
            for (let i = 0; i < linkCount; i++) {
              const link = bottomNavLinks.nth(i)
              if (await link.isVisible({ timeout: 500 }).catch(() => false)) {
                await link.click()
                await page.waitForTimeout(80)
              }
            }
          }
        })

        console.log(`STRESS-041: max frame time (mobile bottom nav) = ${Math.round(maxFrame)}ms`)
        expect(maxFrame).toBeLessThan(500)
      }

      await assertPageResponsive(page, 'post-mobile-nav-spam')
    })
  })

  // =========================================================================
  // SECTION 6: Concurrent Interaction Stress
  // =========================================================================

  test.describe('Concurrent Interactions', () => {
    test('STRESS-050: click while page is still loading (race condition audit)', async ({ page }) => {
      // Start navigating to heavy page
      const heavyRoutes = ['/members/spx-command-center', '/members/ai-coach', '/members/journal']

      for (const route of heavyRoutes) {
        const navPromise = page.goto(route)

        // Immediately start clicking things before page loads
        for (let i = 0; i < 5; i++) {
          await page.mouse.click(200 + i * 50, 400)
          await page.waitForTimeout(50)
        }

        await navPromise?.catch(() => {})
        await page.waitForLoadState('domcontentloaded')
      }

      const elapsed = await assertPageResponsive(page, 'post-click-during-load')
      expect(elapsed).toBeLessThan(2000)
    })

    test('STRESS-051: resize viewport rapidly while navigating', async ({ page }) => {
      const viewports = [
        { width: 1440, height: 900 },
        { width: 768, height: 1024 },
        { width: 390, height: 844 },
        { width: 1920, height: 1080 },
        { width: 375, height: 667 },
      ]

      await page.goto('/members/spx-command-center')
      await page.waitForLoadState('domcontentloaded')

      const maxFrame = await measureFrameJank(page, async () => {
        for (let i = 0; i < 15; i++) {
          const vp = viewports[i % viewports.length]
          await page.setViewportSize(vp)

          // Also navigate on every third resize
          if (i % 3 === 0) {
            const route = MEMBER_ROUTES[i % MEMBER_ROUTES.length]
            page.goto(route).catch(() => {})
          }

          await page.waitForTimeout(100)
        }
      })

      await page.waitForLoadState('domcontentloaded')
      console.log(`STRESS-051: max frame time (resize + nav) = ${Math.round(maxFrame)}ms`)

      const elapsed = await assertPageResponsive(page, 'post-resize-nav-combo')
      expect(elapsed).toBeLessThan(3000)
    })
  })

  // =========================================================================
  // SECTION 7: Memory & Cleanup Validation
  // =========================================================================

  test.describe('Memory & Cleanup', () => {
    test('STRESS-060: no JS errors after 30 rapid navigations', async ({ page }) => {
      const jsErrors: string[] = []
      page.on('pageerror', (error) => {
        // Ignore known benign errors
        const msg = error.message || ''
        if (msg.includes('ResizeObserver') || msg.includes('AbortError') || msg.includes('navigation')) return
        jsErrors.push(msg)
      })

      for (let i = 0; i < 30; i++) {
        const route = MEMBER_ROUTES[i % MEMBER_ROUTES.length]
        await page.goto(route)
        await page.waitForTimeout(100)
      }

      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000) // Let async errors surface

      if (jsErrors.length > 0) {
        console.warn(`STRESS-060: ${jsErrors.length} JS errors detected:`)
        jsErrors.slice(0, 10).forEach((err, i) => console.warn(`  ${i + 1}. ${err.slice(0, 200)}`))
      }

      expect(jsErrors.length, `Unexpected JS errors after rapid navigation:\n${jsErrors.slice(0, 5).join('\n')}`).toBe(0)
    })

    test('STRESS-061: no unhandled promise rejections during tab storm', async ({ page }) => {
      const rejections: string[] = []

      // Listen for unhandled rejections via console
      page.on('console', (msg) => {
        if (msg.type() === 'error' && msg.text().includes('Unhandled')) {
          rejections.push(msg.text())
        }
      })

      // Also catch page errors
      page.on('pageerror', (error) => {
        if (error.message?.includes('Unhandled') || error.message?.includes('rejection')) {
          rejections.push(error.message)
        }
      })

      await page.goto('/members/spx-command-center')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      // Storm: alternate between routes rapidly
      for (let i = 0; i < 20; i++) {
        const route = MEMBER_ROUTES[i % MEMBER_ROUTES.length]
        page.goto(route).catch(() => {})
        await page.waitForTimeout(80)
      }

      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(2000) // Let async work settle

      if (rejections.length > 0) {
        console.warn(`STRESS-061: ${rejections.length} unhandled rejections:`)
        rejections.slice(0, 5).forEach((r, i) => console.warn(`  ${i + 1}. ${r.slice(0, 200)}`))
      }

      expect(rejections.length, `Unhandled promise rejections during tab storm`).toBe(0)
    })

    test('STRESS-062: heap size does not grow unbounded after navigation cycle', async ({ page }) => {
      await page.goto('/members/journal')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      // Baseline heap measurement
      const baselineHeap = await page.evaluate(() => {
        if ((performance as any).memory) {
          return (performance as any).memory.usedJSHeapSize as number
        }
        return null
      })

      if (baselineHeap === null) {
        // performance.memory not available (non-Chrome or headless restrictions)
        test.skip()
        return
      }

      // Navigate through all routes 5 times
      for (let cycle = 0; cycle < 5; cycle++) {
        for (const route of MEMBER_ROUTES) {
          await page.goto(route)
          await page.waitForTimeout(200)
        }
      }

      // Force GC if available
      await page.evaluate(() => {
        if ((window as any).gc) (window as any).gc()
      })
      await page.waitForTimeout(1000)

      const finalHeap = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize as number
      })

      const heapGrowthMB = (finalHeap - baselineHeap) / (1024 * 1024)
      console.log(`STRESS-062: heap growth after 30 navigations = ${heapGrowthMB.toFixed(1)}MB (baseline: ${(baselineHeap / 1024 / 1024).toFixed(1)}MB)`)

      // Allow up to 50MB growth — anything more suggests a memory leak
      expect(heapGrowthMB, `Heap grew by ${heapGrowthMB.toFixed(1)}MB — possible memory leak`).toBeLessThan(50)
    })
  })

  // =========================================================================
  // SECTION 8: Profile Tabs & Heavy Data Loading
  // =========================================================================

  test.describe('Profile & Academy Stress', () => {
    test('STRESS-070: rapid profile page load/unload cycles', async ({ page }) => {
      for (let i = 0; i < 10; i++) {
        await page.goto('/members/profile')
        await page.waitForTimeout(100)
        await page.goto('/members/journal')
        await page.waitForTimeout(100)
      }

      const elapsed = await assertPageResponsive(page, 'post-profile-cycle')
      expect(elapsed).toBeLessThan(2000)
    })

    test('STRESS-071: academy page with rapid module navigation', async ({ page }) => {
      await page.goto('/members/academy')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(500)

      // Click any visible academy links/cards
      const cards = page.locator('a[href*="/academy/"], a[href*="/modules/"], [data-testid*="course"], [data-testid*="module"]')
      const cardCount = await cards.count()

      if (cardCount > 0) {
        for (let i = 0; i < Math.min(cardCount * 3, 15); i++) {
          const card = cards.nth(i % cardCount)
          if (await card.isVisible({ timeout: 500 }).catch(() => false)) {
            await card.click()
            await page.waitForTimeout(100)
            await page.goBack()
            await page.waitForTimeout(100)
          }
        }
      }

      const elapsed = await assertPageResponsive(page, 'post-academy-nav')
      expect(elapsed).toBeLessThan(2000)
    })
  })
})
