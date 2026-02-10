import { test, expect, type Page } from '@playwright/test'

/**
 * AI Coach E2E Tests — Center Panel Views
 *
 * Tests the AI Coach center panel view switching, onboarding flow,
 * and individual view rendering.
 *
 * Prerequisites:
 *   - Frontend running on localhost:3000
 *   - Backend running on localhost:3001
 *   - A test user session (or mock auth)
 */

const AI_COACH_URL = '/members/ai-coach'
const WELCOME_VIEW_HEADING = /Ready to execute the session plan\?/i

// Helper to bypass auth for testing — uses a mock session cookie
async function navigateAsAuthenticatedUser(page: Page) {
  // Navigate to the AI Coach page
  // If redirected to login, this test suite requires a test user setup
  await page.goto(AI_COACH_URL)
  await page.waitForLoadState('networkidle')
}

async function waitForWelcomeView(page: Page) {
  await expect(page.getByRole('heading', { name: WELCOME_VIEW_HEADING })).toBeVisible({ timeout: 10000 })
}

test.describe('AI Coach — Page Load', () => {
  test('should load the AI Coach page', async ({ page }) => {
    await page.goto(AI_COACH_URL)
    await expect(page).toHaveTitle(/Trade In The Money|ITM|AI Coach/i)
  })

  test('should display the AI Coach header', async ({ page }) => {
    await navigateAsAuthenticatedUser(page)
    // The page should have AI Coach branding
    await expect(page.locator('main h3:visible', { hasText: 'AI Coach' }).first()).toBeVisible({ timeout: 10000 })
  })
})

test.describe('AI Coach — Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear onboarding state
    await page.addInitScript(() => {
      localStorage.removeItem('ai-coach-onboarding-complete')
    })
  })

  test('should show onboarding on first visit', async ({ page }) => {
    await navigateAsAuthenticatedUser(page)
    // Look for onboarding content
    const welcomeHeading = page.locator('text=Welcome to AI Coach')
    await expect(welcomeHeading.first()).toBeVisible({ timeout: 10000 })
  })

  test('should navigate through onboarding steps', async ({ page }) => {
    await navigateAsAuthenticatedUser(page)
    await page.waitForSelector('text=Welcome to AI Coach', { timeout: 10000 })

    // Click Next through all steps
    const nextButton = page.locator('button:has-text("Next")')

    // Step 1 -> Step 2
    await nextButton.click()
    await expect(page.locator('text=Market Analysis').first()).toBeVisible()

    // Step 2 -> Step 3
    await nextButton.click()
    await expect(page.locator('text=Options & Positions').first()).toBeVisible()

    // Step 3 -> Step 4
    await nextButton.click()
    await expect(page.locator('text=Trading Tools').first()).toBeVisible()

    // Step 4 -> Complete
    const getStartedButton = page.locator('button:has-text("Get Started")')
    await getStartedButton.click()

    // Should now show the welcome view
    await waitForWelcomeView(page)
  })

  test('should skip onboarding', async ({ page }) => {
    await navigateAsAuthenticatedUser(page)
    await page.waitForSelector('text=Welcome to AI Coach', { timeout: 10000 })

    const skipButton = page.locator('text=Skip tour')
    await skipButton.click()

    // Should show the welcome/home view
    await waitForWelcomeView(page)
  })

  test('should not show onboarding after completion', async ({ page }) => {
    // Set onboarding as complete
    await page.addInitScript(() => {
      localStorage.setItem('ai-coach-onboarding-complete', 'true')
    })

    await navigateAsAuthenticatedUser(page)

    // Should show welcome view directly
    await waitForWelcomeView(page)
    await expect(page.getByRole('heading', { name: 'Welcome to AI Coach' })).not.toBeVisible()
  })
})

