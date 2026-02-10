import { test, expect } from '@playwright/test'

test.describe('Login Page', () => {
  test('displays login page with Discord button', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /Welcome Back/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Log in with Discord/i })).toBeVisible()
  })

  test('shows Discord server requirement notice', async ({ page }) => {
    await page.goto('/login')
    // Verify the requirement notice from commit 7cf13e6
    await expect(page.getByText(/Must be a member of the TradeITM Discord Server/i)).toBeVisible()
  })

  test('shows feature benefits list', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText(/Your Discord roles will sync automatically/i)).toBeVisible()
    await expect(page.getByText(/Access courses based on your membership tier/i)).toBeVisible()
    await expect(page.getByText(/Track your trading journal and progress/i)).toBeVisible()
  })

  test('has back to home link', async ({ page }) => {
    await page.goto('/login')
    const backLink = page.getByRole('link', { name: /Back to Home/i })
    await expect(backLink).toBeVisible()
    await backLink.click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('has link to pricing/membership plans', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('link', { name: /View Membership Plans/i })).toBeVisible()
  })

  test('loads successfully with Suspense boundary', async ({ page }) => {
    await page.goto('/login')
    // After Suspense resolves, the main content should appear
    await expect(page.getByRole('button', { name: /Log in with Discord/i })).toBeVisible({ timeout: 5000 })
  })

  test('handles redirect parameter in URL', async ({ page }) => {
    await page.goto('/login?redirect=/members/library')
    // The page should load successfully with the redirect param
    await expect(page.getByRole('button', { name: /Log in with Discord/i })).toBeVisible()
  })

  test('displays error from OAuth callback', async ({ page }) => {
    await page.goto('/login?error_description=User%20cancelled%20login')
    await expect(page.getByText(/Authentication Failed/i)).toBeVisible()
    await expect(page.getByText(/User cancelled login/i)).toBeVisible()
  })

  test('has terms and privacy policy links', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('link', { name: /Terms of Service/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Privacy Policy/i })).toBeVisible()
  })

  test('shows Discord icon in login button', async ({ page }) => {
    await page.goto('/login')
    const loginButton = page.getByRole('button', { name: /Log in with Discord/i })
    await expect(loginButton).toBeVisible()
    // Button should contain an SVG (Discord icon)
    await expect(loginButton.locator('svg')).toBeVisible()
  })

  test('shows TradeITM branding/logo', async ({ page }) => {
    await page.goto('/login')
    // Should have the sparkles icon in the logo area
    await expect(page.locator('.rounded-2xl').first()).toBeVisible()
  })
})
