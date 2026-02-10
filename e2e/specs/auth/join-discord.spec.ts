import { test, expect } from '@playwright/test'

test.use({
  extraHTTPHeaders: {
    'x-e2e-bypass-auth': '1',
  },
})

test.describe('Join Discord Page', () => {
  test('displays membership required page correctly', async ({ page }) => {
    await page.goto('/join-discord')
    await expect(page.getByRole('heading', { name: /Active Membership Required/i })).toBeVisible()
    await expect(page.getByText(/could not verify your access/i)).toBeVisible()
  })

  test('shows access denied warning copy', async ({ page }) => {
    await page.goto('/join-discord')
    await expect(page.getByText(/Access Denied/i)).toBeVisible()
    await expect(page.getByText(/does not have an active TradeITM membership role/i)).toBeVisible()
  })

  test('has membership plans call-to-action link', async ({ page }) => {
    await page.goto('/join-discord')
    const plansLink = page.getByRole('link', { name: /View Membership Plans/i })
    await expect(plansLink).toBeVisible()
    await expect(plansLink).toHaveAttribute('href', /#pricing/)
  })

  test('has refresh access button', async ({ page }) => {
    await page.goto('/join-discord')
    await expect(page.getByRole('button', { name: /Refresh Access/i })).toBeVisible()
  })

  test('has sign out option', async ({ page }) => {
    await page.goto('/join-discord')
    await expect(page.getByRole('button', { name: /Sign out and go back/i })).toBeVisible()
  })

  test('has contact support link', async ({ page }) => {
    await page.goto('/join-discord')
    const supportLink = page.getByRole('link', { name: /Contact Support/i })
    await expect(supportLink).toBeVisible()
    await expect(supportLink).toHaveAttribute('href', /mailto:support@tradeitm\.com/)
  })

  test('has back to home link', async ({ page }) => {
    await page.goto('/join-discord')
    const backLink = page.getByRole('link', { name: /Back to Home/i })
    await expect(backLink).toBeVisible()
    await backLink.click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('renders iconography', async ({ page }) => {
    await page.goto('/join-discord')
    await expect(page.locator('main svg').first()).toBeVisible()
  })
})
