/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockUseMoneyMaker, mockOpenWorkspace } = vi.hoisted(() => ({
  mockUseMoneyMaker: vi.fn(),
  mockOpenWorkspace: vi.fn(),
}))

vi.mock('../money-maker-provider', () => ({
  useMoneyMaker: (...args: unknown[]) => mockUseMoneyMaker(...args),
}))

vi.mock('../signal-why-panel', () => ({
  SignalWhyPanel: () => null,
}))

import { SetupCard } from '../setup-card'

describe('SetupCard', () => {
  beforeEach(() => {
    mockUseMoneyMaker.mockReset()
  })

  it('renders symbol snapshot details when there are no active signals', () => {
    mockUseMoneyMaker.mockReturnValue({
      state: {
        signals: [],
        symbolSnapshots: [
          {
            symbol: 'SPY',
            price: 683.1,
            priceChange: 1.2,
            priceChangePercent: 0.18,
            orbRegime: 'trending_up',
            strongestConfluence: {
              priceLow: 682.5,
              priceHigh: 682.9,
              score: 4.6,
              label: 'fortress',
              levels: [
                { source: 'VWAP', price: 682.9, weight: 1.5 },
                { source: 'Hourly Low 682.50', price: 682.5, weight: 1.4 },
              ],
              isKingQueen: true,
            },
            indicators: {
              vwap: 682.9,
              ema8: 682.7,
              ema21: 681.8,
              ema34: 681.1,
              sma200: null,
            },
            hourlyLevels: {
              nearestSupport: 682.5,
              nextSupport: 681.8,
              nearestResistance: 684.2,
              nextResistance: 685.1,
            },
            lastCandleAt: Date.UTC(2026, 2, 10, 17, 30),
          },
        ],
        isLoading: false,
      },
      openWorkspace: mockOpenWorkspace,
    })

    render(<SetupCard symbol="SPY" />)

    expect(screen.getByText('SPY')).toBeInTheDocument()
    expect(screen.getByText('$683.10')).toBeInTheDocument()
    expect(screen.getByText('+0.18%')).toBeInTheDocument()
    expect(screen.getByText('Monitoring')).toBeInTheDocument()
    expect(screen.getByText('Heavy support cluster')).toBeInTheDocument()
    expect(screen.getByText('S1 682.50')).toBeInTheDocument()
    expect(screen.getByText('R1 684.20')).toBeInTheDocument()
    expect(screen.queryByText('Fortress')).not.toBeInTheDocument()
    expect(screen.queryByText('Hourly Low 682.50 682.50')).not.toBeInTheDocument()
    expect(screen.getAllByText('--')).not.toHaveLength(0)
    expect(screen.queryByText('Waiting for Patience Candle')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open Plan' }))

    expect(mockOpenWorkspace).toHaveBeenCalledWith('SPY')
  })
})
