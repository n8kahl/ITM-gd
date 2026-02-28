import { expect, test, type Page } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'
import { getContractOrderedTradeStreamSnapshot, readTradeStreamSnapshotFixture } from './helpers/spx-trade-stream-contract'

async function openTradeStreamPage(page: Page) {
  await authenticateAsMember(page)
  await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })
}

async function openTradeStreamPageWithSnapshot(
  page: Page,
  snapshot: Record<string, unknown>,
) {
  await setupSPXCommandCenterMocks(page, { tradeStreamFixtureId: 'expectedOrdered' })
  await page.route('**/api/spx/trade-stream', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(snapshot),
    })
  })
  await page.addInitScript(() => {
    ;(window as Window & { __spxExpertTradeStreamEnabled?: boolean }).__spxExpertTradeStreamEnabled = true
  })
  await openTradeStreamPage(page)
}

async function transitionPrimaryCtaToStageTrade(page: Page) {
  const primaryCta = page.getByTestId('spx-action-primary-cta-desktop')
  await expect(primaryCta).toBeVisible()
  const currentLabel = ((await primaryCta.textContent()) || '').trim().toLowerCase()
  if (currentLabel.includes('select best setup')) {
    await primaryCta.click()
  }
  await expect(primaryCta).toContainText(/stage trade/i)
}

