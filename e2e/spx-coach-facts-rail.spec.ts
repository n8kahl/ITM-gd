import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'

test.describe('SPX Coach Facts Rail selectors', () => {
  test('keeps legacy AI coach feed when coach facts mode is disabled', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await page.addInitScript(() => {
      ;(window as Window & { __spxCoachFactsModeEnabled?: boolean }).__spxCoachFactsModeEnabled = false
    })
    await authenticateAsMember(page)

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('spx-ai-coach-feed')).toBeVisible()
    await expect(page.getByTestId('spx-coach-facts-rail')).toHaveCount(0)
  })

  test('renders coach facts rail selectors and details disclosure when enabled', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await page.addInitScript(() => {
      ;(window as Window & { __spxCoachFactsModeEnabled?: boolean }).__spxCoachFactsModeEnabled = true
    })
    await authenticateAsMember(page)

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('spx-ai-coach-feed')).toHaveCount(0)
    await expect(page.getByTestId('spx-coach-facts-rail')).toBeVisible()
    await expect(page.getByTestId('spx-coach-dock-desktop')).toHaveCount(0)
    await expect(page.getByTestId('spx-coach-dock-toggle-desktop')).toHaveCount(0)
    await expect(page.getByTestId('spx-coach-facts-verdict')).toBeVisible()
    await expect(page.getByTestId('spx-coach-facts-confidence')).toBeVisible()
    await expect(page.getByTestId('spx-coach-facts-invalidation')).toBeVisible()
    await expect(page.getByTestId('spx-coach-facts-risk-constraint')).toBeVisible()
    await expect(page.getByTestId('spx-coach-facts-next-review')).toBeVisible()
    await expect(page.getByTestId('spx-coach-facts-actions')).toBeVisible()
    await expect(page.getByTestId('spx-coach-facts-actions-empty')).toHaveCount(0)
    expect(await page.locator('[data-testid^="spx-coach-facts-action-"]').count()).toBeLessThanOrEqual(2)

    await expect(page.getByTestId('spx-coach-facts-details')).toHaveCount(0)
    await expect(page.getByTestId('spx-coach-facts-details-history')).toHaveCount(0)
    await expect(page.getByTestId('spx-coach-facts-details-timeline')).toHaveCount(0)
    await expect(page.getByTestId('spx-coach-facts-details-composer')).toHaveCount(0)
    await expect(page.getByTestId('spx-coach-facts-details-input')).toHaveCount(0)
    await expect(page.getByTestId('spx-coach-facts-details-send')).toHaveCount(0)
    await page.getByTestId('spx-coach-facts-details-toggle').click()
    await expect(page.getByTestId('spx-coach-facts-details')).toBeVisible()
    await expect(page.getByTestId('spx-coach-facts-details')).toContainText('Why')
    await expect(page.getByTestId('spx-coach-facts-details')).toContainText('Counter-Case')
    await expect(page.getByTestId('spx-coach-facts-details')).toContainText('Risk Checklist')
    await expect(page.getByTestId('spx-coach-facts-details')).toContainText('History')
    await expect(page.getByTestId('spx-coach-facts-details-history')).toBeVisible()
    await expect(page.getByTestId('spx-coach-facts-details-timeline')).toBeVisible()
    await expect(page.getByTestId('spx-coach-facts-details-composer')).toBeVisible()
    await expect(page.getByTestId('spx-coach-facts-details-input')).toBeVisible()
    await expect(page.getByTestId('spx-coach-facts-details-send')).toBeVisible()
    await page.getByTestId('spx-coach-facts-details-toggle').click()
    await expect(page.getByTestId('spx-coach-facts-details')).toHaveCount(0)
    await expect(page.getByTestId('spx-coach-facts-details-history')).toHaveCount(0)
    await expect(page.getByTestId('spx-coach-facts-details-timeline')).toHaveCount(0)
    await expect(page.getByTestId('spx-coach-facts-details-composer')).toHaveCount(0)
  })

  test('renders deterministic fallback facts when decision payload is unavailable', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await page.route('**/api/spx/coach/decision', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Injected coach decision failure for fallback coverage' }),
      })
    })
    await page.addInitScript(() => {
      ;(window as Window & { __spxCoachFactsModeEnabled?: boolean }).__spxCoachFactsModeEnabled = true
    })
    await authenticateAsMember(page)

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('spx-coach-facts-rail')).toBeVisible()
    await expect(page.getByTestId('spx-coach-facts-verdict')).toContainText('WAIT')
    await expect(page.getByTestId('spx-coach-facts-details')).toHaveCount(0)
    await page.getByTestId('spx-coach-facts-details-toggle').click()
    await expect(page.getByTestId('spx-coach-facts-details')).toBeVisible()
    await expect(page.getByTestId('spx-coach-facts-details')).toContainText('Decision payload unavailable')
    await expect(page.getByTestId('spx-coach-facts-details')).toContainText('Decision source: fallback.')
  })

  test('sends coach message from details composer when details are expanded', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await page.addInitScript(() => {
      ;(window as Window & { __spxCoachFactsModeEnabled?: boolean }).__spxCoachFactsModeEnabled = true
    })
    await authenticateAsMember(page)

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('spx-coach-facts-rail')).toBeVisible()
    await page.getByTestId('spx-coach-facts-details-toggle').click()
    await expect(page.getByTestId('spx-coach-facts-details-composer')).toBeVisible()

    const prompt = 'Details composer follow-up for test coverage.'
    await page.getByTestId('spx-coach-facts-details-input').fill(prompt)

    const [request] = await Promise.all([
      page.waitForRequest((candidate) => (
        candidate.url().includes('/api/spx/coach/message')
        && candidate.method() === 'POST'
      )),
      page.getByTestId('spx-coach-facts-details-send').click(),
    ])

    const payload = request.postDataJSON() as { prompt?: string; setupId?: string }
    expect(payload.prompt).toContain(prompt)
  })

  test('filters invalid-context facts actions and renders empty action state', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await page.route('**/api/spx/setups*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          setups: [
            {
              id: 'setup-forming',
              type: 'fade_at_wall',
              direction: 'bullish',
              entryZone: { low: 6028, high: 6030 },
              stop: 6024,
              target1: { price: 6038, label: 'Target 1' },
              target2: { price: 6044, label: 'Target 2' },
              confluenceScore: 3,
              confluenceSources: ['level_quality', 'gex_alignment', 'flow_confirmation'],
              clusterZone: {
                id: 'cluster-forming',
                priceLow: 6028,
                priceHigh: 6030,
                clusterScore: 3.8,
                type: 'defended',
                sources: [{ source: 'spx_call_wall', category: 'options', price: 6030, instrument: 'SPX' }],
                testCount: 1,
                lastTestAt: '2026-02-15T15:00:00.000Z',
                held: true,
                holdRate: 62,
              },
              regime: 'ranging',
              status: 'forming',
              probability: 61,
              recommendedContract: null,
              createdAt: '2026-02-15T15:05:00.000Z',
              triggeredAt: null,
            },
          ],
          count: 1,
          generatedAt: '2026-02-15T15:12:00.000Z',
        }),
      })
    })
    await page.route('**/api/spx/coach/decision', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          decisionId: 'coach-decision-invalid-context',
          setupId: 'setup-forming',
          verdict: 'WAIT',
          confidence: 63,
          primaryText: 'Wait for a clean trigger before entering.',
          why: ['Setup is still forming and not actionable.'],
          riskPlan: {
            stop: 6024,
            maxRiskDollars: 250,
            positionGuidance: 'Stay flat until confirmation.',
          },
          actions: [
            {
              id: 'ENTER_TRADE_FOCUS',
              label: 'Enter Trade Focus',
              style: 'primary',
              payload: { setupId: 'setup-forming' },
            },
          ],
          severity: 'routine',
          freshness: {
            generatedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            stale: false,
          },
          contextHash: 'sha256:e2e-invalid-context',
          source: 'fallback_v1',
        }),
      })
    })
    await page.addInitScript(() => {
      ;(window as Window & { __spxCoachFactsModeEnabled?: boolean }).__spxCoachFactsModeEnabled = true
    })
    await authenticateAsMember(page)

    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    await expect(page.getByTestId('spx-coach-facts-rail')).toBeVisible()
    await expect(page.getByTestId('spx-coach-facts-actions')).toBeVisible()
    await expect(page.locator('[data-testid^="spx-coach-facts-action-"]')).toHaveCount(0)
    await expect(page.getByTestId('spx-coach-facts-actions-empty')).toBeVisible()
  })
})
