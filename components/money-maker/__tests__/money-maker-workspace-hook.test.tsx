/* @vitest-environment jsdom */

import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockUseMoneyMaker,
  mockUseMemberSession,
} = vi.hoisted(() => ({
  mockUseMoneyMaker: vi.fn(),
  mockUseMemberSession: vi.fn(),
}))

vi.mock('../money-maker-provider', () => ({
  useMoneyMaker: (...args: unknown[]) => mockUseMoneyMaker(...args),
}))

vi.mock('@/contexts/MemberAuthContext', () => ({
  useMemberSession: (...args: unknown[]) => mockUseMemberSession(...args),
}))

import { useMoneyMakerWorkspace } from '@/hooks/use-money-maker-workspace'

function Harness() {
  useMoneyMakerWorkspace()
  return null
}

describe('useMoneyMakerWorkspace', () => {
  beforeEach(() => {
    mockUseMemberSession.mockReturnValue({
      session: { access_token: 'member-token' },
    })
  })

  it('loads workspace data when a plan is opened with no cached workspace', async () => {
    const setWorkspace = vi.fn()
    const setWorkspaceError = vi.fn()
    const setIsWorkspaceLoading = vi.fn()

    mockUseMoneyMaker.mockReturnValue({
      state: {
        isWorkspaceOpen: true,
        workspaceSymbol: 'SPY',
        workspace: null,
        workspaceError: null,
      },
      setWorkspace,
      setWorkspaceError,
      setIsWorkspaceLoading,
    })

    const payload = {
      symbolSnapshot: {
        symbol: 'SPY',
        price: 612.45,
        priceChange: 1.25,
        priceChangePercent: 0.2,
        orbRegime: 'trending_up',
        strongestConfluence: null,
        hourlyLevels: null,
        indicators: {
          vwap: 611.8,
          ema8: 611.9,
          ema21: 611.4,
          ema34: 611.1,
          sma200: null,
        },
        lastCandleAt: Date.UTC(2026, 2, 16, 18, 30),
      },
      activeSignal: null,
      executionPlan: null,
      contracts: [],
      generatedAt: Date.UTC(2026, 2, 16, 18, 30),
      degradedReason: 'No active Money Maker signal is available for this symbol right now.',
    }

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    render(<Harness />)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/members/money-maker/workspace?symbol=SPY',
      expect.objectContaining({
        cache: 'no-store',
        headers: { Authorization: 'Bearer member-token' },
      }),
    )
    expect(setIsWorkspaceLoading).toHaveBeenNthCalledWith(1, true)
    expect(setWorkspaceError).toHaveBeenNthCalledWith(1, null)
    expect(setWorkspace).toHaveBeenCalledWith(payload)
    expect(setIsWorkspaceLoading).toHaveBeenLastCalledWith(false)
  })
})
