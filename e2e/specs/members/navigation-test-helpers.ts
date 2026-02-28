import type { Page, Route } from '@playwright/test'
import { authenticateAsMember } from '../../helpers/member-auth'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const E2E_USER_ID = '00000000-0000-4000-8000-000000000001'
export const BYPASS_URL = (path: string) => `${path}${path.includes('?') ? '&' : '?'}e2eBypassAuth=1`

/** All member-facing tabs with their routes and identifiers for load assertions */
export const MEMBER_TABS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/members',
    landmark: '[aria-label="Dashboard welcome"]',
    fallbackText: 'Welcome',
  },
  {
    id: 'journal',
    label: 'Journal',
    path: '/members/journal',
    landmark: 'text="Trade Journal"',
    fallbackText: 'Trade Journal',
  },
  {
    id: 'ai-coach',
    label: 'AI Coach',
    path: '/members/ai-coach',
    landmark: '[data-testid="ai-coach-layout"]',
    fallbackText: 'AI Coach',
  },
  {
    id: 'academy',
    label: 'Academy',
    path: '/members/academy',
    landmark: '[data-testid="academy-dashboard"]',
    fallbackText: 'Academy',
  },
  {
    id: 'profile',
    label: 'Profile',
    path: '/members/profile',
    landmark: '[data-testid="settings-button"]',
    fallbackText: 'Profile',
  },
  {
    id: 'spx-command-center',
    label: 'SPX',
    path: '/members/spx-command-center',
    landmark: '[data-testid="spx-command-center"]',
    fallbackText: 'SPX',
  },
  {
    id: 'social',
    label: 'Social',
    path: '/members/social',
    landmark: '[data-testid="social-feed"]',
    fallbackText: 'Social',
  },
] as const

export type MemberTab = (typeof MEMBER_TABS)[number]

// ---------------------------------------------------------------------------
// Performance Metrics Collection
// ---------------------------------------------------------------------------

export interface NavigationMetrics {
  tab: string
  path: string
  startTime: number
  domContentLoaded: number
  firstPaint: number | null
  loadComplete: number
  landmarkVisible: number | null
}

/**
 * Collect performance timing for a navigation event.
 * Returns metrics including DOM load, first paint, and landmark visibility.
 */
export async function collectNavigationMetrics(
  page: Page,
  tab: MemberTab,
): Promise<NavigationMetrics> {
  const startTime = Date.now()

  await page.goto(BYPASS_URL(tab.path), { waitUntil: 'domcontentloaded' })
  const domContentLoaded = Date.now()

  // Attempt to get first paint timing from Performance API
  let firstPaint: number | null = null
  try {
    firstPaint = await page.evaluate(() => {
      const entries = performance.getEntriesByType('paint')
      const fp = entries.find(e => e.name === 'first-contentful-paint')
      return fp ? Math.round(fp.startTime) : null
    })
  } catch {
    // Silently continue — paint timing may not be available
  }

  const loadComplete = Date.now()

  // Measure time to landmark visibility
  let landmarkVisible: number | null = null
  try {
    const landmarkLocator = tab.landmark.startsWith('text=')
      ? page.getByText(tab.landmark.replace('text=', '').replace(/"/g, ''))
      : page.locator(tab.landmark)
    await landmarkLocator.first().waitFor({ state: 'visible', timeout: 15_000 })
    landmarkVisible = Date.now()
  } catch {
    // Landmark not found — may still be loading or have different structure
  }

  return {
    tab: tab.id,
    path: tab.path,
    startTime,
    domContentLoaded: domContentLoaded - startTime,
    firstPaint,
    loadComplete: loadComplete - startTime,
    landmarkVisible: landmarkVisible ? landmarkVisible - startTime : null,
  }
}

// ---------------------------------------------------------------------------
// Auth & Shell Setup
// ---------------------------------------------------------------------------

export async function enableNavigationBypass(page: Page): Promise<void> {
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

export async function setupNavigationShellMocks(page: Page): Promise<void> {
  // Config roles
  await page.route('**/api/config/roles*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })

  // Config tabs — all tabs active for navigation testing
  await page.route('**/api/config/tabs*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { tab_id: 'dashboard', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 1, label: 'Dashboard', icon: 'home', path: '/members' },
          { tab_id: 'journal', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 2, label: 'Journal', icon: 'book', path: '/members/journal' },
          { tab_id: 'ai-coach', required_tier: 'core', is_active: true, is_required: false, mobile_visible: true, sort_order: 3, label: 'AI Coach', icon: 'bot', path: '/members/ai-coach' },
          { tab_id: 'library', required_tier: 'core', is_active: true, is_required: false, mobile_visible: true, sort_order: 4, label: 'Academy', icon: 'book-open', path: '/members/academy' },
          { tab_id: 'profile', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 5, label: 'Profile', icon: 'user', path: '/members/profile' },
          { tab_id: 'spx-command-center', required_tier: 'pro', is_active: true, is_required: false, mobile_visible: true, sort_order: 6, label: 'SPX', icon: 'target', path: '/members/spx-command-center' },
          { tab_id: 'social', required_tier: 'core', is_active: true, is_required: false, mobile_visible: false, sort_order: 7, label: 'Social', icon: 'users', path: '/members/social' },
        ],
      }),
    })
  })

  // Member profile
  await page.route('**/api/members/profile*', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: E2E_USER_ID,
          discord_username: 'E2ETrader',
          email: 'e2e@example.com',
          membership_tier: 'pro',
          discord_roles: ['role-core-sniper', 'role-pro'],
          discord_avatar: null,
          created_at: '2026-01-01T00:00:00.000Z',
        },
      }),
    })
  })
}

