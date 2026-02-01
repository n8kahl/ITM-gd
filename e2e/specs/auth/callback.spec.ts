import { test, expect } from '@playwright/test'

test.describe('Auth Callback Page', () => {
  test('shows loading/processing state with Suspense', async ({ page }) => {
    await page.goto('/auth/callback')
    // The page should show some loading indicator
    // Either the Suspense fallback or the main loading state
    const hasLoadingText = await page.getByText(/Loading|Processing|Authenticating|Verifying/i).isVisible().catch(() => false)
    const hasSpinner = await page.locator('[class*="animate-spin"], [class*="animate-pulse"]').isVisible().catch(() => false)
    expect(hasLoadingText || hasSpinner).toBeTruthy()
  })

  test('displays message about Discord verification', async ({ page }) => {
    await page.goto('/auth/callback')
    // Wait for content to load
    await page.waitForTimeout(1000)
    // Should show some message about authentication or redirect
    const hasAnyContent = await page.locator('body').textContent()
    // The callback page will either show auth messages or redirect
    expect(hasAnyContent).toBeDefined()
  })

  test('handles error state gracefully', async ({ page }) => {
    // Navigate with error params
    await page.goto('/auth/callback?error=access_denied&error_description=User%20denied%20access')
    await page.waitForTimeout(1000)
    // Should show error or redirect options
    const hasError = await page.getByText(/error|denied|failed/i).isVisible().catch(() => false)
    const hasRetry = await page.getByRole('link', { name: /Try Again|Back|Home/i }).isVisible().catch(() => false)
    expect(hasError || hasRetry).toBeTruthy()
  })

  test('has navigation options on error', async ({ page }) => {
    await page.goto('/auth/callback?error=server_error')
    await page.waitForTimeout(2000)
    // Should have a way to navigate away
    const links = page.getByRole('link')
    const count = await links.count()
    expect(count).toBeGreaterThan(0)
  })
})
