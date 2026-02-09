import { test, expect } from '@playwright/test'
import { authenticateAsE2EBypassMember } from '../../helpers/member-auth'
import {
  e2eBackendUrl,
  getAICoachAuthHeaders,
  isAICoachLiveMode,
  requireAICoachLiveReadiness,
} from '../../helpers/ai-coach-live'

const AI_COACH_URL = '/members/ai-coach'

test.describe('AI Coach — Live Workflow (Backend Integrated)', () => {
  test.skip(!isAICoachLiveMode, 'Set E2E_AI_COACH_MODE=live to run backend-integrated AI Coach workflow checks')

  test('scanner -> tracked management -> brief using live backend', async ({ page, request }) => {
    test.setTimeout(90000)

    const authHeaders = getAICoachAuthHeaders()
    const liveSetupNote = `E2E detector simulation ${Date.now()}`
    let trackedSetupId: string | null = null

    try {
      await page.addInitScript(() => {
        localStorage.setItem('ai-coach-onboarding-complete', 'true')
      })
      await authenticateAsE2EBypassMember(page)

      const healthResponse = await request.get(`${e2eBackendUrl}/health/detailed`)
      if (requireAICoachLiveReadiness) {
        expect(healthResponse.ok()).toBe(true)
      } else if (!healthResponse.ok()) {
        test.skip(true, `Live backend not healthy at ${e2eBackendUrl}`)
      }
      const healthPayload = await healthResponse.json().catch(() => null)
      if (requireAICoachLiveReadiness) {
        expect(healthPayload?.services?.database).not.toBe(false)
      } else if (healthPayload?.services?.database === false) {
        test.skip(true, 'Live backend database/service-role prerequisites are not ready for workflow E2E')
      }

      const watchlistResponse = await request.get(`${e2eBackendUrl}/api/watchlist`, { headers: authHeaders })
      if (requireAICoachLiveReadiness) {
        expect(watchlistResponse.status()).toBe(200)
      } else if (watchlistResponse.status() !== 200) {
        const payload = await watchlistResponse.json().catch(() => ({}))
        const reason = typeof payload?.message === 'string'
          ? payload.message
          : `status ${watchlistResponse.status()}`
        test.skip(true, `Live auth bypass preflight failed: ${reason}`)
      }
      expect(watchlistResponse.status()).toBe(200)

      await page.goto(AI_COACH_URL)
      await page.waitForLoadState('networkidle')
      await expect(page.getByText('AI Coach Center').first()).toBeVisible()

      await page.getByRole('button', { name: 'Scanner' }).first().click()
      await expect(page.getByText('Opportunity Scanner')).toBeVisible()

      const scanResponsePromise = page.waitForResponse((response) => (
        response.url().includes('/api/scanner/scan') && response.request().method() === 'GET'
      ), { timeout: 20000 }).catch(() => null)
      await page.getByRole('button', { name: 'Scan Now' }).click()
      const scanResponse = await scanResponsePromise
      if (scanResponse) {
        expect(scanResponse.status()).toBe(200)
      }
      await expect(page.getByText('Failed to scan for opportunities. Please try again.')).toHaveCount(0)

      await page.getByRole('button', { name: 'Tracked' }).first().click()
      await expect(page.getByText('Tracked Setups')).toBeVisible()
      const simulateDetectionResponse = await request.post(`${e2eBackendUrl}/api/tracked-setups/e2e/simulate-detected`, {
        headers: authHeaders,
        data: {
          symbol: 'SPX',
          setup_type: 'gamma_squeeze',
          direction: 'bullish',
          confidence: 79,
          notes: liveSetupNote,
        },
      })
      expect(simulateDetectionResponse.status()).toBe(201)
      const simulateDetectionPayload = await simulateDetectionResponse.json()
      trackedSetupId = (simulateDetectionPayload?.trackedSetup?.id as string) || null
      expect(typeof trackedSetupId).toBe('string')

      const markTriggeredResponse = await request.patch(`${e2eBackendUrl}/api/tracked-setups/${trackedSetupId}`, {
        headers: authHeaders,
        data: { status: 'triggered' },
      })
      expect(markTriggeredResponse.status()).toBe(200)

      await page.getByRole('button', { name: 'Triggered', exact: true }).click()
      await expect(page.getByText('Failed to load tracked setups')).toHaveCount(0)

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
