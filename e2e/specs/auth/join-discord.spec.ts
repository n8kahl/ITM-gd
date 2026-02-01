import { test, expect } from '@playwright/test'

test.describe('Join Discord Page', () => {
  test('displays join Discord page correctly', async ({ page }) => {
    await page.goto('/join-discord')
    await expect(page.getByRole('heading', { name: /Join.*Discord/i })).toBeVisible()
  })

  test('shows warning about not being a server member', async ({ page }) => {
    await page.goto('/join-discord')
    await expect(page.getByText(/must be a member of the TradeITM Discord/i)).toBeVisible()
  })

  test('has join Discord button', async ({ page }) => {
    await page.goto('/join-discord')
    const joinButton = page.getByRole('link', { name: /Join.*Discord/i })
    await expect(joinButton).toBeVisible()
  })

  test('join button opens in new tab', async ({ page }) => {
    await page.goto('/join-discord')
    const joinButton = page.getByRole('link', { name: /Join.*Discord/i })
    await expect(joinButton).toHaveAttribute('target', '_blank')
  })

  test('join button has correct Discord invite link', async ({ page }) => {
    await page.goto('/join-discord')
    const joinButton = page.getByRole('link', { name: /Join.*Discord/i })
    const href = await joinButton.getAttribute('href')
    expect(href).toContain('discord')
  })

  test('displays steps to get access', async ({ page }) => {
    await page.goto('/join-discord')
    // Should show numbered steps or instructions
    await expect(page.getByText(/step|Click|join|accept|return/i).first()).toBeVisible()
  })

  test('has try again button', async ({ page }) => {
    await page.goto('/join-discord')
    await expect(page.getByRole('button', { name: /Try Again/i })).toBeVisible()
  })

  test('has sign out option', async ({ page }) => {
    await page.goto('/join-discord')
    await expect(page.getByRole('button', { name: /Sign out|Log out/i })).toBeVisible()
  })

  test('has contact support link', async ({ page }) => {
    await page.goto('/join-discord')
    await expect(page.getByRole('link', { name: /Contact|Support/i })).toBeVisible()
  })

  test('has back to home link', async ({ page }) => {
    await page.goto('/join-discord')
    const backLink = page.getByRole('link', { name: /Back to Home/i })
    await expect(backLink).toBeVisible()
    await backLink.click()
    await expect(page).toHaveURL('/')
  })

  test('shows Discord icon or branding', async ({ page }) => {
    await page.goto('/join-discord')
    // Page should have Discord-related iconography
    const svgElements = page.locator('svg')
    const count = await svgElements.count()
    expect(count).toBeGreaterThan(0)
  })
})
