import { test, expect } from '@playwright/test'
import { authenticateAsE2EBypassMember } from '../../helpers/member-auth'
import {
  e2eBackendUrl,
  getAICoachAuthHeaders,
  isAICoachLiveMode,
} from '../../helpers/ai-coach-live'

const AI_COACH_URL = '/members/ai-coach'

test.describe('AI Coach — Live Workflow (Backend Integrated)', () => {
  test.skip(!isAICoachLiveMode, 'Set E2E_AI_COACH_MODE=live to run backend-integrated AI Coach workflow checks')

  test('scanner -> tracked management -> brief using live backend', async ({ page, request }) => {
    const authHeaders = getAICoachAuthHeaders()
    const sourceOpportunityId = `e2e-live-workflow-${Date.now()}`
    let trackedSetupId: string | null = null

    try {
      await page.addInitScript(() => {
        localStorage.setItem('ai-coach-onboarding-complete', 'true')
      })
      await authenticateAsE2EBypassMember(page)

      const healthResponse = await request.get(`${e2eBackendUrl}/health/detailed`)
      if (!healthResponse.ok()) {
        test.skip(true, `Live backend not healthy at ${e2eBackendUrl}`)
      }
      const healthPayload = await healthResponse.json().catch(() => null)
      if (healthPayload?.services?.database === false) {
        test.skip(true, 'Live backend database/service-role prerequisites are not ready for workflow E2E')
      }

      const watchlistResponse = await request.get(`${e2eBackendUrl}/api/watchlist`, { headers: authHeaders })
      if (watchlistResponse.status() !== 200) {
        const payload = await watchlistResponse.json().catch(() => ({}))
        const reason = typeof payload?.message === 'string'
          ? payload.message
          : `status ${watchlistResponse.status()}`
        test.skip(true, `Live auth bypass preflight failed: ${reason}`)
      }
      expect(watchlistResponse.status()).toBe(200)

      const createTrackedResponse = await request.post(`${e2eBackendUrl}/api/tracked-setups`, {
        headers: authHeaders,
        data: {
          source_opportunity_id: sourceOpportunityId,
          symbol: 'SPX',
          setup_type: 'gamma_squeeze',
          direction: 'bullish',
          opportunity_data: {
            score: 74,
            suggestedTrade: {
              entry: 5200,
              stopLoss: 5180,
              target: 5235,
              strikes: [5200, 5225],
              expiry: '2026-02-20',
            },
          },
          notes: 'Live workflow seed',
        },
      })
      expect([200, 201]).toContain(createTrackedResponse.status())
      const createTrackedPayload = await createTrackedResponse.json()
      trackedSetupId = (createTrackedPayload?.trackedSetup?.id as string) || null
      expect(typeof trackedSetupId).toBe('string')

      await page.goto(AI_COACH_URL)
      await page.waitForLoadState('networkidle')
      await expect(page.getByText('AI Coach Center').first()).toBeVisible()

      await page.getByRole('button', { name: 'Scanner' }).first().click()
      await expect(page.getByText('Opportunity Scanner')).toBeVisible()

      const scanResponsePromise = page.waitForResponse((response) => (
        response.url().includes('/api/scanner/scan') && response.request().method() === 'GET'
      ))
      await page.getByRole('button', { name: 'Scan Now' }).click()
      const scanResponse = await scanResponsePromise
      expect(scanResponse.status()).toBe(200)
      await expect(page.getByText('Failed to scan for opportunities. Please try again.')).toHaveCount(0)

      await page.getByRole('button', { name: 'Tracked' }).first().click()
      await expect(page.getByText('Tracked Setups')).toBeVisible()
      await expect(page.getByText('SPX').first()).toBeVisible({ timeout: 15000 })

      await page.getByRole('button', { name: 'Mark Triggered' }).first().click()
      await page.getByRole('button', { name: 'Triggered' }).click()
      await expect(page.getByText('SPX').first()).toBeVisible({ timeout: 10000 })

      const briefResponsePromise = page.waitForResponse((response) => (
        response.url().includes('/api/brief/today') && response.request().method() === 'GET'
      ))
      await page.getByRole('button', { name: 'Brief' }).first().click()
      const briefResponse = await briefResponsePromise
      expect(briefResponse.status()).toBe(200)
      await expect(page.getByText('Morning Brief')).toBeVisible()
      await expect(page.getByText('Watchlist').first()).toBeVisible()
    } finally {
      if (trackedSetupId) {
        await request.delete(`${e2eBackendUrl}/api/tracked-setups/${trackedSetupId}`, {
          headers: authHeaders,
        })
      }
    }
  })
})
