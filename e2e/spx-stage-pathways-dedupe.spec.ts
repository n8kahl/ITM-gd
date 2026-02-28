import { expect, test, type Page } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'
import { getContractOrderedTradeStreamSnapshot, readTradeStreamSnapshotFixture } from './helpers/spx-trade-stream-contract'

async function transitionPrimaryCtaToStageTrade(page: Page) {
  const primaryCta = page.getByTestId('spx-action-primary-cta-desktop')
  await expect(primaryCta).toBeVisible()
  const currentLabel = ((await primaryCta.textContent()) || '').trim().toLowerCase()
  if (currentLabel.includes('select best setup')) {
    await primaryCta.click()
  }
  await expect(primaryCta).toContainText(/stage trade/i)
}

async function countActiveStagePathways(page: Page): Promise<number> {
  return page.evaluate(() => {
    const isVisible = (node: Element): boolean => {
      const element = node as HTMLElement
      const style = window.getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.opacity !== '0'
        && rect.width > 0
        && rect.height > 0
    }

    const isEnabled = (node: HTMLButtonElement): boolean => (
      !node.disabled && node.getAttribute('aria-disabled') !== 'true'
    )

    let count = 0
    const primaryCta = document.querySelector('[data-testid="spx-action-primary-cta-desktop"]')
    if (
      primaryCta instanceof HTMLButtonElement
      && isVisible(primaryCta)
      && isEnabled(primaryCta)
      && /stage trade|enter trade/i.test(primaryCta.textContent || '')
    ) {
      count += 1
    }

    for (const button of Array.from(document.querySelectorAll('button'))) {
      if (!(button instanceof HTMLButtonElement)) continue
      if (button === primaryCta) continue
      if (button.closest('[data-testid="spx-action-strip"]')) continue
      const label = (button.textContent || '').trim()
      if (!/^(stage trade|enter trade)$/i.test(label)) continue
      if (!isVisible(button) || !isEnabled(button)) continue
      count += 1
    }

    for (const node of Array.from(document.querySelectorAll('[data-testid="spx-trade-stream-row-action"]'))) {
      if (!(node instanceof HTMLButtonElement)) continue
      if (!isVisible(node) || !isEnabled(node)) continue
      if (!/stage/i.test(node.textContent || '')) continue
      count += 1
    }

    return count
  })
}

test.describe('SPX stage pathway dedupe', () => {
  test('keeps only one active stage pathway in legacy setup-list mode', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await page.addInitScript(() => {
      ;(window as Window & { __spxExpertTradeStreamEnabled?: boolean }).__spxExpertTradeStreamEnabled = false
    })
    await authenticateAsMember(page)

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('spx-legacy-setup-list')).toBeVisible()
    await expect(page.getByTestId('spx-trade-stream')).toHaveCount(0)

    await transitionPrimaryCtaToStageTrade(page)
    await expect.poll(() => countActiveStagePathways(page)).toBe(1)
  })

  test('keeps only one active stage pathway in trade-stream mode while stage row action is suppressed', async ({ page }) => {
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
    await authenticateAsMember(page)

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })
    const stageRow = page.getByTestId('spx-trade-stream-row-setup-1')
    await expect(stageRow).toBeVisible()
    await expect(stageRow.getByTestId('spx-trade-stream-row-action')).toHaveCount(0)
    await expect(stageRow.getByTestId('spx-trade-stream-row-stage-via-primary-cta')).toBeVisible()

    await transitionPrimaryCtaToStageTrade(page)
    await expect.poll(() => countActiveStagePathways(page)).toBe(1)
  })
})
