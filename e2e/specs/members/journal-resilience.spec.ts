import { expect, test, type Page, type Route } from '@playwright/test'

async function enableMembersBypass(page: Page): Promise<void> {
  await page.setExtraHTTPHeaders({
    'x-e2e-bypass-auth': '1',
  })
}

async function setupBaseMemberMocks(page: Page): Promise<void> {
  await page.route('**/api/config/roles', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })

  await page.route('**/api/config/tabs', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { tab_id: 'dashboard', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 1, label: 'Dashboard', icon: 'home', path: '/members' },
          { tab_id: 'journal', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 2, label: 'Journal', icon: 'book', path: '/members/journal' },
          { tab_id: 'ai-coach', required_tier: 'pro', is_active: true, is_required: false, mobile_visible: true, sort_order: 3, label: 'AI Coach', icon: 'sparkles', path: '/members/ai-coach' },
          { tab_id: 'library', required_tier: 'core', is_active: true, is_required: false, mobile_visible: true, sort_order: 4, label: 'Library', icon: 'book-open', path: '/members/library' },
          { tab_id: 'profile', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 5, label: 'Profile', icon: 'user', path: '/members/profile' },
        ],
      }),
    })
  })
}

async function setupMalformedJournalMocks(page: Page): Promise<void> {
  await page.route('**/api/members/journal**', async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname
    const method = request.method()

    if (pathname === '/api/members/journal' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{
            id: 'entry-malformed-1',
            user_id: '00000000-0000-4000-8000-000000000001',
            trade_date: null,
            symbol: 'SPY',
            direction: 'long',
            entry_price: 500,
            exit_price: 505,
            position_size: 1,
            pnl: 5,
            pnl_percentage: 1,
            is_winner: true,
            tags: null,
            smart_tags: null,
            ai_analysis: {
              summary: null,
              grade: null,
              entry_analysis: {
                quality: 'good',
                observations: null,
                improvements: 'not-an-array',
              },
            },
            created_at: null,
            updated_at: null,
          }],
          streaks: {
            current_streak: 1,
            longest_streak: 1,
            total_entries: 1,
            total_winners: 1,
            total_losers: 0,
          },
        }),
      })
      return
    }

    if (pathname === '/api/members/journal/open-positions' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
      return
    }

    if (pathname === '/api/members/journal/drafts' && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
      return
    }

    if (pathname === '/api/members/journal/auto-journal' && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { created: 0 } }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {} }),
    })
  })
}

test.describe('Trade Journal Resilience', () => {
  test('stays interactive with malformed entry data and can navigate to AI Coach', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => {
      pageErrors.push(error.message)
    })

    await enableMembersBypass(page)
    await setupBaseMemberMocks(page)
    await setupMalformedJournalMocks(page)

    await page.goto('/members/journal', { timeout: 30000 })

    await expect(page.getByRole('heading', { name: 'Trade Journal' })).toBeVisible()
    await expect(page.getByText('1 trade logged')).toBeVisible()

    await page.getByRole('link', { name: 'AI Coach' }).click()
    await expect(page).toHaveURL(/\/members\/ai-coach/)

    const combinedErrors = pageErrors.join('\n')
    expect(combinedErrors).not.toContain('Cannot read properties of null')
    expect(combinedErrors).not.toContain('includes is not a function')
  })
})