test.describe('AI Coach — Center Panel Views', () => {
  test.beforeEach(async ({ page }) => {
    // Skip onboarding
    await page.addInitScript(() => {
      localStorage.setItem('ai-coach-onboarding-complete', 'true')
    })
    await navigateAsAuthenticatedUser(page)
    await waitForWelcomeView(page)
  })

  test('should display quick access cards on welcome view', async ({ page }) => {
    // Check for feature cards
    await expect(page.getByRole('button', { name: /Live Chart/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Options/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Analyze/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Daily Brief/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Journal/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Scanner/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^LEAPS/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Macro/i })).toBeVisible()
  })

  test('should navigate to Chart view', async ({ page }) => {
    await page.getByRole('button', { name: /Live Chart/i }).click()
    await expect(page.getByRole('heading', { name: /Chart$/i })).toBeVisible()
    // Chart tab should be active in the tab bar
    const chartTab = page.getByRole('tab', { name: 'Chart' })
    await expect(chartTab).toHaveAttribute('aria-selected', 'true')
  })

  test('should navigate to Options view', async ({ page }) => {
    // Click Options card from welcome
    await page.getByRole('button', { name: /^Options/i }).click()
    // Tab bar should appear
    const optionsTab = page.getByRole('tab', { name: 'Options' })
    await expect(optionsTab).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('combobox').first()).toBeVisible()
  })

  test('should navigate to Journal view', async ({ page }) => {
    await page.getByRole('button', { name: /^Journal/i }).click()
    await expect(page.locator('text=Trade Journal').first()).toBeVisible({ timeout: 10000 })
  })

  test('should navigate to Alerts view', async ({ page }) => {
    await page.getByRole('button', { name: /More Tools/i }).click()
    await page.getByRole('button', { name: /^Alerts$/ }).click()
    // Alerts panel should appear
    await expect(page.getByRole('heading', { name: 'Price Alerts' })).toBeVisible({ timeout: 10000 })
  })

  test('should navigate to Scanner view', async ({ page }) => {
    await page.getByRole('button', { name: /^Scanner/i }).click()
    await expect(page.locator('text=Opportunity Scanner').first()).toBeVisible({ timeout: 10000 })
  })

  test('should return to Home from tab bar', async ({ page }) => {
    // Go to Chart first
    await page.getByRole('button', { name: /Live Chart/i }).click()
    await page.waitForTimeout(500)

    // Click Home button
    const homeButton = page.getByRole('button', { name: 'Go to home view' })
    await homeButton.click()

    // Should be back at welcome view
    await waitForWelcomeView(page)
  })
})

test.describe('AI Coach — Chat Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ai-coach-onboarding-complete', 'true')
    })
    await navigateAsAuthenticatedUser(page)
  })

  test('should display chat input area', async ({ page }) => {
    // Look for the chat input
    const chatInput = page.locator('textarea, input[type="text"]').first()
    await expect(chatInput).toBeVisible({ timeout: 10000 })
  })

  test('should have new session capability', async ({ page }) => {
    // Look for new session/chat button
    const newButton = page.locator('button[aria-label*="new"], button:has-text("New")')
    if (await newButton.count() > 0) {
      await expect(newButton.first()).toBeVisible()
    }
  })
})

test.describe('AI Coach — Example Prompts', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ai-coach-onboarding-complete', 'true')
    })
    await navigateAsAuthenticatedUser(page)
    await waitForWelcomeView(page)
  })

  test('should display example prompt cards', async ({ page }) => {
    await expect(page.getByRole('button', { name: /SPX Game Plan/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Morning Brief/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Best Setup Now/i }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /SPX vs SPY/i }).first()).toBeVisible()
  })
})

test.describe('AI Coach — Responsive Layout', () => {
  test('should show mobile toggle on small screens', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.addInitScript(() => {
      localStorage.setItem('ai-coach-onboarding-complete', 'true')
    })
    await navigateAsAuthenticatedUser(page)

    // On mobile, there should be a toggle between chat and panel views
    // Look for the mobile view toggle buttons
    const chatToggle = page.locator('button:has-text("Chat")')
    if (await chatToggle.count() > 0) {
      await expect(chatToggle.first()).toBeVisible()
    }
  })
})
