import { BrowserContext, Page } from '@playwright/test'

/**
 * Authenticate as admin by setting the titm_admin cookie
 */
export async function authenticateAsAdmin(context: BrowserContext): Promise<void> {
  await context.addCookies([
    {
      name: 'titm_admin',
      value: 'true',
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ])
}

/**
 * Clear admin authentication
 */
export async function clearAdminAuth(context: BrowserContext): Promise<void> {
  await context.clearCookies()
}

/**
 * Verify that a route requires admin authentication
 * Returns true if the page redirects away from the admin route
 */
export async function verifyAdminProtection(page: Page, url: string): Promise<boolean> {
  await page.goto(url)
  // Without admin cookie, should redirect to home
  return page.url().includes('/') && !page.url().includes('/admin')
}
