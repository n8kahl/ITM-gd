import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = process.cwd()

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
}

describe('AI Coach audit baseline repros (2026-03-20)', () => {
  const pageSource = readRepoFile('app/members/ai-coach/page.tsx')
  const workflowSource = readRepoFile('contexts/AICoachWorkflowContext.tsx')
  const chatHookSource = readRepoFile('hooks/use-ai-coach-chat.ts')
  const e2eHelperSource = readRepoFile('e2e/specs/ai-coach/ai-coach-test-helpers.ts')

  it('has one canonical widget listener source', () => {
    const listenerSources = [
      pageSource.includes("window.addEventListener('ai-coach-widget-chat'"),
      workflowSource.includes("window.addEventListener('ai-coach-widget-chat'"),
    ].filter(Boolean)

    expect(listenerSources).toHaveLength(1)
  })

  it('clears sending state before abort return path', () => {
    const sendMessageBlockMatch = chatHookSource.match(
      /const sendMessage = useCallback\([\s\S]*?\n  }, \[getToken, loadSessions, extractChartRequest\]\)/,
    )
    const sendMessageBlock = sendMessageBlockMatch?.[0] || ''
    const hasAbortEarlyReturn = /AbortError'\)\s*\{\s*return\s*\}/.test(sendMessageBlock)
    expect(hasAbortEarlyReturn).toBe(false)
    expect(sendMessageBlock).toContain('isSending: false')
  })

  it('newSession aborts in-flight send requests', () => {
    const newSessionBlockMatch = chatHookSource.match(
      /const newSession = useCallback\(\(\) => \{[\s\S]*?\n  \}, \[\]\)/,
    )
    const newSessionBlock = newSessionBlockMatch?.[0] || ''
    expect(newSessionBlock).toContain('abortControllerRef.current?.abort()')
    expect(newSessionBlock).toContain('isSending: false')
  })

  it('restores persisted current session after sessions load', () => {
    expect(chatHookSource).toContain('window.sessionStorage.getItem(AI_COACH_CURRENT_SESSION_STORAGE_KEY)')
    expect(chatHookSource).toContain('const persistedSessionId = pendingSessionRestoreIdRef.current')
    expect(chatHookSource).toContain('void selectSession(persistedSessionId)')
  })

  it.fails('E2E helpers should target proxy chat routes (target state)', () => {
    expect(e2eHelperSource).toContain('**/api/ai-coach-proxy/chat/sessions')
    expect(e2eHelperSource).not.toContain('**/api/chat/sessions')
    expect(e2eHelperSource).toContain('**/api/ai-coach-proxy/chat/message')
    expect(e2eHelperSource).not.toContain('**/api/chat/message')
  })

  it.fails('E2E helpers should use camelCase chat payload fields (target state)', () => {
    expect(e2eHelperSource).not.toContain('session_id')
    expect(e2eHelperSource).not.toContain('message_id')
    expect(e2eHelperSource).not.toContain('function_calls')
  })
})
