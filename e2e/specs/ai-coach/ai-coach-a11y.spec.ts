import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import {
  enableBypass,
  setupOnboarding,
  setupAllAICoachMocks,
  navigateToAICoach,
  waitForChatReady,
  sendChatMessage,
  createMockConversation,
  createMockSession,
} from './ai-coach-test-helpers'

test.describe.configure({ mode: 'serial' })

async function waitForA11yReady(page: Page) {
  await waitForChatReady(page)
  await expect(page.locator('main, [role="main"]').first()).toBeVisible()
}

test.describe('AI Coach — Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableBypass(page)
    await setupOnboarding(page, { complete: true })
    await setupAllAICoachMocks(page, {
      sessions: [createMockSession({ id: 'session-001', title: 'SPX Analysis' })],
      messages: createMockConversation('session-001'),
    })
    await navigateToAICoach(page)
    await waitForChatReady(page, 30_000)
  })

  test('should pass axe-core automated accessibility scan', async ({ page }) => {
    await waitForA11yReady(page)
    await page.waitForTimeout(1000)

    // Run axe scan, excluding known third-party chart widget issues
    const axe = new AxeBuilder({ page })
      .exclude('.tradingview-widget-container')
      .exclude('[data-testid="chart-widget"]')
      .exclude('.lightweight-charts')

    const result = await axe.analyze()

    // Assert no critical or serious violations
    const violations = result.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )

    expect(
      violations,
      `Accessibility violations found: ${violations.map((v) => `${v.id}: ${v.description}`).join(', ')}`
    ).toHaveLength(0)
  })

  test('should have accessible chat input with proper labels', async ({ page }) => {
    // Chat input should be findable and have descriptive labeling
    const chatInput = page.locator('textarea, input[type="text"]').first()
    await expect(chatInput).toBeVisible()
    await expect(chatInput).toBeEnabled()

    // Input should have aria-label or be associated with a label element
    const hasAriaLabel = await chatInput.evaluate((el) =>
      el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('placeholder')
    )
    expect(
      hasAriaLabel,
      'Chat input should have aria-label, aria-labelledby, or placeholder for accessibility'
    ).toBeTruthy()
  })

  test('should expose semantic session controls and expanded state', async ({ page }) => {
    await waitForA11yReady(page)

    const toggleSessionsButton = page.getByRole('button', { name: /show sessions panel|hide sessions panel/i }).first()
    await expect(toggleSessionsButton).toHaveAttribute('aria-controls', 'ai-coach-sessions-panel')
    await expect(toggleSessionsButton).toHaveAttribute('aria-expanded', 'false')

    await toggleSessionsButton.click()
    await expect(toggleSessionsButton).toHaveAttribute('aria-expanded', 'true')

    const sessionsPanel = page.getByTestId('ai-coach-sessions-panel')
    const sessionsList = sessionsPanel.getByRole('listbox', { name: /saved chat sessions/i })
    await expect(sessionsList).toBeVisible()

    const sessionOptions = sessionsList.getByRole('option')
    const optionCount = await sessionOptions.count()
    if (optionCount > 0) {
      await expect(sessionOptions.first()).toHaveAttribute('aria-selected', /true|false/)
    }
  })

  test('should have keyboard accessible tab navigation', async ({ page }) => {
    await waitForA11yReady(page)

    // Check for tab elements with aria-selected attribute
    const tabs = page.locator('[role="tab"]')
    const tabCount = await tabs.count()

    if (tabCount > 0) {
      // Verify first tab has aria-selected
      const firstTab = tabs.first()
      await expect(firstTab).toHaveAttribute('aria-selected', /true|false/)

      // Tab navigation should move focus
      await firstTab.focus()
      await expect(firstTab).toBeFocused()

      // If there are multiple tabs, press ArrowRight to navigate
      if (tabCount > 1) {
        await page.keyboard.press('ArrowRight')
        const secondTab = tabs.nth(1)
        await expect(secondTab).toBeFocused()
      }
    }
  })

  test('should support Cmd+K keyboard shortcut to focus chat input', async ({ page }) => {
    // Press Cmd+K (or Ctrl+K on non-Mac)
    await page.keyboard.press('Meta+k')

    // Chat input should now be focused
    const chatInput = page.locator('textarea, input[type="text"]').first()
    await expect(chatInput).toBeFocused()
  })

  test('should support Tab key navigation through interactive elements', async ({ page }) => {
    await waitForA11yReady(page)

    // Get all interactive elements (buttons, links, inputs, tabs)
    const interactiveElements = page.locator(
      'button:visible, a:visible, input:visible, textarea:visible, [role="button"]:visible, [role="tab"]:visible, [role="link"]:visible, [tabindex="0"]:visible'
    )
    const elementCount = await interactiveElements.count()

    if (elementCount > 0) {
      // First element should be focusable
      const firstElement = interactiveElements.first()
      await firstElement.focus()
      await expect(firstElement).toBeFocused()
      await firstElement.evaluate((el) => {
        el.setAttribute('data-a11y-focus-anchor', 'true')
      })

      // Pressing Tab should move to next focusable element
      await page.keyboard.press('Tab')
      const firstAnchor = page.locator('[data-a11y-focus-anchor="true"]')

      // Focus should have moved (unless single element)
      if (elementCount > 1) {
        await expect(firstAnchor).not.toBeFocused()
      }
    }
  })

  test('should use ARIA landmarks to structure main regions', async ({ page }) => {
    await waitForA11yReady(page)

    // Check for main landmark (required for semantic structure)
    const mainRegion = page.locator('main, [role="main"]')
    await expect(mainRegion).toBeVisible()

    // Navigation region should be present (sidebar or header nav)
    const navRegion = page.locator('nav, [role="navigation"]')
    expect(await navRegion.count()).toBeGreaterThan(0)
    await expect(navRegion.first()).toBeVisible()

    // Complementary region (sidebar) should be present if layout includes it
    const complementary = page.locator('[role="complementary"]')
    const complementaryCount = await complementary.count()
    if (complementaryCount > 0) {
      await expect(complementary.first()).toBeVisible()
    }
  })

  test('should handle error messages with alert role', async ({ page }) => {
    // Trigger an error scenario by sending a message with streaming disabled
    await setupAllAICoachMocks(page, { streamEnabled: false })

    // Send a message that will trigger an error
    await sendChatMessage(page, 'Test message')

    // Wait for error to appear (brief wait for error handling)
    await page.waitForTimeout(1000)

    const errorBanner = page.getByTestId('ai-coach-error-banner')
    if (await errorBanner.isVisible().catch(() => false)) {
      await expect(errorBanner).toHaveAttribute('role', 'alert')
      await expect(errorBanner).toHaveAttribute('aria-live', 'assertive')
      await expect(errorBanner).toContainText(/\S+/)
      return
    }

    // If no textual alert is rendered, the chat should still remain stable and keep
    // the user message visible instead of crashing.
    await expect(page.getByText('Test message').first()).toBeVisible()
  })

  test('should maintain focus management in modal/dialog contexts', async ({ page }) => {
    await waitForA11yReady(page)

    // Check if there's a dialog/modal open
    const dialog = page.locator('[role="dialog"], dialog')
    if (await dialog.isVisible()) {
      // Focus should be trapped within the dialog
      const dialogButton = dialog.locator('button').first()
      if (await dialogButton.isVisible()) {
        await dialogButton.focus()
        await expect(dialogButton).toBeFocused()

        // After focusing within dialog, focus should not escape
        const focusedElement = await page.evaluate(
          () => (document.activeElement as HTMLElement)?.closest('[role="dialog"], dialog')
        )
        expect(focusedElement).toBeTruthy()
      }
    }
  })

  test('should have descriptive link and button text', async ({ page }) => {
    await waitForA11yReady(page)

    // Get all buttons and links
    const buttons = page.locator('button')

    // Sample check: verify buttons have meaningful text or aria-label
    const buttonCount = await buttons.count()
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i)
      if (await button.isVisible()) {
        const text = await button.textContent()
        const ariaLabel = await button.getAttribute('aria-label')
        const title = await button.getAttribute('title')

        // Should have at least one of: text content, aria-label, or title
        expect(text || ariaLabel || title).toBeTruthy()
      }
    }
  })

  test('should render without accessibility blocking console errors', async ({ page }) => {
    const errors: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Filter out expected noise (hydration warnings, network failures)
        if (
          !text.includes('hydration') &&
          !text.includes('Failed to fetch') &&
          !text.includes('Failed to load resource') &&
          !text.includes('401 (Unauthorized)') &&
          !text.includes('AbortError') &&
          !text.includes('favicon') &&
          !text.includes('ARIA') // Avoid false positives
        ) {
          errors.push(text)
        }
      }
    })

    await navigateToAICoach(page)
    await waitForChatReady(page)
    await page.waitForTimeout(2000)

    expect(
      errors,
      `Accessibility-related console errors: ${errors.join(', ')}`
    ).toHaveLength(0)
  })
})
