/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DossierPanel } from '../dossier-panel'
import type { SwingSniperDossierPayload } from '@/lib/swing-sniper/types'

const dossierFixture: SwingSniperDossierPayload = {
  symbol: 'NVDA',
  orc_score: 91,
  view: 'Long vol',
  catalyst_label: 'Earnings',
  headline: 'Momentum and event premium are aligned for a defined-risk long vol expression.',
  thesis: {
    summary: 'Momentum remains intact while the earnings window can expand implied movement.',
    risks: ['Event premium collapses before confirmation.'],
    narrative_shifts: ['Institutional positioning keeps chasing upside revisions.'],
    factors: {
      volatility: 88,
      catalyst: 94,
      liquidity: 90,
    },
  },
  vol_map: {
    surface_read: 'Front expiration is bid but still inside acceptable carry for a debit spread.',
    iv_rank: 57,
    iv_percentile: 61,
    rv_20d: 42.1,
    iv_now: 48.3,
    skew: 'Call wing supported',
    term_shape: 'Mild contango',
    term_structure: [
      { label: '1W', iv: 48 },
      { label: '2W', iv: 46 },
      { label: '1M', iv: 43 },
      { label: '2M', iv: 40 },
      { label: '3M', iv: 38 },
    ],
    iv_rv_history: [
      { date: 'Mar 10', iv: 45.1, rv: 39.4 },
      { date: 'Mar 11', iv: 46.8, rv: 40.1 },
      { date: 'Mar 12', iv: 48.3, rv: 42.1 },
    ],
  },
  catalysts: [
    {
      days_out: 4,
      date: '2026-03-18',
      label: 'Q1 earnings',
      context: 'Consensus revisions continue to drift higher into the print.',
      severity: 'high',
    },
  ],
  structures: [
    {
      name: 'Call debit spread',
      fit_score: 9.2,
      rationale: 'Keeps exposure defined while leaning into upside expansion.',
      entry_type: 'Scale on morning pullbacks',
      max_loss: '$420',
      pop: '58%',
      style: 'Defined risk',
      contracts: [
        {
          leg: 'Long call',
          side: 'buy',
          optionType: 'call',
          expiry: '2026-03-20',
          strike: 920,
          quantity: 1,
          mark: 8.4,
          bid: 8.2,
          ask: 8.6,
          spreadPct: 2.4,
          delta: 0.41,
          openInterest: 1284,
          volume: 447,
        },
      ],
      scenario_distribution: [
        {
          label: 'Base',
          probability: 52,
          expectedPnl: 180,
          expectedReturnPct: 42.9,
        },
      ],
      payoff_diagram: null,
    },
  ],
  risk: {
    killers: ['Lose the post-earnings gap and close back inside prior balance.'],
    exit_framework: 'Take partials into expansion and trail the balance behind prior-day low.',
  },
}

function Harness() {
  const [activeTab, setActiveTab] = useState<'Thesis' | 'Vol Map' | 'Catalysts' | 'Structure' | 'Risk'>('Thesis')

  return (
    <DossierPanel
      dossier={dossierFixture}
      selectedSymbol="NVDA"
      loading={false}
      error={false}
      activeTab={activeTab}
      monitoring={null}
      isSaved={false}
      thesisPending={false}
      watchlistPending={false}
      onTabChange={setActiveTab}
      onSaveThesis={() => {}}
      onRemoveThesis={() => {}}
      onAddToWatchlist={() => {}}
    />
  )
}

describe('DossierPanel', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0)
        return 0
      },
    })

    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('opens the structure deep-dive when build trade is clicked', () => {
    render(<Harness />)

    expect(screen.queryByText('Expand: contract picks + scenario distribution')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Build trade' }))

    expect(screen.getByRole('button', { name: 'Hide details' })).toBeInTheDocument()
    expect(screen.getByText('Expand: contract picks + scenario distribution')).toBeInTheDocument()
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
  })
})