test.describe('SPX Expert Trade Stream panel selectors', () => {
  test('does not render trade stream panel when feature flag is off', async ({ page }) => {
    await setupSPXCommandCenterMocks(page, { tradeStreamFixtureId: 'expectedOrdered' })
    await page.addInitScript(() => {
      ;(window as Window & { __spxExpertTradeStreamEnabled?: boolean }).__spxExpertTradeStreamEnabled = false
    })
    await openTradeStreamPage(page)

    await expect(page.getByTestId('spx-trade-stream')).toHaveCount(0)
    await expect(page.getByTestId('spx-now-focus')).toHaveCount(0)
  })

  test('renders now-focus, lifecycle groups, dynamic row selectors, and row expansion when feature flag is on', async ({ page }) => {
    const snapshot = getContractOrderedTradeStreamSnapshot(readTradeStreamSnapshotFixture('expectedOrdered'))
    const firstItem = snapshot.items[0]
    expect(firstItem).toBeTruthy()

    await setupSPXCommandCenterMocks(page, { tradeStreamFixtureId: 'expectedOrdered' })
    await page.addInitScript(() => {
      ;(window as Window & { __spxExpertTradeStreamEnabled?: boolean }).__spxExpertTradeStreamEnabled = true
    })
    await openTradeStreamPage(page)

    await expect(page.getByTestId('spx-trade-stream')).toBeVisible()
    await expect(page.getByTestId('spx-now-focus')).toBeVisible()
    await expect(page.getByTestId('spx-now-focus-lifecycle')).toBeVisible()
    await expect(page.getByTestId('spx-now-focus-action')).toBeVisible()

    await expect(page.getByTestId('spx-trade-stream-lifecycle-forming')).toBeVisible()
    await expect(page.getByTestId('spx-trade-stream-lifecycle-triggered')).toBeVisible()
    await expect(page.getByTestId('spx-trade-stream-lifecycle-past')).toBeVisible()
    await expect(page.getByTestId('spx-trade-stream-row')).toHaveCount(snapshot.items.length)
    await expect(page.getByTestId('spx-legacy-setup-list')).toHaveCount(0)

    const firstRow = page.getByTestId(`spx-trade-stream-row-${firstItem?.stableIdHash || ''}`)
    await expect(firstRow).toBeVisible()
    await expect(firstRow.getByTestId('spx-trade-stream-row-expanded')).toHaveCount(0)
    await firstRow.getByTestId('spx-trade-stream-row-details-toggle').click()
    await expect(firstRow.getByTestId('spx-trade-stream-row-expanded')).toBeVisible()
  })

  test('falls back to legacy setup list when trade stream is empty', async ({ page }) => {
    await setupSPXCommandCenterMocks(page, { tradeStreamFixtureId: 'empty' })
    await page.addInitScript(() => {
      ;(window as Window & { __spxExpertTradeStreamEnabled?: boolean }).__spxExpertTradeStreamEnabled = true
    })
    await openTradeStreamPage(page)

    await expect(page.getByTestId('spx-trade-stream')).toHaveCount(0)
    await expect(page.getByTestId('spx-legacy-setup-list')).toBeVisible()
  })

  test('recommended STAGE pathway is suppressed in row and delegated to desktop primary CTA', async ({ page }) => {
    const snapshot = getContractOrderedTradeStreamSnapshot(readTradeStreamSnapshotFixture('expectedOrdered'))
    const seedItem = snapshot.items[0]
    expect(seedItem).toBeTruthy()

    const stageSnapshot = {
      ...snapshot,
      items: [
        {
          ...seedItem,
          id: 'setup-1',
          stableIdHash: 'setup-1',
          lifecycleState: 'triggered' as const,
          status: 'ready',
          direction: 'bullish' as const,
          setupType: 'fade_at_wall' as const,
          entryZone: { low: 6028, high: 6030 },
          stop: 6024,
          target1: 6038,
          target2: 6044,
          recommendedAction: 'STAGE' as const,
          actionBlockedReason: null,
        },
      ],
      nowFocusItemId: 'setup-1',
      countsByLifecycle: {
        forming: 0,
        triggered: 1,
        past: 0,
      },
    }

    await setupSPXCommandCenterMocks(page, { tradeStreamFixtureId: 'expectedOrdered' })
    await page.route('**/api/spx/broker/tradier/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          broker: 'tradier',
          credential: {
            configured: true,
            isActive: true,
            sandbox: true,
            autoExecute: false,
          },
          latestPortfolioSnapshot: null,
          runtime: {
            execution: {
              enabled: true,
              reason: null,
              sandboxDefault: true,
              metadataRequired: false,
              trackedTrades: 0,
            },
            portfolioSync: {
              enabled: true,
              reason: null,
            },
          },
        }),
      })
    })
    await page.route('**/api/spx/trade-stream', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(stageSnapshot),
      })
    })
    await page.addInitScript(() => {
      ;(window as Window & { __spxExpertTradeStreamEnabled?: boolean }).__spxExpertTradeStreamEnabled = true
    })
    await openTradeStreamPage(page)
    const stageRow = page.getByTestId('spx-trade-stream-row-setup-1')
    await expect(stageRow).toBeVisible()
    await expect(stageRow.getByTestId('spx-trade-stream-row-action')).toHaveCount(0)
    await expect(stageRow.getByTestId('spx-trade-stream-row-stage-via-primary-cta')).toBeVisible()

    await transitionPrimaryCtaToStageTrade(page)
    await page.getByTestId('spx-action-primary-cta-desktop').click()
    await expect(page.getByText(/in trade ·/i).first()).toBeVisible()
  })

  test('enforces strict lifecycle row order (forming -> triggered -> past) even with unordered payload', async ({ page }) => {
    await setupSPXCommandCenterMocks(page, {
      tradeStreamFixtureId: 'unordered',
      disableTradeStreamOrdering: true,
    })
    await page.addInitScript(() => {
      ;(window as Window & { __spxExpertTradeStreamEnabled?: boolean }).__spxExpertTradeStreamEnabled = true
    })
    await openTradeStreamPage(page)

    await expect(page.getByTestId('spx-trade-stream')).toBeVisible()
    const lifecycleTexts = await page.getByTestId('spx-trade-stream-row-lifecycle').allTextContents()
    expect(lifecycleTexts.map((value) => value.trim().toLowerCase())).toEqual([
      'forming',
      'forming',
      'triggered',
      'triggered',
      'past',
      'past',
    ])
  })

  test('falls back to first row for now-focus when nowFocusItemId is missing', async ({ page }) => {
    const snapshot = getContractOrderedTradeStreamSnapshot(readTradeStreamSnapshotFixture('expectedOrdered'))
    const fallbackItem = snapshot.items[2]
    expect(fallbackItem).toBeTruthy()
    if (!fallbackItem) return

    const fallbackSnapshot = {
      ...snapshot,
      items: [
        fallbackItem,
        ...snapshot.items.filter((item) => item.id !== fallbackItem.id),
      ],
      nowFocusItemId: null,
    }

    await openTradeStreamPageWithSnapshot(page, fallbackSnapshot)
    await expect(page.getByTestId('spx-trade-stream')).toBeVisible()
    await expect(page.getByTestId('spx-now-focus-lifecycle')).toHaveText(fallbackItem.lifecycleState)
    await expect(page.getByTestId('spx-now-focus-action')).toHaveText(fallbackItem.recommendedAction)
  })

  test('falls back to first row for now-focus when nowFocusItemId is unmatched', async ({ page }) => {
    const snapshot = getContractOrderedTradeStreamSnapshot(readTradeStreamSnapshotFixture('expectedOrdered'))
    const fallbackItem = snapshot.items[3]
    expect(fallbackItem).toBeTruthy()
    if (!fallbackItem) return

    const fallbackSnapshot = {
      ...snapshot,
      items: [
        fallbackItem,
        ...snapshot.items.filter((item) => item.id !== fallbackItem.id),
      ],
      nowFocusItemId: 'non-existent-now-focus-id',
    }

    await openTradeStreamPageWithSnapshot(page, fallbackSnapshot)
    await expect(page.getByTestId('spx-trade-stream')).toBeVisible()
    await expect(page.getByTestId('spx-now-focus-lifecycle')).toHaveText(fallbackItem.lifecycleState)
    await expect(page.getByTestId('spx-now-focus-action')).toHaveText(fallbackItem.recommendedAction)
  })
})
