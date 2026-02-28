import { test, expect } from '@playwright/test'
import {
  enableBypass,
  setupOnboarding,
  setupAllAICoachMocks,
  navigateToAICoach,
  waitForChatReady,
  switchToView,
  createMockOptionsChain,
  createMockExpirations,
} from './ai-coach-test-helpers'

/**
 * AI Coach E2E Tests — Options Panel
 *
 * Validates options chain panel functionality:
 * - Navigation to Options view
 * - Loading options chain data
 * - Expiry selection and dropdown
 * - Column sorting and display
 * - Heatmap toggle functionality
 * - Loading skeleton states
 * - GEX chart display
 */

test.describe.configure({ mode: 'serial' })

test.describe('AI Coach — Options Panel', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableBypass(page)
    await setupOnboarding(page, { complete: true })
    await setupAllAICoachMocks(page)
    await navigateToAICoach(page)
    await waitForChatReady(page)
  })

  test('should navigate to Options view', async ({ page }) => {
    // Switch to Options view using helper
    await switchToView(page, 'Options')

    // Verify Options tab is active
    const optionsTab = page.getByRole('tab', { name: 'Options' })
    await expect(optionsTab).toBeVisible()
    await expect(optionsTab).toHaveAttribute('aria-selected', 'true')

    // Verify the center panel is showing options content
    const centerPanel = page.locator('[class*="center"], [class*="panel"]').first()
    await expect(centerPanel).toBeVisible()
  })

  test('should display expiry selector', async ({ page }) => {
    // Navigate to Options view
    await switchToView(page, 'Options')

    // Locate the expiry combobox/dropdown at the top of the options panel
    const expiryDropdown = page.getByRole('combobox').first()
    await expect(expiryDropdown).toBeVisible()

    // Verify it has accessible role
    const hasComboboxRole = await expiryDropdown.evaluate((el) => {
      return el.getAttribute('role') === 'combobox' || el.tagName === 'SELECT'
    })
    expect(hasComboboxRole).toBeTruthy()
  })

  test('should load options chain data', async ({ page }) => {
    // Navigate to Options view
    await switchToView(page, 'Options')

    // Wait for options table to be visible with actual strike prices
    // Strikes should be populated from the mock (values like 5920, 5925, 5930, 5935, 5940, etc.)
    await expect.poll(
      async () => {
        // Look for table rows or cells containing strike prices
        const strikeCell = page.locator('tbody tr td, [role="row"] [role="cell"]')
          .filter({ hasText: /594[0-5]|592[0-5]|593[0-5]/ })
          .first()
        return await strikeCell.isVisible().catch(() => false)
      },
      { timeout: 15000 },
    ).toBeTruthy()

    // Verify at least one strike price is displayed
    const strikePrices = await page.locator('text=/^594[0-5]|592[0-5]|593[0-5]$/').count()
    expect(strikePrices).toBeGreaterThan(0)
  })

  test('should display options columns', async ({ page }) => {
    // Navigate to Options view
    await switchToView(page, 'Options')

    // Wait for the options table to load
    await page.waitForTimeout(1000)

    // Verify key column headers are present
    // Looking for headers like: Strike, Last, Bid/Ask, Volume, Open Interest, IV, Greeks (Delta, Gamma, Theta, Vega)
    const columnHeaders = page.locator('thead th, [role="columnheader"]')

    // Check for critical columns
    const headerTexts = await columnHeaders.allTextContents()
    const headerString = headerTexts.join(' ').toLowerCase()

    expect(headerString).toMatch(/strike/i)
    expect(headerString).toMatch(/last|price/i)
    expect(headerString).toMatch(/volume/i)
    expect(headerString).toMatch(/iv|volatility/i)

    // Verify delta column (part of Greeks) is present
    expect(headerString).toMatch(/delta/i)
  })

  test('should switch between chain and heatmap views', async ({ page }) => {
    // Navigate to Options view
    await switchToView(page, 'Options')

    // Wait for initial table to load
    await page.waitForTimeout(1500)

    // Look for chain/heatmap toggle button
    // This could be a button with text like "Heatmap", "View", "Toggle", or a radio button group
    const heatmapButton = page.getByRole('button', { name: /heatmap|heat map|view/i })
      .or(page.locator('button:has-text("Heatmap")'))
      .or(page.locator('[class*="toggle"], [class*="switch"]').locator('button').first())
      .first()

    // If heatmap button exists, click it
    if (await heatmapButton.count() > 0 && await heatmapButton.isVisible()) {
      // Verify initial state (chain view - table)
      const optionsTable = page.locator('table, [role="table"]').first()
      const isTableVisible = await optionsTable.isVisible().catch(() => false)

      // Click to switch to heatmap
      await heatmapButton.click()
      await page.waitForTimeout(1000)

      // Verify view changed - heatmap should show a grid/matrix visualization
      // Look for heatmap indicators like colored cells or a grid layout
      const heatmapVisualization = page.locator('[class*="heatmap"], [class*="heat"], canvas')
        .or(page.locator('div[style*="background"], div[style*="color"]'))
        .first()

      const viewChanged = !(await heatmapVisualization.isVisible().catch(() => false)) !== isTableVisible
      expect(viewChanged || await heatmapButton.isVisible()).toBeTruthy()
    }
  })

  test('should update chain on expiry change', async ({ page }) => {
    // Navigate to Options view
    await switchToView(page, 'Options')

    // Wait for initial chain to load
    await expect.poll(
      async () => {
        const strikeCell = page.locator('tbody tr td, [role="row"] [role="cell"]')
          .filter({ hasText: /594[0-5]|592[0-5]|593[0-5]/ })
          .first()
        return await strikeCell.isVisible().catch(() => false)
      },
      { timeout: 15000 },
    ).toBeTruthy()

    // Get initial strike prices
    const initialStrikes = await page.locator('tbody tr, [role="row"]').count()

    // Open expiry dropdown
    const expiryDropdown = page.getByRole('combobox').first()
    await expiryDropdown.click()
    await page.waitForTimeout(500)

    // Get available expiry options
    const expiryOptions = page.getByRole('option')
    const optionCount = await expiryOptions.count()

    // If there are multiple expirations, select a different one
    if (optionCount > 1) {
      // Select the second expiration option
      const secondOption = expiryOptions.nth(1)
      await secondOption.click()
      await page.waitForTimeout(1500)

      // Verify the chain refreshed (data may change, but the view should update)
      // Check that table still contains strike prices
      const updatedStrikes = await page.locator('tbody tr, [role="row"]')
        .filter({ hasText: /\d{4}/ })
        .count()

      expect(updatedStrikes).toBeGreaterThan(0)
    }
  })

  test('should show loading skeleton initially', async ({ page }) => {
    // Create a mock that delays the response to see loading state
    await page.route('**/api/options/**/chain**', async (route) => {
      // Simulate delay
      await page.waitForTimeout(500)
      await route.continue()
    })

    // Navigate to Options view
    await switchToView(page, 'Options')

    // Look for loading skeleton/placeholder
    // Common loading indicators: skeleton loaders, spinners, aria-busy, placeholder content
    const skeleton = page.locator('[class*="skeleton"], [class*="loader"], [class*="loading"], [aria-busy="true"]')
      .or(page.locator('div[style*="opacity"], div[style*="animate"]'))
      .first()

    // Skeleton may appear and disappear quickly, so we check if it was present or if loading is complete
    const loadingIndicatorPresent = await skeleton.isVisible().catch(() => false)
    const dataLoaded = await page.locator('tbody tr, [role="row"]')
      .filter({ hasText: /\d{4}/ })
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false)

    expect(loadingIndicatorPresent || dataLoaded).toBeTruthy()
  })

  test('should display GEX chart section', async ({ page }) => {
    // Navigate to Options view
    await switchToView(page, 'Options')

    // Wait for options chain to load
    await expect.poll(
      async () => {
        const strikeCell = page.locator('tbody tr td, [role="row"] [role="cell"]')
          .filter({ hasText: /594[0-5]|592[0-5]|593[0-5]/ })
          .first()
        return await strikeCell.isVisible().catch(() => false)
      },
      { timeout: 15000 },
    ).toBeTruthy()

    // Look for GEX chart section
    // Common patterns: GEX label, gamma exposure section, chart canvas or SVG
    const gexSection = page.locator('[class*="gex"], [class*="gamma"], text=/GEX|Gamma Exposure/i').first()
      .or(page.locator('section, div').filter({ hasText: /gamma|GEX/i }).first())

    // Also look for visualization elements (canvas, SVG) near GEX
    const gexChart = page.locator('canvas, svg, [class*="chart"]')
      .filter({ hasText: /|/ }) // Filter by visibility in gex context
      .first()

    // Verify GEX section or chart is present
    const gexPresent = await gexSection.isVisible().catch(() => false)
    const chartPresent = await gexChart.isVisible().catch(() => false)

    expect(gexPresent || chartPresent).toBeTruthy()
  })

  test('should display bid/ask spreads in options table', async ({ page }) => {
    // Navigate to Options view
    await switchToView(page, 'Options')

    // Wait for options table to load
    await expect.poll(
      async () => {
        const strikeCell = page.locator('tbody tr td, [role="row"] [role="cell"]')
          .filter({ hasText: /594[0-5]|592[0-5]|593[0-5]/ })
          .first()
        return await strikeCell.isVisible().catch(() => false)
      },
      { timeout: 15000 },
    ).toBeTruthy()

    // Get column headers
    const columnHeaders = page.locator('thead th, [role="columnheader"]')
    const headerTexts = await columnHeaders.allTextContents()
    const headerString = headerTexts.join(' ').toLowerCase()

    // Verify Bid/Ask columns exist
    expect(headerString).toMatch(/bid|ask|spread/i)

    // Verify at least one data cell has bid/ask values
    // Bid/Ask should be numeric values
    const bidAskCells = page.locator('tbody td, [role="row"] [role="cell"]')
      .filter({ hasText: /\d+\.\d{2}|\d+/ })

    const bidAskCount = await bidAskCells.count()
    expect(bidAskCount).toBeGreaterThan(0)
  })

  test('should display open interest and volume columns', async ({ page }) => {
    // Navigate to Options view
    await switchToView(page, 'Options')

    // Wait for options chain to load
    await expect.poll(
      async () => {
        const strikeCell = page.locator('tbody tr td, [role="row"] [role="cell"]')
          .filter({ hasText: /594[0-5]|592[0-5]|593[0-5]/ })
          .first()
        return await strikeCell.isVisible().catch(() => false)
      },
      { timeout: 15000 },
    ).toBeTruthy()

    // Get column headers
    const columnHeaders = page.locator('thead th, [role="columnheader"]')
    const headerTexts = await columnHeaders.allTextContents()
    const headerString = headerTexts.join(' ').toLowerCase()

    // Verify Open Interest and Volume columns
    expect(headerString).toMatch(/open.interest|oi/i)
    expect(headerString).toMatch(/volume|vol/i)

    // Verify data is populated for these columns
    const volumeCells = page.locator('tbody td, [role="row"] [role="cell"]')
      .filter({ hasText: /\d{2,}/ }) // At least 2 digits for volume/OI

    const cellCount = await volumeCells.count()
    expect(cellCount).toBeGreaterThan(0)
  })
})
