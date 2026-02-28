import { test, expect } from '@playwright/test'

import {
  enableTradeDayReplayBypass,
  setupTradeDayReplayApiMocks,
  setupTradeDayReplayShellMocks,
} from './trade-day-replay-test-helpers'

const TRADE_DAY_REPLAY_URL = '/members/trade-day-replay?e2eBypassAuth=1'
const SAMPLE_TRANSCRIPT = `
FancyITM — 8:43 AM
PREP SPX 6900C 02/27 @everyone
Filled AVG 3.60 @everyone
Trim 23% @everyone
Fully out of SPX @everyone
`

test.describe.configure({ mode: 'serial' })

test.describe('Trade Day Replay', () => {
  test.beforeEach(async ({ page }) => {
    await enableTradeDayReplayBypass(page)
    await setupTradeDayReplayShellMocks(page)
  })

  test('builds replay payload and renders replay analysis surfaces', async ({ page }) => {
    await setupTradeDayReplayApiMocks(page)

    await page.goto(TRADE_DAY_REPLAY_URL, { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: 'Trade Day Replay' })).toBeVisible()
    await expect(page.getByLabel('Transcript')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Build Replay' })).toBeVisible()

    await page.getByLabel('Transcript').fill(SAMPLE_TRANSCRIPT)
    await page.getByRole('button', { name: 'Build Replay' }).click()

    await expect(page.getByRole('button', { name: 'EMA 8' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'VWAP' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'PDH/PDL' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Opening Range' })).toBeVisible()
    await expect(page.getByTestId('replay-toolbar-legend')).toContainText('EMA 8')
    await expect(page.getByTestId('replay-toolbar-legend')).toContainText('Opening Range')
    await expect(page.getByTestId('replay-toolbar-legend')).toContainText('PDH')
    await expect(page.getByTestId('replay-toolbar-legend')).toContainText('PDL')
    await expect(page.getByText('Session Analysis')).toBeVisible()
    await expect(page.getByText('Trade Cards (2)')).toBeVisible()
    await expect(page.getByText('Replay Summary (JSON)')).toBeVisible()
    await expect(page.getByText('Session Grade')).toBeVisible()

    await page.getByTestId('trade-card-toggle-1').click()
    await expect(page.getByTestId('trade-card-sparkline-1')).toBeVisible()
    await expect(page.getByTestId('trade-card-sparkline-segment-1')).toBeVisible()
    await expect(page.getByTestId('trade-card-sparkline-entry-marker-1')).toBeVisible()
    await expect(page.getByTestId('trade-card-sparkline-exit-marker-1')).toBeVisible()
  })

  test('toggles level legend and disables PDH/PDL when prior day data is missing', async ({ page }) => {
    await setupTradeDayReplayApiMocks(page, { includePriorDayBar: false })

    await page.goto(TRADE_DAY_REPLAY_URL, { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Transcript').fill(SAMPLE_TRANSCRIPT)
    await page.getByRole('button', { name: 'Build Replay' }).click()

    const legend = page.getByTestId('replay-toolbar-legend')
    const pdhPdlToggle = page.getByRole('button', { name: 'PDH/PDL' })
    const openingRangeToggle = page.getByRole('button', { name: 'Opening Range' })

    await expect(pdhPdlToggle).toBeDisabled()
    await expect(legend).not.toContainText('PDH')
    await expect(legend).not.toContainText('PDL')
    await expect(legend).toContainText('Opening Range')

    await openingRangeToggle.click()
    await expect(legend).not.toContainText('Opening Range')
  })

  test('shows sparkline fallback when trade timestamps are invalid', async ({ page }) => {
    await setupTradeDayReplayApiMocks(page, { corruptSecondTradeTimestamps: true })

    await page.goto(TRADE_DAY_REPLAY_URL, { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Transcript').fill(SAMPLE_TRANSCRIPT)
    await page.getByRole('button', { name: 'Build Replay' }).click()

    await page.getByTestId('trade-card-toggle-1').click()
    await expect(page.getByTestId('trade-card-sparkline-1')).toBeVisible()

    await page.getByTestId('trade-card-toggle-2').click()
    await expect(page.getByTestId('trade-card-sparkline-fallback-2')).toBeVisible()
    await expect(page.getByTestId('trade-card-sparkline-2')).not.toBeVisible()
  })

  test('keeps replay layout stable on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await setupTradeDayReplayApiMocks(page)

    await page.goto(TRADE_DAY_REPLAY_URL, { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Transcript').fill(SAMPLE_TRANSCRIPT)
    await page.getByRole('button', { name: 'Build Replay' }).click()
    await expect(page.getByTestId('replay-toolbar')).toBeVisible()

    const hasHorizontalOverflow = await page.evaluate(() => (
      document.documentElement.scrollWidth > window.innerWidth + 1
    ))
    expect(hasHorizontalOverflow).toBe(false)
  })

  test('shows explicit backend-admin preflight message on health 403', async ({ page }) => {
    await setupTradeDayReplayApiMocks(page, { healthStatus: 403 })

    await page.goto(TRADE_DAY_REPLAY_URL, { waitUntil: 'domcontentloaded' })

    await expect(page.getByText('Backend admin access not configured')).toBeVisible()
    await expect(page.getByText('profiles.role = admin')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Build Replay' })).not.toBeVisible()
  })
})
