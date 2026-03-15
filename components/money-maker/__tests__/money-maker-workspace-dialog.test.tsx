/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockUseMoneyMaker,
  mockUseMoneyMakerWorkspace,
} = vi.hoisted(() => ({
  mockUseMoneyMaker: vi.fn(),
  mockUseMoneyMakerWorkspace: vi.fn(),
}))

vi.mock('../money-maker-provider', () => ({
  useMoneyMaker: (...args: unknown[]) => mockUseMoneyMaker(...args),
}))

vi.mock('@/hooks/use-money-maker-workspace', () => ({
  useMoneyMakerWorkspace: (...args: unknown[]) => mockUseMoneyMakerWorkspace(...args),
}))

import { MoneyMakerWorkspaceDialog } from '../money-maker-workspace-dialog'

describe('MoneyMakerWorkspaceDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-10T16:15:05.000Z'))
    mockUseMoneyMakerWorkspace.mockReturnValue({
      refreshWorkspace: vi.fn(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a loading state while the workspace is being fetched', () => {
    mockUseMoneyMaker.mockReturnValue({
      state: {
        isWorkspaceOpen: true,
        workspaceSymbol: 'SPY',
        workspace: null,
        isWorkspaceLoading: true,
        workspaceError: null,
      },
      closeWorkspace: vi.fn(),
    })

    render(<MoneyMakerWorkspaceDialog />)

    expect(screen.getByText('Building execution workspace…')).toBeInTheDocument()
  })

  it('renders trade-plan and contract content when workspace data is available', () => {
    mockUseMoneyMaker.mockReturnValue({
      state: {
        isWorkspaceOpen: true,
        workspaceSymbol: 'SPY',
        isWorkspaceLoading: false,
        workspaceError: null,
        workspace: {
          symbolSnapshot: {
            symbol: 'SPY',
            price: 101.05,
            priceChange: 0.45,
            priceChangePercent: 0.45,
            orbRegime: 'trending_up',
            strongestConfluence: {
              priceLow: 100.2,
              priceHigh: 100.8,
              score: 4.2,
              label: 'fortress',
              levels: [{ source: 'VWAP', price: 100.5, weight: 1.5 }],
              isKingQueen: true,
            },
            hourlyLevels: {
              nearestSupport: 100.4,
              nextSupport: 99.8,
              nearestResistance: 103.01,
              nextResistance: 104.25,
            },
            indicators: {
              vwap: 100.5,
              ema8: 100.72,
              ema21: 100.44,
              ema34: 100.28,
              sma200: null,
            },
            lastCandleAt: Date.UTC(2026, 2, 10, 16, 15),
          },
          activeSignal: null,
          executionPlan: {
            symbol: 'SPY',
            signalId: 'signal-1',
            executionState: 'triggered',
            triggerDistance: -0.04,
            triggerDistancePct: -0.04,
            entry: 101.01,
            stop: 100.19,
            target1: 103.01,
            target2: 104.25,
            riskPerShare: 0.82,
            rewardToTarget1: 2,
            rewardToTarget2: 3.24,
            riskRewardRatio: 2.44,
            entryQuality: 'ideal',
            idealEntryLow: 101.01,
            idealEntryHigh: 101.11,
            chaseCutoff: 101.16,
            timeWarning: 'normal',
            invalidationReason: 'Long setup invalidates below 100.19.',
            holdWhile: ['Hold above trigger.'],
            reduceWhen: ['Reduce at target 1.'],
            exitImmediatelyWhen: ['Exit below stop.'],
          },
          contracts: [
            {
              label: 'primary',
              optionSymbol: 'SPY 2026-03-20 C 102',
              expiry: '2026-03-20',
              strike: 102,
              type: 'call',
              bid: 2.05,
              ask: 2.15,
              mid: 2.1,
              spreadPct: 4.65,
              delta: 0.45,
              theta: -0.08,
              impliedVolatility: 0.24,
              openInterest: 1200,
              volume: 240,
              premiumPerContract: 215,
              dte: 6,
              quality: 'green',
              explanation: 'best balance of delta fit and spread quality',
            },
          ],
          generatedAt: Date.UTC(2026, 2, 10, 16, 15),
          degradedReason: null,
        },
      },
      closeWorkspace: vi.fn(),
    })

    render(<MoneyMakerWorkspaceDialog />)

    expect(screen.getByText('Execution map for SPY')).toBeInTheDocument()
    expect(screen.getAllByText('Trigger').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: 'Contracts' }))
    expect(screen.getByText('SPY 2026-03-20 C 102')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Exit Playbook' }))
    expect(screen.getByText('Hold above trigger.')).toBeInTheDocument()
  })

  it('shows a stale warning when workspace data ages out', () => {
    mockUseMoneyMaker.mockReturnValue({
      state: {
        isWorkspaceOpen: true,
        workspaceSymbol: 'SPY',
        isWorkspaceLoading: false,
        workspaceError: null,
        workspace: {
          symbolSnapshot: {
            symbol: 'SPY',
            price: 101.05,
            priceChange: 0.45,
            priceChangePercent: 0.45,
            orbRegime: 'trending_up',
            strongestConfluence: null,
            hourlyLevels: null,
            indicators: {
              vwap: 100.5,
              ema8: 100.72,
              ema21: 100.44,
              ema34: 100.28,
              sma200: null,
            },
            lastCandleAt: Date.UTC(2026, 2, 10, 16, 10),
          },
          activeSignal: null,
          executionPlan: null,
          contracts: [],
          generatedAt: Date.UTC(2026, 2, 10, 16, 13),
          degradedReason: null,
        },
      },
      closeWorkspace: vi.fn(),
    })

    vi.setSystemTime(new Date('2026-03-10T16:14:10.000Z'))
    render(<MoneyMakerWorkspaceDialog />)

    expect(screen.getByText('Data stale')).toBeInTheDocument()
    expect(screen.getByText('Workspace data is stale. Refresh before acting on a new entry or exit.')).toBeInTheDocument()
  })
})
