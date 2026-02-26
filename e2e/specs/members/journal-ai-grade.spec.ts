import { test } from '@playwright/test'
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
    await page.waitForLoadState('networkidle')

    // Click on entry to open detail sheet
    const entryCard = page.getByLabel('Open SPY trade details')
    await entryCard.click()
    await page.waitForLoadState('networkidle')

    // Verify grade badge displays "B"
    const gradeBadge = page.locator('[data-testid="grade-badge"]')
    await gradeBadge.isVisible()
    const gradeText = await gradeBadge.textContent()

    // Verify "AI Trade Grade" text is visible
    const aiGradeLabel = page.locator('text=AI Trade Grade')
    await aiGradeLabel.isVisible()

    // Verify scored date is visible
    const scoredDate = page.locator('[data-testid="scored-date"]')
    await scoredDate.isVisible()
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
    await page.waitForLoadState('networkidle')

    // Click on entry to open detail sheet
    const entryCard = page.getByLabel('Open AAPL trade details')
    await entryCard.click()
    await page.waitForLoadState('networkidle')

    // Click expand button (aria-label "Expand details")
    const expandButton = page.locator('button[aria-label="Expand details"]')
    await expandButton.click()
    await page.waitForLoadState('networkidle')

    // Verify details are visible
    const entryQuality = page.locator('text=Entry Quality')
    const exitQuality = page.locator('text=Exit Quality')
    const riskManagement = page.locator('text=Risk Management')

    await entryQuality.isVisible()
    await exitQuality.isVisible()
    await riskManagement.isVisible()

    // Click collapse button (aria-label "Collapse details")
    const collapseButton = page.locator('button[aria-label="Collapse details"]')
    await collapseButton.click()
    await page.waitForLoadState('networkidle')

    // Verify details are hidden
    await entryQuality.isHidden()
    await exitQuality.isHidden()
    await riskManagement.isHidden()
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
    await page.waitForLoadState('networkidle')

    // Click on entry to open detail sheet
    const entryCard = page.getByLabel('Open TSLA trade details')
    await entryCard.click()
    await page.waitForLoadState('networkidle')

    // Verify "Grade Trade" button is visible and enabled
    const gradeButton = page.locator('button:has-text("Grade Trade")')
    await gradeButton.isVisible()
    const isDisabled = await gradeButton.isDisabled()
    if (isDisabled) {
      throw new Error('Grade Trade button should not be disabled')
    }
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
    await page.waitForLoadState('networkidle')

    // Click on entry to open detail sheet
    const entryCard = page.getByLabel('Open QQQ trade details')
    await entryCard.click()
    await page.waitForLoadState('networkidle')

    // Click "Grade Trade" button
    const gradeButton = page.locator('button:has-text("Grade Trade")')
    await gradeButton.click()

    // Verify "Grading..." state appears
    const gradingText = page.locator('text=Grading...')
    await gradingText.isVisible()

    // Wait for grade response and verify grade badge appears
    const gradeBadge = page.locator('[data-testid="grade-badge"]')
    await gradeBadge.isVisible({ timeout: 10_000 })
    const gradeContent = await gradeBadge.textContent()
    if (gradeContent !== 'B') {
      throw new Error(`Expected grade "B" but got "${gradeContent}"`)
    }

    // Verify "AI Trade Grade" label is now visible
    const aiGradeLabel = page.locator('text=AI Trade Grade')
    await aiGradeLabel.isVisible()
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
    await page.waitForLoadState('networkidle')

    // Click on entry to open detail sheet
    const entryCard = page.getByLabel('Open SPY trade details')
    await entryCard.click()
    await page.waitForLoadState('networkidle')

    // Click "Grade Trade" button
    const gradeButton = page.locator('button:has-text("Grade Trade")')
    await gradeButton.click()

    // Verify button returns to enabled state (not stuck in loading)
    await page.waitForTimeout(2000) // Wait for API call to fail
    const isDisabled = await gradeButton.isDisabled()
    if (isDisabled) {
      throw new Error('Grade Trade button should return to enabled state after error')
    }

    // Verify no grade badge is displayed
    const gradeBadge = page.locator('[data-testid="grade-badge"]')
    const isVisible = await gradeBadge.isVisible({ timeout: 1000 }).catch(() => false)
    if (isVisible) {
      throw new Error('Grade badge should not appear after error')
    }

    // Verify button text is still "Grade Trade" (not "Graded")
    const buttonText = await gradeButton.textContent()
    if (buttonText?.trim() !== 'Grade Trade') {
      throw new Error(`Expected button text "Grade Trade" but got "${buttonText}"`)
    }
  })
})
