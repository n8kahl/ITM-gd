import { BrowserContext, Page } from '@playwright/test'

/**
 * Authenticate as admin for E2E by enabling middleware bypass headers.
 */
export async function authenticateAsAdmin(context: BrowserContext): Promise<void> {
  await context.setExtraHTTPHeaders({ 'x-e2e-bypass-auth': '1' })
}

/**
 * Clear admin authentication
 */
export async function clearAdminAuth(context: BrowserContext): Promise<void> {
  await context.setExtraHTTPHeaders({})
  await context.clearCookies()
}

/**
 * Verify that a route requires admin authentication
 * Returns true if the page redirects away from the admin route
 */
export async function verifyAdminProtection(page: Page, url: string): Promise<boolean> {
  await page.goto(url)
  // Without bypass/auth, admin routes should redirect away.
  return !page.url().includes('/admin')
}
