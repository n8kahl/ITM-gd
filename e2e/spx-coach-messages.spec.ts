import { expect, test, type Locator, type Page } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { coachLongMessage, setupSPXCommandCenterMocks } from './helpers/spx-mocks'

test.describe('SPX coach messages', () => {
  async function sendCoachPrompt(page: Page, coachFeed: Locator, prompt: string) {
    const input = coachFeed.getByRole('textbox')
    await input.fill(prompt)
    await Promise.all([
      page.waitForResponse((response) => (
        response.url().includes('/api/spx/coach/message')
        && response.request().method() === 'POST'
      )),
      coachFeed.getByRole('button', { name: 'Send coach message' }).click(),
    ])
  }

  test('streams coach output with priority styling and expandable content', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    const coachFeed = page.getByTestId('spx-ai-coach-feed')
    const input = coachFeed.getByRole('textbox')
    await expect(input).toBeVisible()

    await sendCoachPrompt(page, coachFeed, 'How should I manage this setup?')
    await coachFeed.getByRole('button', { name: 'All' }).click()

    const firstSentence = coachLongMessage.split('.')[0]
    await expect(coachFeed.getByText(firstSentence, { exact: false }).first()).toBeVisible()
    const streamedCard = coachFeed.locator('article').filter({ hasText: firstSentence }).first()

    const alertTag = page.getByText('alert').first()
    await expect(alertTag).toBeVisible()

    const expandButton = streamedCard.getByRole('button', { name: 'Expand' }).first()
    await expect(expandButton).toBeVisible()

    await expandButton.click({ force: true })
    await expect(streamedCard.getByRole('button', { name: 'Collapse' })).toBeVisible()
    await expect(streamedCard.getByText('If flow diverges for more than two prints', { exact: false })).toBeVisible()
  })

  test('action chips trigger scoped follow-up coach requests', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    const coachFeed = page.getByTestId('spx-ai-coach-feed')
    await sendCoachPrompt(page, coachFeed, 'Validate this trade idea.')

    const actionChip = coachFeed.getByRole('button', { name: 'Hold / Wait' }).first()
    await expect(actionChip).toBeVisible()

    const [followUpRequest] = await Promise.all([
      page.waitForRequest((request) => {
        if (!request.url().includes('/api/spx/coach/message')) return false
        if (request.method() !== 'POST') return false
        const rawBody = request.postData()
        if (!rawBody) return false
        try {
          const payload = JSON.parse(rawBody) as { prompt?: string }
          return payload.prompt?.includes('Apply this action now: Hold / Wait') ?? false
        } catch {
          return false
        }
      }),
      actionChip.click(),
    ])

    const payload = followUpRequest.postDataJSON() as { prompt?: string; setupId?: string }
    expect(payload.prompt).toContain('Apply this action now: Hold / Wait')
    expect(payload.setupId).toMatch(/^setup-/)
  })

  test('shows jump-to-latest pill when new messages arrive while scrolled up', async ({ page }) => {
    await setupSPXCommandCenterMocks(page)
    await authenticateAsMember(page)
    await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })

    const coachFeed = page.getByTestId('spx-ai-coach-feed')
    const timeline = coachFeed.getByTestId('spx-ai-coach-timeline')

    let hasOverflow = false
    for (let index = 0; index < 8; index += 1) {
      await sendCoachPrompt(page, coachFeed, `Timeline overflow ping ${index + 1}`)
      hasOverflow = await timeline.evaluate((node) => node.scrollHeight > node.clientHeight)
      if (hasOverflow) break
    }
    expect(hasOverflow).toBe(true)

    await timeline.evaluate((node) => {
      node.scrollTop = 0
      node.dispatchEvent(new Event('scroll'))
    })

    await sendCoachPrompt(page, coachFeed, 'Trigger jump to latest while scrolled away.')

    const jumpToLatest = coachFeed.getByTestId('spx-ai-coach-jump-latest')
    await expect(jumpToLatest).toBeVisible()
    await jumpToLatest.click()
    await expect(jumpToLatest).toHaveCount(0)
  })
})
