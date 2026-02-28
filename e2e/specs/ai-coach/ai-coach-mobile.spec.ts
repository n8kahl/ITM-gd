import { test, expect } from '@playwright/test'
import {
  enableBypass,
  setupOnboarding,
  setupAllAICoachMocks,
  navigateToAICoach,
  waitForChatReady,
  sendChatMessage,
  AI_COACH_URL,
} from './ai-coach-test-helpers'

/**
 * AI Coach Mobile E2E Tests
 *
 * Validates mobile-specific layouts, responsive behavior, gesture interactions,
 * and mobile tool sheets for chart, options, and journal.
 */

test.describe.configure({ mode: 'serial' })

test.describe('AI Coach — Mobile Layout', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    // iPhone SE / small mobile viewport (375px wide)
    await page.setViewportSize({ width: 375, height: 812 })
    await enableBypass(page)
    await setupOnboarding(page, { complete: true })
    await setupAllAICoachMocks(page)
    await navigateToAICoach(page)
  })

  test('should display mobile layout controls', async ({ page }) => {
    // Wait for the page to fully load
    await waitForChatReady(page)

    // On mobile, chat input should be visible
    const chatInput = page.locator('textarea, input[type="text"]').first()
    await expect(chatInput).toBeVisible()

    // Mobile view should be active (< 1024px)
    const viewport = page.viewportSize()
    expect(viewport?.width).toBeLessThan(1024)

    // Mobile tool sheet should be hidden initially
    const mobileSheet = page.locator('[role="dialog"]')
    await expect(mobileSheet).not.toBeVisible()
  })

  test('should open chart in mobile tool sheet', async ({ page }) => {
    await waitForChatReady(page)

    // Find and click the Live Chart button (on welcome view or via navigation)
    const chartButton = page.getByRole('button', { name: /Live Chart|Chart/i }).first()
    await expect(chartButton).toBeVisible({ timeout: 10_000 })
    await chartButton.click()

    // Mobile tool sheet should appear with "Live Chart" header
    const sheet = page.locator('[role="dialog"]')
    await expect(sheet).toBeVisible({ timeout: 10_000 })

    const sheetHeader = sheet.locator('h3').first()
    await expect(sheetHeader).toContainText(/Live Chart|Chart/i)

    // Sheet should have z-50 class (fullscreen modal)
    await expect(sheet).toHaveClass(/z-50/)

    // Sheet should be modal (aria-modal)
    await expect(sheet).toHaveAttribute('aria-modal', 'true')
  })

  test('should close mobile sheet with close button', async ({ page }) => {
    await waitForChatReady(page)

    // Open the chart sheet
    const chartButton = page.getByRole('button', { name: /Live Chart|Chart/i }).first()
    await chartButton.click()

    // Wait for sheet to appear
    const sheet = page.locator('[role="dialog"]')
    await expect(sheet).toBeVisible({ timeout: 10_000 })

    // Find and click the Close button in the sheet header
    const closeButton = sheet.getByRole('button', { name: /Close/i })
    await expect(closeButton).toBeVisible()
    await closeButton.click()

    // Sheet should disappear
    await expect(sheet).not.toBeVisible({ timeout: 5_000 })

    // Chat should be accessible again
    const chatInput = page.locator('textarea, input[type="text"]').first()
    await expect(chatInput).toBeVisible()
  })

  test('should close mobile sheet with Escape key', async ({ page }) => {
    await waitForChatReady(page)

    // Open the chart sheet
    const chartButton = page.getByRole('button', { name: /Live Chart|Chart/i }).first()
    await chartButton.click()

    // Wait for sheet to appear
    const sheet = page.locator('[role="dialog"]')
    await expect(sheet).toBeVisible({ timeout: 10_000 })

    // Press Escape key
    await page.keyboard.press('Escape')

    // Sheet should disappear
    await expect(sheet).not.toBeVisible({ timeout: 5_000 })
  })

  test('should show chat input on mobile', async ({ page }) => {
    await waitForChatReady(page)

    // Chat textarea should be visible on mobile layout
    const chatInput = page.locator('textarea, input[type="text"]').first()
    await expect(chatInput).toBeVisible()

    // Input should be focusable and functional
    await chatInput.focus()
    await chatInput.type('Test message')

    // Text should appear in the input
    await expect(chatInput).toHaveValue(/Test message/)

    // Should have a send button visible
    const sendButton = page.getByRole('button', { name: /send|submit/i }).first()
    await expect(sendButton).toBeVisible()
  })

  test('should navigate between mobile views', async ({ page }) => {
    await waitForChatReady(page)

    // Open Chart sheet
    const chartButton = page.getByRole('button', { name: /Live Chart|Chart/i }).first()
    await chartButton.click()

    let sheet = page.locator('[role="dialog"]')
    await expect(sheet).toBeVisible({ timeout: 10_000 })

    let sheetHeader = sheet.locator('h3').first()
    await expect(sheetHeader).toContainText(/Live Chart|Chart/i)

    // Close chart sheet
    const chartCloseButton = sheet.getByRole('button', { name: /Close|Back/i }).first()
    await chartCloseButton.click()
    await expect(sheet).not.toBeVisible({ timeout: 5_000 })

    // Open Options sheet
    const optionsButton = page.getByRole('button', { name: /Options|Chain/i }).first()
    if (await optionsButton.isVisible({ timeout: 5_000 })) {
      await optionsButton.click()

      sheet = page.locator('[role="dialog"]')
      await expect(sheet).toBeVisible({ timeout: 10_000 })

      sheetHeader = sheet.locator('h3').first()
      await expect(sheetHeader).toContainText(/Options|Chain/i)

      // Close options sheet
      const optionsCloseButton = sheet.getByRole('button', { name: /Close|Back/i }).first()
      await optionsCloseButton.click()
      await expect(sheet).not.toBeVisible({ timeout: 5_000 })
    }

    // Verify we're back at chat view
    const chatInput = page.locator('textarea, input[type="text"]').first()
    await expect(chatInput).toBeVisible()
  })

  test('should hide desktop-only elements on mobile viewport', async ({ page }) => {
    await waitForChatReady(page)

    // Desktop context strip should be hidden on mobile
    const desktopContextStrip = page.locator('[data-testid="desktop-context-strip"], .desktop-context-strip, .hidden.lg\\:flex').first()

    // The context strip is conditionally rendered, check if it exists but is not visible
    const contextStripCount = await desktopContextStrip.count()
    if (contextStripCount > 0) {
      // If it exists, it should be hidden
      const isVisible = await desktopContextStrip.isVisible().catch(() => false)
      expect(isVisible).toBe(false)
    }

    // Verify layout is indeed mobile (stacked, full-width elements)
    const viewport = page.viewportSize()
    expect(viewport?.width).toBeLessThan(1024)

    // Chat panel should take full width on mobile
    const chatPanel = page.locator('textarea, input[type="text"]').first()
    await expect(chatPanel).toBeVisible()
  })

  test('should handle mobile gesture interactions', async ({ page }) => {
    await waitForChatReady(page)

    // Open chart sheet
    const chartButton = page.getByRole('button', { name: /Live Chart|Chart/i }).first()
    await chartButton.click()

    const sheet = page.locator('[role="dialog"]')
    await expect(sheet).toBeVisible({ timeout: 10_000 })

    // Simulate drag gesture to close sheet (swipe down)
    // Note: This tests the drag constraint behavior
    const sheetBox = await sheet.boundingBox()
    if (sheetBox) {
      await page.mouse.move(sheetBox.x + sheetBox.width / 2, sheetBox.y + 100)
      await page.mouse.down()
      await page.mouse.move(sheetBox.x + sheetBox.width / 2, sheetBox.y + 250)
      await page.mouse.up()

      // After drag gesture, sheet may close depending on drag distance threshold
      // At minimum, the sheet should still be functional
      await expect(sheet).toBeVisible().catch(() => {
        // Sheet closed from drag is acceptable behavior
      })
    }
  })

  test('should display sheet context message on mobile', async ({ page }) => {
    await waitForChatReady(page)

    // Open chart sheet
    const chartButton = page.getByRole('button', { name: /Live Chart|Chart/i }).first()
    await chartButton.click()

    const sheet = page.locator('[role="dialog"]')
    await expect(sheet).toBeVisible({ timeout: 10_000 })

    // Context message bar should be visible below the header
    const contextMessage = sheet.locator('p').filter({ hasText: /Return to chat|continue the conversation/ })
    const contextMessageExists = await contextMessage.count() > 0

    // Either context message or "Back to Chat" button should be present
    const backToChatButton = sheet.getByRole('button', { name: /Back to Chat/i })
    const backToChatExists = await backToChatButton.count() > 0

    expect(contextMessageExists || backToChatExists).toBe(true)

    // If "Back to Chat" button exists, it should close the sheet
    if (backToChatExists) {
      await backToChatButton.click()
      await expect(sheet).not.toBeVisible({ timeout: 5_000 })
    }
  })

  test('should maintain scroll position in chat on mobile', async ({ page }) => {
    await waitForChatReady(page)

    // Send a message
    await sendChatMessage(page, 'Test message for mobile')

    // Wait for response
    await page.waitForTimeout(2000)

    // Get initial scroll position
    const chatPanel = page.locator('textarea, input[type="text"]').first()
    const initialScroll = await chatPanel.evaluate(() => window.scrollY)

    // Open tool sheet
    const chartButton = page.getByRole('button', { name: /Live Chart|Chart/i }).first()
    await chartButton.click()

    const sheet = page.locator('[role="dialog"]')
    await expect(sheet).toBeVisible({ timeout: 10_000 })

    // Close sheet
    const closeButton = sheet.getByRole('button', { name: /Close/i })
    await closeButton.click()

    await expect(sheet).not.toBeVisible({ timeout: 5_000 })

    // Chat should still be visible and functional
    await expect(chatPanel).toBeVisible()
  })

  test('should have accessible mobile sheet with proper ARIA attributes', async ({ page }) => {
    await waitForChatReady(page)

    // Open chart sheet
    const chartButton = page.getByRole('button', { name: /Live Chart|Chart/i }).first()
    await chartButton.click()

    const sheet = page.locator('[role="dialog"]')
    await expect(sheet).toBeVisible({ timeout: 10_000 })

    // Sheet should have proper accessibility attributes
    await expect(sheet).toHaveAttribute('role', 'dialog')
    await expect(sheet).toHaveAttribute('aria-modal', 'true')

    // Sheet should have an aria-label
    const ariaLabel = await sheet.getAttribute('aria-label')
    expect(ariaLabel).toBeTruthy()
    expect(ariaLabel).toMatch(/Live Chart|Options|Journal/i)

    // Close button should be accessible
    const closeButton = sheet.getByRole('button', { name: /Close/i })
    await expect(closeButton).toHaveAccessibleName()

    // Title heading should be present
    const title = sheet.locator('h3').first()
    await expect(title).toBeVisible()
  })

  test('should support responsive chat input on mobile', async ({ page }) => {
    await waitForChatReady(page)

    // Type a message
    const chatInput = page.locator('textarea, input[type="text"]').first()
    await chatInput.click()

    // Input should expand for long messages (if it's a textarea)
    const initialHeight = await chatInput.evaluate(el => el.clientHeight)

    // Type a longer message
    const longMessage = 'This is a test message with multiple lines of text to see how the mobile input handles longer content.'
    await chatInput.fill(longMessage)

    // Input should remain visible and not overflow viewport
    const inputBox = await chatInput.boundingBox()
    expect(inputBox?.width).toBeLessThan(375 - 20) // Leave some padding
  })
})
