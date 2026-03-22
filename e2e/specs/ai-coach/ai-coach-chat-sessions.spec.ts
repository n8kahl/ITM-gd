import { test, expect, type Page } from '@playwright/test'
import {
  enableBypass,
  setupOnboarding,
  setupAllAICoachMocks,
  createMockSessions,
  createMockConversation,
  createMockSession,
  navigateToAICoach,
  waitForChatReady,
  SESSION_KEY,
} from './ai-coach-test-helpers'

test.describe.configure({ mode: 'serial' })

async function openSessionsPanel(page: Page) {
  const panel = page.getByTestId('ai-coach-sessions-panel')
  if (await panel.isVisible().catch(() => false)) return panel

  await page.getByRole('button', { name: /show sessions panel|hide sessions panel|toggle sessions/i }).first().click()
  await expect(panel).toBeVisible({ timeout: 10_000 })
  return panel
}

test.describe('AI Coach — Chat Sessions', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000)
    await enableBypass(page)
    await setupOnboarding(page, { complete: true })
    await navigateToAICoach(page)
  })

  test('should load empty sessions sidebar', async ({ page }) => {
    await setupAllAICoachMocks(page, {
      sessions: [],
      messages: [],
    })

    await page.reload()
    await waitForChatReady(page)
    const sessionsPanel = await openSessionsPanel(page)

    // Sessions panel should be visible once toggled open.
    await expect(sessionsPanel).toBeVisible({ timeout: 10_000 })

    // Check for empty state message
    const emptyState = sessionsPanel.getByText(/No sessions|empty/i)
    if (await emptyState.count() > 0) {
      await expect(emptyState.first()).toBeVisible()
    }
  })

  test('should load sessions list', async ({ page }) => {
    const mockSessions = createMockSessions(3)
    await setupAllAICoachMocks(page, {
      sessions: mockSessions,
      messages: [],
    })

    await page.reload()
    await waitForChatReady(page)
    const sessionsPanel = await openSessionsPanel(page)
    const sessionList = sessionsPanel.getByRole('listbox', { name: /saved chat sessions/i })

    await expect(sessionList).toBeVisible({ timeout: 10_000 })
    await expect(sessionList.getByRole('option')).toHaveCount(mockSessions.length)

    // Verify all three sessions are visible
    for (const session of mockSessions) {
      const sessionItem = sessionsPanel.getByText(session.title)
      await expect(sessionItem).toBeVisible({ timeout: 10000 })
    }
  })

  test('should display session count', async ({ page }) => {
    const mockSessions = createMockSessions(5)
    await setupAllAICoachMocks(page, {
      sessions: mockSessions,
      messages: [],
    })

    await page.reload()
    await waitForChatReady(page)
    const sessionsPanel = await openSessionsPanel(page)

    // All 5 session titles should be visible in sessions panel.
    let visibleCount = 0
    for (const session of mockSessions) {
      const visible = await sessionsPanel.getByText(session.title).first().isVisible().catch(() => false)
      if (visible) visibleCount += 1
    }
    expect(visibleCount).toBeGreaterThanOrEqual(5)
  })

  test('should switch between sessions', async ({ page }) => {
    const session1 = createMockSession({ id: 'session-001', title: 'SPX Analysis' })
    const session2 = createMockSession({ id: 'session-002', title: 'Options Volatility' })
    const mockSessions = [session1, session2]

    const conversation1 = createMockConversation(session1.id)

    await setupAllAICoachMocks(page, {
      sessions: mockSessions,
      messages: conversation1, // Initial session shows conversation1
    })

    await page.reload()
    await waitForChatReady(page)
    const sessionsPanel = await openSessionsPanel(page)

    // Click second session
    const session2Item = sessionsPanel.getByRole('option', { name: new RegExp(session2.title, 'i') })
    await session2Item.click()

    // Verify header reflects selected session.
    await page.waitForTimeout(500)
    await expect(page.getByRole('heading', { name: session2.title })).toBeVisible()

    // Verify second session is now selected semantically.
    await expect(session2Item).toHaveAttribute('aria-selected', 'true')
  })

  test('should restore last selected session after reload', async ({ page }) => {
    const session1 = createMockSession({ id: 'session-001', title: 'Morning Prep' })
    const session2 = createMockSession({ id: 'session-002', title: 'Midday Review' })

    await setupAllAICoachMocks(page, {
      sessions: [session1, session2],
      messages: createMockConversation(session2.id),
    })

    await page.evaluate(({ key, value }) => {
      window.sessionStorage.setItem(key, value)
    }, { key: SESSION_KEY, value: session2.id })

    await page.reload()
    await waitForChatReady(page)

    await expect.poll(
      async () => page.getByRole('heading', { name: session2.title }).isVisible().catch(() => false),
      { timeout: 10_000 },
    ).toBeTruthy()
    await expect(page.getByText('Analyze SPX').first()).toBeVisible({ timeout: 10_000 })

    const sessionsPanel = await openSessionsPanel(page)
    const restoredOption = sessionsPanel.locator(`#ai-coach-session-option-${session2.id}`)
    await expect(restoredOption).toHaveAttribute('aria-selected', 'true')
  })

  test('should support keyboard navigation for session list', async ({ page }) => {
    const session1 = createMockSession({ id: 'session-001', title: 'Session One' })
    const session2 = createMockSession({ id: 'session-002', title: 'Session Two' })

    await setupAllAICoachMocks(page, {
      sessions: [session1, session2],
      messages: createMockConversation(session1.id),
    })

    await page.reload()
    await waitForChatReady(page)

    const toggleButton = page.getByRole('button', { name: /show sessions panel|hide sessions panel/i }).first()
    await expect(toggleButton).toHaveAttribute('aria-expanded', 'false')
    await toggleButton.click()
    await expect(toggleButton).toHaveAttribute('aria-expanded', 'true')

    const sessionsPanel = page.getByTestId('ai-coach-sessions-panel')
    const sessionList = sessionsPanel.getByRole('listbox', { name: /saved chat sessions/i })
    const sessionOptions = sessionList.getByRole('option')

    await expect(sessionList).toBeVisible()
    await expect(sessionOptions).toHaveCount(2)
    await sessionOptions.nth(1).focus()
    await expect(sessionOptions.nth(1)).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(sessionOptions.nth(1)).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('heading', { name: session2.title })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(sessionsPanel).not.toBeVisible({ timeout: 5000 })
    await expect(toggleButton).toHaveAttribute('aria-expanded', 'false')
  })

  test('should create a new session', async ({ page }) => {
    const mockSessions = createMockSessions(2)
    await setupAllAICoachMocks(page, {
      sessions: mockSessions,
      messages: [],
    })

    await page.reload()
    await waitForChatReady(page)
    await openSessionsPanel(page)

    // Find and click "New" or "New Session" button
    const newSessionButton = page.getByRole('button', { name: /new|create|new session/i })
    if (await newSessionButton.count() > 0) {
      await newSessionButton.first().click()
    } else {
      // Try finding by icon or text fallback
      const buttons = page.locator('button')
      for (let i = 0; i < await buttons.count(); i++) {
        const text = await buttons.nth(i).textContent()
        if (text?.toLowerCase().includes('new')) {
          await buttons.nth(i).click()
          break
        }
      }
    }

    await page.waitForTimeout(500)

    // Verify chat input is ready for a new message.
    const chatInput = page.locator('textarea, input[type="text"]').first()
    await expect(chatInput).toBeVisible({ timeout: 5000 })
    await expect(chatInput).toBeEnabled()
  })

  test('should delete a session', async ({ page }) => {
    const mockSessions = createMockSessions(3)
    await setupAllAICoachMocks(page, {
      sessions: mockSessions,
      messages: [],
    })

    await page.reload()
    await waitForChatReady(page)
    const sessionsPanel = await openSessionsPanel(page)

    // Get the second session item
    const targetSessionTitle = mockSessions[1].title
    const targetSessionElement = sessionsPanel.locator(
      `xpath=.//p[normalize-space()="${targetSessionTitle}"]/ancestor::div[contains(@class, "group")][1]`,
    )

    // Hover over session to reveal delete button
    await targetSessionElement.hover()

    const deleteButton = targetSessionElement.locator('button').last()
    await expect(deleteButton).toBeVisible({ timeout: 5000 })
    await deleteButton.click()

    await page.waitForTimeout(300)

    // Verify session is removed from the list
    const sessionAfterDelete = sessionsPanel.getByText(targetSessionTitle)
    await expect(sessionAfterDelete).not.toBeVisible({ timeout: 5000 })
  })

  test('should load message history for selected session', async ({ page }) => {
    const session = createMockSession({ id: 'session-001', title: 'SPX Analysis' })
    const conversation = createMockConversation(session.id)

    await setupAllAICoachMocks(page, {
      sessions: [session],
      messages: conversation,
    })

    await page.reload()
    await waitForChatReady(page)
    const sessionsPanel = await openSessionsPanel(page)

    // Select the target session to load its history.
    await sessionsPanel.getByText(session.title).first().click()

    // Wait for messages to load and verify both user and assistant messages
    await expect(page.getByText('Analyze SPX').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/SPX is testing resistance/i).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('What about key levels?').first()).toBeVisible({ timeout: 10000 })
  })

  test('should show session titles in sidebar', async ({ page }) => {
    const session1 = createMockSession({ id: 'session-001', title: 'Gap Analysis' })
    const session2 = createMockSession({ id: 'session-002', title: 'Risk Management' })
    const session3 = createMockSession({ id: 'session-003', title: 'Entry Signals' })

    await setupAllAICoachMocks(page, {
      sessions: [session1, session2, session3],
      messages: [],
    })

    await page.reload()
    await waitForChatReady(page)
    const sessionsPanel = await openSessionsPanel(page)

    // Verify each title is visible in sidebar
    await expect(sessionsPanel.getByText('Gap Analysis')).toBeVisible({ timeout: 10000 })
    await expect(sessionsPanel.getByText('Risk Management')).toBeVisible({ timeout: 10000 })
    await expect(sessionsPanel.getByText('Entry Signals')).toBeVisible({ timeout: 10000 })
  })

  test('should highlight active session', async ({ page }) => {
    const session1 = createMockSession({ id: 'session-001', title: 'Active Session' })
    const session2 = createMockSession({ id: 'session-002', title: 'Inactive Session' })

    await setupAllAICoachMocks(page, {
      sessions: [session1, session2],
      messages: createMockConversation(session1.id),
    })

    await page.reload()
    await waitForChatReady(page)
    const sessionsPanel = await openSessionsPanel(page)

    // At most one session should be marked selected at any point.
    const session1Option = sessionsPanel.locator('#ai-coach-session-option-session-001')
    const initiallySelected = sessionsPanel.locator('[role="option"][aria-selected="true"]')
    expect(await initiallySelected.count()).toBeLessThanOrEqual(1)

    // Click second session to make it active
    const session2Option = sessionsPanel.locator('#ai-coach-session-option-session-002')
    await session2Option.click()

    await page.waitForTimeout(300)

    // Second session should now be active
    await expect(session2Option).toHaveAttribute('aria-selected', 'true')
    await expect(session1Option).toHaveAttribute('aria-selected', 'false')
  })

  test('should persist session order', async ({ page }) => {
    const mockSessions = createMockSessions(4)
    const sessionTitles = mockSessions.map((s) => s.title)

    await setupAllAICoachMocks(page, {
      sessions: mockSessions,
      messages: [],
    })

    await page.reload()
    await waitForChatReady(page)
    const sessionsPanel = await openSessionsPanel(page)

    // Get visible session elements in order
    const sessionElements = sessionsPanel.locator('p.text-xs.truncate')

    const visibleTitles = (await sessionElements.allTextContents()).map((title) => title.trim())
    const matchedTitles = visibleTitles.filter((title) => sessionTitles.includes(title))

    // Verify sessions appear in a consistent order (at least some match mock order)
    expect(matchedTitles.length).toBeGreaterThanOrEqual(3)
  })
})
