/* @vitest-environment jsdom */

import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockUseMoneyMaker } = vi.hoisted(() => ({
  mockUseMoneyMaker: vi.fn(),
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
              priceHigh: 683.4,
              score: 3.6,
              label: 'strong',
              levels: [
                { source: 'VWAP', price: 682.9, weight: 1.5 },
                { source: '8 EMA', price: 682.7, weight: 1.2 },
              ],
              isKingQueen: true,
            },
            indicators: {
              vwap: 682.9,
              ema8: 682.7,
              ema21: 681.8,
              ema34: 681.1,
              sma200: 677.8,
            },
            lastCandleAt: Date.UTC(2026, 2, 10, 17, 30),
          },
        ],
        isLoading: false,
      },
    })

    render(<SetupCard symbol="SPY" />)

    expect(screen.getByText('SPY')).toBeInTheDocument()
    expect(screen.getByText('$683.10')).toBeInTheDocument()
    expect(screen.getByText('+0.18%')).toBeInTheDocument()
    expect(screen.getByText('Monitoring')).toBeInTheDocument()
    expect(screen.getByText('Strongest zone:')).toBeInTheDocument()
    expect(screen.queryByText('Waiting for Patience Candle')).not.toBeInTheDocument()
  })
})
