/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MoneyMakerProvider, useMoneyMaker } from '../money-maker-provider'
import { MoneyMakerWorkspaceResponse } from '@/lib/money-maker/types'

const sampleWorkspace: MoneyMakerWorkspaceResponse = {
  symbolSnapshot: {
    symbol: 'SPY',
    price: 612.45,
    priceChange: 1.25,
    priceChangePercent: 0.2,
    orbRegime: 'trending_up',
    strongestConfluence: null,
    hourlyLevels: {
      nearestSupport: 610.5,
      nextSupport: 609.8,
      nearestResistance: 613.7,
      nextResistance: 615.2,
    },
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

function ProviderHarness() {
  const {
    state,
    setWorkspace,
    setWorkspaceError,
    openWorkspace,
    closeWorkspace,
  } = useMoneyMaker()

  return (
    <div>
      <button type="button" onClick={() => setWorkspace(sampleWorkspace)}>Seed Workspace</button>
      <button type="button" onClick={() => setWorkspaceError('stale workspace error')}>Seed Error</button>
      <button type="button" onClick={() => openWorkspace('SPY')}>Open SPY</button>
      <button type="button" onClick={() => closeWorkspace()}>Close Workspace</button>
      <pre data-testid="money-maker-provider-state">
        {JSON.stringify({
          isWorkspaceOpen: state.isWorkspaceOpen,
          workspaceSymbol: state.workspaceSymbol,
          workspaceSymbolFromPayload: state.workspace?.symbolSnapshot.symbol ?? null,
          isWorkspaceLoading: state.isWorkspaceLoading,
          workspaceError: state.workspaceError,
        })}
      </pre>
    </div>
  )
}

function parseState() {
  const raw = screen.getByTestId('money-maker-provider-state').textContent
  if (!raw) {
    throw new Error('Provider state was not rendered')
  }

  return JSON.parse(raw) as {
    isWorkspaceOpen: boolean
    workspaceSymbol: string | null
    workspaceSymbolFromPayload: string | null
    isWorkspaceLoading: boolean
    workspaceError: string | null
  }
}

describe('MoneyMakerProvider', () => {
  it('resets workspace state when a plan is opened and closed', () => {
    render(
      <MoneyMakerProvider>
        <ProviderHarness />
      </MoneyMakerProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Seed Workspace' }))
    fireEvent.click(screen.getByRole('button', { name: 'Seed Error' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open SPY' }))

    expect(parseState()).toEqual({
      isWorkspaceOpen: true,
      workspaceSymbol: 'SPY',
      workspaceSymbolFromPayload: null,
      isWorkspaceLoading: true,
      workspaceError: null,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Close Workspace' }))

    expect(parseState()).toEqual({
      isWorkspaceOpen: false,
      workspaceSymbol: null,
      workspaceSymbolFromPayload: null,
      isWorkspaceLoading: false,
      workspaceError: null,
    })
  })
})
