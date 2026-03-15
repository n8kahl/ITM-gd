/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

vi.mock('../money-maker-workspace-dialog', () => ({
  MoneyMakerWorkspaceDialog: () => <div>Workspace Dialog</div>,
}))

vi.mock('../money-maker-execution-alerts', () => ({
  MoneyMakerExecutionAlerts: () => <div>Execution Alerts</div>,
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
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T18:00:00.000Z'))
    mockUseMoneyMakerPolling.mockReturnValue({
      refreshSnapshot: vi.fn(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
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
    expect(screen.getByText('Workspace Dialog')).toBeInTheDocument()
    expect(screen.getByText('Execution Alerts')).toBeInTheDocument()
  })

  it('shows a live freshness badge when snapshot data is recent', () => {
    mockUseMoneyMaker.mockReturnValue({
      state: {
        isLoading: false,
        isRefreshing: false,
        lastUpdated: Date.now() - 10_000,
        error: null,
      },
    })

    render(
      <MoneyMakerShell>
        <div>Snapshot Grid</div>
      </MoneyMakerShell>,
    )

    expect(screen.getByText('Data live')).toBeInTheDocument()
  })

  it('shows a stale freshness badge when snapshot data has aged out', () => {
    mockUseMoneyMaker.mockReturnValue({
      state: {
        isLoading: false,
        isRefreshing: false,
        lastUpdated: Date.now() - 90_000,
        error: null,
      },
    })

    render(
      <MoneyMakerShell>
        <div>Snapshot Grid</div>
      </MoneyMakerShell>,
    )

    expect(screen.getByText('Data stale')).toBeInTheDocument()
  })
})
