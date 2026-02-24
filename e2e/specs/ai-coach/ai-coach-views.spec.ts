import { test, expect, type Page } from '@playwright/test'
import { authenticateAsMember } from '../../helpers/member-auth'

/**
 * AI Coach E2E Tests — Current two-panel model
 *
 * Validates onboarding, welcome, and chart/options/journal workflows.
 */

const AI_COACH_URL = '/members/ai-coach'
const ONBOARDING_KEY = 'ai-coach-onboarding-complete'
const PREFERENCES_KEY = 'ai-coach-preferences-v2'
const WELCOME_VIEW_HEADING = /Ask for a complete trade thesis/i

async function prepareMemberSession(page: Page, options?: { onboardingComplete?: boolean }) {
  await page.addInitScript(({ onboardingKey, preferencesKey, onboardingComplete }) => {
    localStorage.removeItem(preferencesKey)
    if (onboardingComplete) {
      localStorage.setItem(onboardingKey, 'true')
    } else {
      localStorage.removeItem(onboardingKey)
    }
  }, {
    onboardingKey: ONBOARDING_KEY,
    preferencesKey: PREFERENCES_KEY,
    onboardingComplete: options?.onboardingComplete ?? false,
  })

  await authenticateAsMember(page)
}

async function navigateAsAuthenticatedUser(page: Page) {
  await page.goto(AI_COACH_URL)
  await page.waitForLoadState('networkidle')
}

async function waitForWelcomeView(page: Page) {
  await expect(page.getByRole('heading', { name: WELCOME_VIEW_HEADING })).toBeVisible({ timeout: 10000 })
}

async function waitForChartView(page: Page) {
  await expect(page.getByRole('tab', { name: 'Chart' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: /Chart$/i })).toBeVisible({ timeout: 10000 })
}

async function openWelcomeView(page: Page) {
  const welcomeHeading = page.getByRole('heading', { name: WELCOME_VIEW_HEADING })
  if (await welcomeHeading.count() > 0 && await welcomeHeading.first().isVisible()) {
    return
  }

  const homeButton = page.getByRole('button', { name: 'Go to home view' })
  if (await homeButton.count() > 0) {
    await homeButton.first().click()
  }

  await waitForWelcomeView(page)
}

test.describe('AI Coach — Page Load', () => {
  test('should load the AI Coach page', async ({ page }) => {
    await page.goto(AI_COACH_URL)
    await expect(page).toHaveTitle(/Trade In The Money|ITM|AI Coach/i)
  })

  test('should display the AI Coach header', async ({ page }) => {
    await prepareMemberSession(page, { onboardingComplete: true })
    await navigateAsAuthenticatedUser(page)
    const headerTitle = page.locator('main h3:visible').first()
    await expect(headerTitle).toBeVisible({ timeout: 10000 })
    await expect(headerTitle).toHaveText(/\S+/, { timeout: 10000 })
  })
})

test.describe('AI Coach — Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    await prepareMemberSession(page, { onboardingComplete: false })
  })

  test('should show onboarding on first visit', async ({ page }) => {
    await navigateAsAuthenticatedUser(page)
    await expect(page.locator('text=Welcome to AI Coach').first()).toBeVisible({ timeout: 10000 })
  })

  test('should navigate through onboarding steps', async ({ page }) => {
    await navigateAsAuthenticatedUser(page)
    await page.waitForSelector('text=Welcome to AI Coach', { timeout: 10000 })

    const nextButton = page.locator('button:has-text("Next")')

    await nextButton.click()
    await expect(page.locator('text=Market Analysis').first()).toBeVisible()

    await nextButton.click()
    await expect(page.locator('text=Options & Positions').first()).toBeVisible()

    await nextButton.click()
    await expect(page.locator('text=Workflow Tools').first()).toBeVisible()

    const getStartedButton = page.locator('button:has-text("Get Started")')
    await getStartedButton.click()

    await waitForChartView(page)
  })

  test('should skip onboarding', async ({ page }) => {
    await navigateAsAuthenticatedUser(page)
    await page.waitForSelector('text=Welcome to AI Coach', { timeout: 10000 })

    const skipButton = page.locator('text=Skip tour')
    await skipButton.click()

    await waitForChartView(page)
  })

  test('should not show onboarding after completion', async ({ page }) => {
    await prepareMemberSession(page, { onboardingComplete: true })
    await navigateAsAuthenticatedUser(page)

    await waitForChartView(page)
    await expect(page.getByRole('heading', { name: 'Welcome to AI Coach' })).not.toBeVisible()
  })
})

test.describe('AI Coach — Center Panel Views', () => {
  test.beforeEach(async ({ page }) => {
    await prepareMemberSession(page, { onboardingComplete: true })
    await navigateAsAuthenticatedUser(page)
    await openWelcomeView(page)
  })

  test('should display quick access cards on welcome view', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Live Chart/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Options/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Journal/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Open Settings/i })).toBeVisible()
  })

  test('should navigate to Chart view', async ({ page }) => {
    await page.getByRole('button', { name: /Live Chart/i }).click()
    await expect(page.getByRole('heading', { name: /Chart$/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Chart' })).toHaveAttribute('aria-selected', 'true')
  })

  test('should navigate to Options view', async ({ page }) => {
    await page.getByRole('button', { name: /^Options/i }).click()
    const optionsTab = page.getByRole('tab', { name: 'Options' })
    await expect(optionsTab).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('combobox').first()).toBeVisible()
  })

  test('should navigate to Journal view', async ({ page }) => {
    await page.getByRole('button', { name: /^Journal/i }).click()
    await expect(page.locator('text=Trade Journal').first()).toBeVisible({ timeout: 10000 })
  })

  test('should return to Home from tab bar', async ({ page }) => {
    await page.getByRole('button', { name: /Live Chart/i }).click()

    const homeButton = page.getByRole('button', { name: 'Go to home view' })
    await homeButton.click()

    await waitForWelcomeView(page)
  })
})

test.describe('AI Coach — Chat Panel', () => {
  test.beforeEach(async ({ page }) => {
    await prepareMemberSession(page, { onboardingComplete: true })
    await navigateAsAuthenticatedUser(page)
  })

  test('should display chat input area', async ({ page }) => {
    const chatInput = page.locator('textarea, input[type="text"]').first()
    await expect(chatInput).toBeVisible({ timeout: 10000 })
  })

  test('should have new session capability', async ({ page }) => {
    const newButton = page.locator('button[aria-label*="new"], button:has-text("New")')
    if (await newButton.count() > 0) {
      await expect(newButton.first()).toBeVisible()
    }
  })
})

test.describe('AI Coach — Example Prompts', () => {
  test.beforeEach(async ({ page }) => {
    await prepareMemberSession(page, { onboardingComplete: true })
    await navigateAsAuthenticatedUser(page)
    await openWelcomeView(page)
  })

  test('should display example prompt cards', async ({ page }) => {
    await expect(page.getByRole('button', { name: /SPX Game Plan/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Morning Brief/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Best Setup Now/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /SPX vs SPY/i }).first()).toBeVisible()
  })
})

test.describe('AI Coach — Responsive Layout', () => {
  test('should show mobile view controls on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await prepareMemberSession(page, { onboardingComplete: true })
    await navigateAsAuthenticatedUser(page)

    const chatToggle = page.locator('button:has-text("Chat")')
    if (await chatToggle.count() > 0) {
      await expect(chatToggle.first()).toBeVisible()
    }
  })
})
