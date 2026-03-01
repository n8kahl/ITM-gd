import type { Page, Route } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'

export const MOBILE_VIEWPORT = { width: 390, height: 844 }
export const MOBILE_STUDIO_URL = '/members/studio?e2eBypassAuth=1'
export const MOBILE_SPX_URL = '/members/spx-command-center?e2eBypassAuth=1'
export const MOBILE_AI_COACH_URL = '/members/ai-coach?e2eBypassAuth=1'

type MockMemberTab = {
  tab_id: string
  required_tier: 'core' | 'pro'
  is_active: boolean
  is_required: boolean
  mobile_visible: boolean
  sort_order: number
  label: string
  icon: string
  path: string
}

const BASE_MOBILE_TABS: MockMemberTab[] = [
  { tab_id: 'dashboard', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 1, label: 'Dashboard', icon: 'LayoutDashboard', path: '/members' },
  { tab_id: 'journal', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 2, label: 'Journal', icon: 'BookOpen', path: '/members/journal' },
  { tab_id: 'ai-coach', required_tier: 'core', is_active: true, is_required: false, mobile_visible: true, sort_order: 3, label: 'AI Coach', icon: 'Bot', path: '/members/ai-coach' },
  { tab_id: 'library', required_tier: 'core', is_active: true, is_required: false, mobile_visible: true, sort_order: 4, label: 'Academy', icon: 'GraduationCap', path: '/members/academy' },
  { tab_id: 'studio', required_tier: 'core', is_active: true, is_required: false, mobile_visible: true, sort_order: 5, label: 'Studio', icon: 'Palette', path: '/members/studio' },
  { tab_id: 'profile', required_tier: 'core', is_active: true, is_required: true, mobile_visible: true, sort_order: 6, label: 'Profile', icon: 'UserCircle', path: '/members/profile' },
  { tab_id: 'spx-command-center', required_tier: 'pro', is_active: true, is_required: false, mobile_visible: true, sort_order: 7, label: 'SPX', icon: 'Target', path: '/members/spx-command-center' },
]

const EXTRA_TAB_COUNT = 14
const EXTRA_MOBILE_TABS: MockMemberTab[] = Array.from({ length: EXTRA_TAB_COUNT }, (_, index) => {
  const sortOrder = BASE_MOBILE_TABS.length + index + 1
  return {
    tab_id: `extra-mobile-${index + 1}`,
    required_tier: 'core',
    is_active: true,
    is_required: false,
    mobile_visible: true,
    sort_order: sortOrder,
    label: `Extra ${index + 1}`,
    icon: 'LayoutDashboard',
    path: `/members/extra-${index + 1}`,
  }
})

const MOBILE_TABS: MockMemberTab[] = [...BASE_MOBILE_TABS, ...EXTRA_MOBILE_TABS]

export const MOBILE_VISIBLE_TAB_COUNT = MOBILE_TABS.filter((tab) => tab.mobile_visible).length

export async function enableMobileBypass(page: Page): Promise<void> {
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

export async function setupMobileShellMocks(page: Page): Promise<void> {
  await page.route('**/api/config/roles*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })

  await page.route('**/api/config/tabs*', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: MOBILE_TABS,
      }),
    })
  })

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
          id: '00000000-0000-4000-8000-000000000001',
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

export async function setupSpxFallbackMocks(page: Page): Promise<void> {
  await page.route('**/api/spx/**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {},
      }),
    })
  })
}

export async function prepareMobileMemberShell(page: Page): Promise<void> {
  await page.setViewportSize(MOBILE_VIEWPORT)
  await enableMobileBypass(page)
  await setupMobileShellMocks(page)
}

export async function seedInstallPromptState(page: Page, _visitCount: number = 2): Promise<void> {
  await page.addInitScript(() => {
    localStorage.removeItem('tradeitm:pwa-install-dismissed')
    localStorage.removeItem('tradeitm:pwa-install-dismissed:v2')
    localStorage.removeItem('tradeitm:pwa-install-visit-count')
    sessionStorage.removeItem('tradeitm:pwa-install-visit-counted')
  })
}
