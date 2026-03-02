import { expect, test, type Page, type Route } from '@playwright/test'

import { authenticateAsMember } from '../../helpers/member-auth'

const MENTORSHIP_URL = '/members/mentorship?e2eBypassAuth=1'
const WEEK_1_URL = '/members/mentorship/week-1?e2eBypassAuth=1'

async function enableMemberBypass(page: Page): Promise<void> {
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

async function setupMentorshipShellMocks(page: Page, includeMentorshipTab: boolean): Promise<void> {
  await page.route('**/api/config/roles*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })

  await page.route('**/api/config/tabs*', async (route: Route) => {
    const tabs = [
      { tab_id: 'dashboard', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 1, label: 'Dashboard', icon: 'LayoutDashboard', path: '/members' },
      { tab_id: 'journal', required_tier: 'core', is_active: true, is_required: false, mobile_visible: true, sort_order: 2, label: 'Journal', icon: 'BookOpen', path: '/members/journal' },
      { tab_id: 'profile', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 3, label: 'Profile', icon: 'UserCircle', path: '/members/profile' },
    ]

    if (includeMentorshipTab) {
      tabs.push({
        tab_id: 'mentorship',
        required_tier: 'core',
        is_active: true,
        is_required: false,
        mobile_visible: true,
        sort_order: 9,
        label: 'Mentorship',
        icon: 'Crosshair',
        path: '/members/mentorship',
        required_discord_role_ids: ['1468748795234881597'],
      })
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: tabs,
      }),
    })
  })
}

test.describe('Mentorship Experience', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableMemberBypass(page)
  })

  test('renders mentorship overview and resources for authorized members', async ({ page }) => {
    await setupMentorshipShellMocks(page, true)

    await page.goto(MENTORSHIP_URL, { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: 'Trade In The Money' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Start Week 1' })).toBeVisible()

    await page.getByRole('link', { name: 'Resources' }).click()
    await expect(page).toHaveURL(/\/members\/mentorship\/resources/)
    await expect(page.getByRole('heading', { name: 'Resource Hub' })).toBeVisible()
  })

  test('blocks direct mentorship deep-link when user lacks mentorship tab access', async ({ page }) => {
    await setupMentorshipShellMocks(page, false)

    await page.goto(WEEK_1_URL, { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('mentorship-access-denied')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Mentorship Access Required' })).toBeVisible()
  })
})
