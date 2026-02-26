import { expect, test } from '@playwright/test'
import {
  createMockEntry,
  enableMemberBypass,
  setupJournalAnalyticsMocks,
  setupJournalCrudMocks,
  setupMemberShellMocks,
} from './journal-test-helpers'

const JOURNAL_URL = '/members/journal?e2eBypassAuth=1'
const JOURNAL_ANALYTICS_URL = '/members/journal/analytics?e2eBypassAuth=1'

test.describe('JournalSubNav Component', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableMemberBypass(page)
    await setupMemberShellMocks(page)
  })

  test('renders Entries and Analytics tabs on journal page', async ({ page }) => {
    await setupJournalCrudMocks(page, [])

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    const entriesLink = page.getByRole('link', { name: 'Entries' })
    const analyticsLink = page.getByRole('link', { name: 'Analytics' })

    await expect(entriesLink).toBeVisible()
    await expect(analyticsLink).toBeVisible()
  })

  test('navigates to analytics from entries', async ({ page }) => {
    await setupJournalCrudMocks(page, [])
    await setupJournalAnalyticsMocks(page)

    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    const analyticsLink = page.getByRole('link', { name: 'Analytics' })
    await expect(analyticsLink).toBeVisible()
    await analyticsLink.click()

    await page.waitForURL(/\/members\/journal\/analytics/)
    await expect(page).toHaveURL(/\/members\/journal\/analytics/)
    await expect(page.getByRole('heading', { name: 'Journal Analytics' })).toBeVisible()
  })

  test('navigates back to entries from analytics', async ({ page }) => {
    await setupJournalCrudMocks(page, [])
    await setupJournalAnalyticsMocks(page)

    await page.goto(JOURNAL_ANALYTICS_URL, { waitUntil: 'domcontentloaded' })

    const entriesLink = page.getByRole('link', { name: 'Entries' })
    await expect(entriesLink).toBeVisible()
    await entriesLink.click()

    await page.waitForURL(/\/members\/journal$/)
    await expect(page).toHaveURL(/\/members\/journal$/)
    await expect(page.getByRole('heading', { name: 'Trade Journal' })).toBeVisible()
  })

  test('highlights active tab correctly', async ({ page }) => {
    await setupJournalCrudMocks(page, [])
    await setupJournalAnalyticsMocks(page)

    // Test Entries tab is active on journal page
    await page.goto(JOURNAL_URL, { waitUntil: 'domcontentloaded' })

    const entriesLink = page.getByRole('link', { name: 'Entries' })
    await expect(entriesLink).toHaveAttribute(/aria-current|data-active|class.*active/)

    // Test Analytics tab is active on analytics page
    await page.goto(JOURNAL_ANALYTICS_URL, { waitUntil: 'domcontentloaded' })

    const analyticsLink = page.getByRole('link', { name: 'Analytics' })
    await expect(analyticsLink).toHaveAttribute(/aria-current|data-active|class.*active/)
  })
})