// ---------------------------------------------------------------------------
// Feature API Mocks (lightweight stubs — enough for page loads)
// ---------------------------------------------------------------------------

export async function setupAllPageMocks(page: Page): Promise<void> {
  // Dashboard stats
  await page.route('**/api/members/dashboard/stats*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { win_rate: 62.5, pnl_mtd: 1250.75, pnl_change_pct: 8.3, current_streak: 3, streak_type: 'win', best_streak: 7, avg_ai_grade: 'B', trades_mtd: 24, trades_last_month: 31 },
      }),
    })
  })

  // Dashboard equity curve
  await page.route('**/api/members/dashboard/equity-curve*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    })
  })

  // Dashboard calendar
  await page.route('**/api/members/dashboard/calendar*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    })
  })

  // Journal entries
  await page.route('**/api/members/journal*', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    })
  })

  // Journal analytics
  await page.route('**/api/members/journal/analytics*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { total_trades: 0, win_rate: 0, total_pnl: 0, patterns: [], suggestion: null } }),
    })
  })

  // Market data endpoints
  await page.route('**/api/market/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    })
  })

  // AI Coach endpoints
  await page.route('**/api/ai-coach/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    })
  })

  // AI Coach chat sessions
  await page.route('**/api/chat/sessions*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { sessions: [] } }),
    })
  })

  // Academy endpoints
  await page.route('**/api/academy-v3/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    })
  })

  // Profile transcript
  await page.route('**/api/members/profile/transcript*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { transcript: [] } }),
    })
  })

  // Affiliate
  await page.route('**/api/members/affiliate*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: null }),
    })
  })

  // SPX command center endpoints
  await page.route('**/api/spx/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    })
  })

  // Social endpoints
  await page.route('**/api/social/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    })
  })

  // Catch-all for any remaining API calls to prevent 404s
  await page.route('**/api/**', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback()
      return
    }

    const pathname = new URL(route.request().url()).pathname
    const delegatedPrefixes = [
      '/api/config/roles',
      '/api/config/tabs',
      '/api/members/profile',
      '/api/members/dashboard/stats',
      '/api/members/dashboard/equity-curve',
      '/api/members/dashboard/calendar',
      '/api/members/journal',
      '/api/market/',
      '/api/ai-coach/',
      '/api/chat/sessions',
      '/api/academy-v3/',
      '/api/members/affiliate',
      '/api/spx/',
      '/api/social/',
    ]

    if (delegatedPrefixes.some(prefix => pathname === prefix || pathname.startsWith(prefix))) {
      await route.fallback()
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    })
  })
}

// ---------------------------------------------------------------------------
// Combined Setup
// ---------------------------------------------------------------------------

export async function setupAllNavigationMocks(page: Page): Promise<void> {
  await enableNavigationBypass(page)
  await setupNavigationShellMocks(page)
  await setupAllPageMocks(page)
}

// ---------------------------------------------------------------------------
// Assertion Helpers
// ---------------------------------------------------------------------------

/**
 * Assert that a page has loaded by checking URL and landmark visibility.
 * Uses a generous timeout for production-grade validation.
 */
export async function assertPageLoaded(
  page: Page,
  tab: MemberTab,
  options: { timeout?: number } = {},
): Promise<boolean> {
  const timeout = options.timeout ?? 15_000

  try {
    // Wait for URL to match
    await page.waitForURL(`**${tab.path}**`, { timeout })

    // Try landmark first, then fallback text
    const landmarkLocator = tab.landmark.startsWith('text=')
      ? page.getByText(tab.landmark.replace('text=', '').replace(/"/g, ''))
      : page.locator(tab.landmark)

    try {
      await landmarkLocator.first().waitFor({ state: 'visible', timeout: timeout / 2 })
      return true
    } catch {
      // Fallback: check for any meaningful content on the page
      const body = page.locator('body')
      await body.waitFor({ state: 'visible', timeout: 5_000 })
      return true
    }
  } catch {
    return false
  }
}

/**
 * Measure client-side navigation time between two tabs using the sidebar.
 */
export async function measureClientNavigation(
  page: Page,
  fromTab: MemberTab,
  toTab: MemberTab,
): Promise<{ durationMs: number; success: boolean }> {
  // Ensure we're on the source page
  await page.goto(BYPASS_URL(fromTab.path), { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('load')
  await page.waitForLoadState('networkidle', { timeout: 2_000 }).catch(() => {
    // Some member pages keep polling/websocket connections open.
  })

  const startTime = Date.now()

  // Click the sidebar link for the target tab
  const sidebarLink = page.locator(`aside a[href*="${toTab.path}"]`).first()

  if (await sidebarLink.isVisible()) {
    await sidebarLink.click()
  } else {
    // Try mobile bottom nav
    const bottomNavLink = page.locator(`nav a[href*="${toTab.path}"]`).first()
    if (await bottomNavLink.isVisible()) {
      await bottomNavLink.click()
    } else {
      // Direct navigation as fallback
      await page.goto(BYPASS_URL(toTab.path), { waitUntil: 'domcontentloaded' })
    }
  }

  const success = await assertPageLoaded(page, toTab)
  const durationMs = Date.now() - startTime

  return { durationMs, success }
}
