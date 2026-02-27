import { expect, test } from '@playwright/test'
import {
  createMockEntry,
  createMockAIAnalysis,
  enableMemberBypass,
  setupMemberShellMocks,
  setupJournalCrudMocks,
  setupJournalAnalyticsMocks,
  setupJournalGradeMock,
  setupJournalGradeMockError,
} from './journal-test-helpers'

const JOURNAL_URL = '/members/journal?e2eBypassAuth=1'

test.describe('Journal AI Grade Display', () => {
  test.describe.configure({ mode: 'serial' })
  test.setTimeout(60_000)

  test.beforeEach(async ({ page }) => {
    await enableMemberBypass(page)
    await setupMemberShellMocks(page)
  })

  test('displays AI grade badge on graded entry detail', async ({ page }) => {
    // Setup: Create entry with AI analysis (grade B)
    const gradeB = createMockAIAnalysis('B')
    const gradedEntry = createMockEntry({
      symbol: 'SPY',
      direction: 'long',
      contract_type: 'stock',
      entry_price: 500,
      exit_price: 505,
      position_size: 1,
      ai_analysis: gradeB,
    })

    await setupJournalCrudMocks(page, [gradedEntry])
    await setupJournalAnalyticsMocks(page)

    // Navigate to journal
    await page.goto(JOURNAL_URL)

    // Click on entry to open detail sheet
    const entryCard = page.getByLabel('Open SPY trade details')
    await entryCard.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('AI Trade Grade')).toBeVisible()
    await expect(dialog.locator('span').filter({ hasText: /^B$/ }).first()).toBeVisible()
    await expect(dialog.getByText(/Analyzed on/i)).toBeVisible()
  })

  test('expands and collapses grade details', async ({ page }) => {
    // Setup: Create entry with graded AI analysis
    const gradeA = createMockAIAnalysis('A')
    const gradedEntry = createMockEntry({
      symbol: 'AAPL',
      direction: 'long',
      contract_type: 'stock',
      entry_price: 150,
      exit_price: 155,
      position_size: 1,
      ai_analysis: gradeA,
    })

    await setupJournalCrudMocks(page, [gradedEntry])
    await setupJournalAnalyticsMocks(page)

    // Navigate to journal
    await page.goto(JOURNAL_URL)

    // Click on entry to open detail sheet
    const entryCard = page.getByLabel('Open AAPL trade details')
    await entryCard.click()

    // Click expand button (aria-label "Expand details")
    const expandButton = page.locator('button[aria-label="Expand details"]')
    await expandButton.click()

    // Verify details are visible
    const dialog = page.getByRole('dialog')
    const entryQuality = dialog.getByText('Entry Quality', { exact: true })
    const exitQuality = dialog.getByText('Exit Quality', { exact: true })
    const riskManagement = dialog.getByText('Risk Management', { exact: true })

    await expect(entryQuality).toBeVisible()
    await expect(exitQuality).toBeVisible()
    await expect(riskManagement).toBeVisible()

    // Click collapse button (aria-label "Collapse details")
    const collapseButton = page.locator('button[aria-label="Collapse details"]')
    await collapseButton.click()

    // Verify details are hidden
    await expect(entryQuality).toBeHidden()
    await expect(exitQuality).toBeHidden()
    await expect(riskManagement).toBeHidden()
  })

  test('shows Grade Trade button for ungraded entry', async ({ page }) => {
    // Setup: Create entry WITHOUT ai_analysis
    const ungradedEntry = createMockEntry({
      symbol: 'TSLA',
      direction: 'short',
      contract_type: 'stock',
      entry_price: 250,
      exit_price: 245,
      position_size: 1,
      ai_analysis: null,
    })

    await setupJournalCrudMocks(page, [ungradedEntry])
    await setupJournalAnalyticsMocks(page)

    // Navigate to journal
    await page.goto(JOURNAL_URL)

    // Click on entry to open detail sheet
    const entryCard = page.getByLabel('Open TSLA trade details')
    await entryCard.click()

    // Verify "Grade Trade" button is visible and enabled
    const gradeButton = page.getByRole('dialog').getByRole('button', { name: 'Grade Trade' })
    await expect(gradeButton).toBeVisible()
    await expect(gradeButton).toBeEnabled()
  })

  test('grades trade successfully and updates display', async ({ page }) => {
    // Setup: Create ungraded entry
    const ungradedEntry = createMockEntry({
      symbol: 'QQQ',
      direction: 'long',
      contract_type: 'stock',
      entry_price: 300,
      exit_price: 310,
      position_size: 1,
      ai_analysis: null,
    })

    const state = await setupJournalCrudMocks(page, [ungradedEntry])
    const mockAnalysis = createMockAIAnalysis('B')
    await setupJournalGradeMock(page, mockAnalysis)
    await setupJournalAnalyticsMocks(page)

    // Navigate to journal
    await page.goto(JOURNAL_URL)

    // Click on entry to open detail sheet
    const entryCard = page.getByLabel('Open QQQ trade details')
    await entryCard.click()

    // Click "Grade Trade" button
    const gradeButton = page.getByRole('dialog').getByRole('button', { name: 'Grade Trade' })
    await gradeButton.click()

    // Wait for grade response and verify grade UI appears
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('AI Trade Grade')).toBeVisible({ timeout: 10_000 })
    await expect(dialog.locator('span').filter({ hasText: /^B$/ }).first()).toBeVisible()
  })

  test('uses ai_analysis payload from grade API and exits missing-grade state', async ({ page }) => {
    const ungradedEntry = createMockEntry({
      symbol: 'IWM',
      direction: 'long',
      contract_type: 'stock',
      entry_price: 200,
      exit_price: 203,
      position_size: 1,
      ai_analysis: null,
    })

    await setupJournalCrudMocks(page, [ungradedEntry])
    await setupJournalAnalyticsMocks(page)

    await page.route('**/api/members/journal/grade', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback()
        return
      }

      const analysis = createMockAIAnalysis('A')
      const body = route.request().postDataJSON() as { entryIds?: string[] }
      const entryId = Array.isArray(body.entryIds) ? body.entryIds[0] : 'entry-ai-analysis-only'

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: entryId,
              ai_analysis: analysis,
            },
          ],
        }),
      })
    })

    await page.goto(JOURNAL_URL)
    await page.getByLabel('Open IWM trade details').click()

    const dialog = page.getByRole('dialog')
    const gradeButton = dialog.getByRole('button', { name: 'Grade Trade' })
    await expect(gradeButton).toBeVisible()
    await gradeButton.click()

    await expect(dialog.getByText('AI Trade Grade')).toBeVisible({ timeout: 10_000 })
    await expect(dialog.locator('span').filter({ hasText: /^A$/ }).first()).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Grade Trade' })).toHaveCount(0)
    const gradedButton = dialog.getByRole('button', { name: 'Graded' })
    await expect(gradedButton).toBeVisible()
    await expect(gradedButton).toBeDisabled()
  })

  test('handles grade API error gracefully', async ({ page }) => {
    // Setup: Create ungraded entry with error mock
    const ungradedEntry = createMockEntry({
      symbol: 'SPY',
      direction: 'long',
      contract_type: 'stock',
      entry_price: 500,
      exit_price: 502,
      position_size: 1,
      ai_analysis: null,
    })

    await setupJournalCrudMocks(page, [ungradedEntry])
    await setupJournalGradeMockError(page)
    await setupJournalAnalyticsMocks(page)

    // Navigate to journal
    await page.goto(JOURNAL_URL)

    // Click on entry to open detail sheet
    const entryCard = page.getByLabel('Open SPY trade details')
    await entryCard.click()

    // Click "Grade Trade" button
    const gradeButton = page.getByRole('dialog').getByRole('button', { name: 'Grade Trade' })
    await gradeButton.click()

    // Verify button returns to enabled state (not stuck in loading) and no grade UI is shown.
    await expect(gradeButton).toBeEnabled({ timeout: 10_000 })
    await expect(page.getByRole('dialog').getByText('AI Trade Grade')).toHaveCount(0)
    await expect(gradeButton).toHaveText('Grade Trade')
  })
})
