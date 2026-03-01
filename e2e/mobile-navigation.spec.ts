import { expect, test } from '@playwright/test'
import {
  MOBILE_AI_COACH_URL,
  MOBILE_SPX_URL,
  MOBILE_STUDIO_URL,
  MOBILE_VIEWPORT,
  MOBILE_VISIBLE_TAB_COUNT,
  prepareMobileMemberShell,
  setupSpxFallbackMocks,
} from './mobile-test-helpers'
import {
  enableBypass as enableAICoachBypass,
  setupAllAICoachMocks,
  setupOnboarding,
} from './specs/ai-coach/ai-coach-test-helpers'

test.describe('Mobile navigation regression suite', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await prepareMobileMemberShell(page)
    await setupSpxFallbackMocks(page)
  })

  test('renders all mobile-visible tabs in bottom nav + More menu', async ({ page }) => {
    await page.goto(MOBILE_STUDIO_URL, { waitUntil: 'domcontentloaded' })

    const bottomNav = page.locator('[data-mobile-bottom-nav]')
    await expect(bottomNav).toBeVisible()
    await bottomNav.getByRole('button', { name: 'Open more menu' }).click()

    await expect(bottomNav.locator('a')).toHaveCount(MOBILE_VISIBLE_TAB_COUNT)
    await expect(bottomNav.getByRole('link', { name: /^Dashboard$/ })).toBeVisible()
    await expect(bottomNav.getByRole('link', { name: /^Journal$/ })).toBeVisible()
    await expect(bottomNav.getByRole('link', { name: /^AI Coach$/ })).toBeVisible()
    await expect(bottomNav.getByRole('link', { name: /^Academy$/ })).toBeVisible()
    await expect(bottomNav.getByRole('link', { name: /^Studio$/ })).toBeVisible()
    await expect(bottomNav.getByRole('link', { name: /^Profile$/ })).toBeVisible()
    await expect(bottomNav.getByRole('link', { name: /^SPX$/ })).toBeVisible()
  })

  test('More menu opens, scrolls, and dismisses on touch/pointer interactions', async ({ page }) => {
    await page.goto(MOBILE_STUDIO_URL, { waitUntil: 'domcontentloaded' })

    const bottomNav = page.locator('[data-mobile-bottom-nav]')
    await bottomNav.getByRole('button', { name: 'Open more menu' }).click()

    const moreMenu = bottomNav.locator('div.overflow-y-auto')
    await expect(moreMenu).toBeVisible()

    await expect.poll(
      () => moreMenu.evaluate((node) => node.scrollHeight > node.clientHeight),
      { timeout: 10_000 },
    ).toBe(true)

    await moreMenu.evaluate((node) => {
      node.scrollTop = node.scrollHeight
    })

    await expect.poll(
      () => moreMenu.evaluate((node) => node.scrollTop),
      { timeout: 10_000 },
    ).toBeGreaterThan(0)

    await page.getByRole('heading', { name: 'Media Command Studio' }).click()
    await expect(moreMenu).not.toBeVisible()
  })

  test('SPX route hides bottom nav on mobile', async ({ page }) => {
    await page.goto(MOBILE_SPX_URL, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-mobile-bottom-nav]')).toHaveCount(0)
  })

  test('Studio route loads successfully on mobile viewport', async ({ page }) => {
    await page.goto(MOBILE_STUDIO_URL, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Media Command Studio' })).toBeVisible()
  })
})

test.describe('Mobile options chain toggle regression', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await page.setViewportSize(MOBILE_VIEWPORT)
    await enableAICoachBypass(page)
    await setupOnboarding(page, { complete: true })
    await setupAllAICoachMocks(page)
  })

  test('options chain Calls/Puts segmented toggle works on mobile', async ({ page }) => {
    test.fixme(
      true,
      'Deferred pending AI Coach options-panel E2E contract stabilization (current harness trips runtime error boundary before sheet controls render).',
    )
    await page.goto(MOBILE_AI_COACH_URL, { waitUntil: 'domcontentloaded' })
  })
})
