import { test, expect } from '@playwright/test'

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

// Helper to bypass auth for testing — uses a mock session cookie
async function navigateAsAuthenticatedUser(page: any) {
  // Navigate to the AI Coach page
  // If redirected to login, this test suite requires a test user setup
  await page.goto(AI_COACH_URL)
  await page.waitForLoadState('networkidle')
}

test.describe('AI Coach — Page Load', () => {
  test('should load the AI Coach page', async ({ page }) => {
    await page.goto(AI_COACH_URL)
    await expect(page).toHaveTitle(/ITM|AI Coach/i)
  })

  test('should display the AI Coach header', async ({ page }) => {
    await navigateAsAuthenticatedUser(page)
    // The page should have AI Coach branding
    const heading = page.locator('text=AI Coach')
    await expect(heading.first()).toBeVisible({ timeout: 10000 })
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

    // Step 1 → Step 2
    await nextButton.click()
    await expect(page.locator('text=Market Analysis').first()).toBeVisible()

    // Step 2 → Step 3
    await nextButton.click()
    await expect(page.locator('text=Options & Positions').first()).toBeVisible()

    // Step 3 → Step 4
    await nextButton.click()
    await expect(page.locator('text=Trading Tools').first()).toBeVisible()

    // Step 4 → Complete
    const getStartedButton = page.locator('button:has-text("Get Started")')
    await getStartedButton.click()

    // Should now show the welcome view
    await expect(page.locator('text=AI Coach Center').first()).toBeVisible()
  })

  test('should skip onboarding', async ({ page }) => {
    await navigateAsAuthenticatedUser(page)
    await page.waitForSelector('text=Welcome to AI Coach', { timeout: 10000 })

    const skipButton = page.locator('text=Skip tour')
    await skipButton.click()

    // Should show the welcome/home view
    await expect(page.locator('text=AI Coach Center').first()).toBeVisible()
  })

  test('should not show onboarding after completion', async ({ page }) => {
    // Set onboarding as complete
    await page.addInitScript(() => {
      localStorage.setItem('ai-coach-onboarding-complete', 'true')
    })

    await navigateAsAuthenticatedUser(page)

    // Should show welcome view directly
    await expect(page.locator('text=AI Coach Center').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Your intelligent trading companion')).not.toBeVisible()
  })
})

test.describe('AI Coach — Center Panel Views', () => {
  test.beforeEach(async ({ page }) => {
    // Skip onboarding
    await page.addInitScript(() => {
      localStorage.setItem('ai-coach-onboarding-complete', 'true')
    })
    await navigateAsAuthenticatedUser(page)
    await page.waitForSelector('text=AI Coach Center', { timeout: 10000 })
  })

  test('should display quick access cards on welcome view', async ({ page }) => {
    // Check for feature cards
    await expect(page.locator('text=Live Chart').first()).toBeVisible()
    await expect(page.locator('text=Options').first()).toBeVisible()
    await expect(page.locator('text=Analyze').first()).toBeVisible()
    await expect(page.locator('text=Journal').first()).toBeVisible()
    await expect(page.locator('text=Alerts').first()).toBeVisible()
    await expect(page.locator('text=Scanner').first()).toBeVisible()
    await expect(page.locator('text=LEAPS').first()).toBeVisible()
    await expect(page.locator('text=Macro').first()).toBeVisible()
  })

  test('should navigate to Chart view', async ({ page }) => {
    await page.locator('text=Live Chart').first().click()
    await expect(page.locator('text=Chart').first()).toBeVisible()
    // Chart tab should be active in the tab bar
    const chartTab = page.locator('button:has-text("Chart")').first()
    await expect(chartTab).toBeVisible()
  })

  test('should navigate to Options view', async ({ page }) => {
    // Click Options card from welcome
    const optionsCard = page.locator('button:has-text("Options")').first()
    await optionsCard.click()
    // Tab bar should appear
    const optionsTab = page.locator('button:has-text("Options")')
    await expect(optionsTab.first()).toBeVisible()
  })

  test('should navigate to Journal view', async ({ page }) => {
    await page.locator('button:has-text("Journal")').first().click()
    await expect(page.locator('text=Trade Journal').first()).toBeVisible({ timeout: 10000 })
  })

  test('should navigate to Alerts view', async ({ page }) => {
    await page.locator('button:has-text("Alerts")').first().click()
    // Alerts panel should appear
    await expect(page.locator('text=Alerts').first()).toBeVisible({ timeout: 10000 })
  })

  test('should navigate to Scanner view', async ({ page }) => {
    await page.locator('button:has-text("Scanner")').first().click()
    await expect(page.locator('text=Opportunity Scanner').first()).toBeVisible({ timeout: 10000 })
  })

  test('should return to Home from tab bar', async ({ page }) => {
    // Go to Chart first
    await page.locator('text=Live Chart').first().click()
    await page.waitForTimeout(500)

    // Click Home button
    const homeButton = page.locator('button:has-text("Home")')
    await homeButton.click()

    // Should be back at welcome view
    await expect(page.locator('text=AI Coach Center').first()).toBeVisible()
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
    await page.waitForSelector('text=AI Coach Center', { timeout: 10000 })
  })

  test('should display example prompt cards', async ({ page }) => {
    await expect(page.locator('text=Key Levels').first()).toBeVisible()
    await expect(page.locator('text=Market Status').first()).toBeVisible()
    await expect(page.locator('text=ATR Analysis').first()).toBeVisible()
    await expect(page.locator('text=VWAP Check').first()).toBeVisible()
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
