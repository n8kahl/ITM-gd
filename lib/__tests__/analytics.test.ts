// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  trackPageView: vi.fn().mockResolvedValue(null),
  trackClick: vi.fn().mockResolvedValue(null),
  trackConversion: vi.fn().mockResolvedValue(null),
  upsertSession: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/supabase', () => ({
  trackPageView: mocks.trackPageView,
  trackClick: mocks.trackClick,
  trackConversion: mocks.trackConversion,
  upsertSession: mocks.upsertSession,
}))

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
  window.sessionStorage.clear()
  mocks.trackPageView.mockReset().mockResolvedValue(null)
  mocks.trackClick.mockReset().mockResolvedValue(null)
  mocks.trackConversion.mockReset().mockResolvedValue(null)
  mocks.upsertSession.mockReset().mockResolvedValue(null)
})

describe('analytics storage resilience', () => {
  it('falls back to an in-memory session when localStorage access throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError')
    })

    const { getSessionId, isReturningVisitor, markAsVisited } = await import('@/lib/analytics')

    const firstId = getSessionId()
    const secondId = getSessionId()

    expect(firstId).toMatch(/^\d+-[a-z0-9]+$/)
    expect(secondId).toBe(firstId)
    expect(isReturningVisitor()).toBe(false)

    expect(() => markAsVisited()).not.toThrow()
    expect(isReturningVisitor()).toBe(true)
  })

  it('never throws from member-nav analytics tracking when storage is unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError')
    })
    mocks.trackClick.mockRejectedValueOnce(new Error('track failure'))

    const { Analytics } = await import('@/lib/analytics')

    expect(() => Analytics.trackMemberNavItem('Journal')).not.toThrow()
  })
})
