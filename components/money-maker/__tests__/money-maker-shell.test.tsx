/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockUseMoneyMaker,
  mockUseMoneyMakerPolling,
} = vi.hoisted(() => ({
  mockUseMoneyMaker: vi.fn(),
  mockUseMoneyMakerPolling: vi.fn(),
}))

vi.mock('../money-maker-provider', () => ({
  useMoneyMaker: (...args: unknown[]) => mockUseMoneyMaker(...args),
}))

vi.mock('@/hooks/use-money-maker-polling', () => ({
  useMoneyMakerPolling: (...args: unknown[]) => mockUseMoneyMakerPolling(...args),
}))

vi.mock('../watchlist-manager', () => ({
  WatchlistManager: () => <div>Watchlist</div>,
}))

vi.mock('../active-strategies-clock', () => ({
  ActiveStrategiesClock: () => <div>Clock</div>,
}))

import { MoneyMakerShell } from '../money-maker-shell'

describe('MoneyMakerShell', () => {
  beforeEach(() => {
    mockUseMoneyMakerPolling.mockReturnValue({
      refreshSnapshot: vi.fn(),
    })
  })

  it('keeps rendering the last known content when an error is present', () => {
    mockUseMoneyMaker.mockReturnValue({
      state: {
        isLoading: false,
        isRefreshing: false,
        lastUpdated: 1773163800000,
        error: 'Market data is temporarily unavailable.',
      },
    })

    render(
      <MoneyMakerShell>
        <div>Snapshot Grid</div>
      </MoneyMakerShell>,
    )

    expect(screen.getByText('Strategy Data Degraded')).toBeInTheDocument()
    expect(screen.getByText('Market data is temporarily unavailable.')).toBeInTheDocument()
    expect(screen.getByText('Snapshot Grid')).toBeInTheDocument()
  })
})
