import { describe, expect, it } from 'vitest'

import { normalizeCoachDecisionForMode } from '@/lib/spx/coach-decision-policy'
import type { CoachDecisionBrief } from '@/lib/types/spx-command-center'

function baseDecision(overrides: Partial<CoachDecisionBrief> = {}): CoachDecisionBrief {
  return {
    decisionId: 'decision-1',
    setupId: 'setup-1',
    verdict: 'ENTER',
    confidence: 78,
    primaryText: 'Entry conditions currently favor execution.',
    why: ['Confluence is elevated.'],
    actions: [
      { id: 'ENTER_TRADE_FOCUS', label: 'Enter Trade Focus', style: 'primary', payload: { setupId: 'setup-1' } },
      { id: 'OPEN_HISTORY', label: 'Open Coach History', style: 'ghost' },
    ],
    severity: 'routine',
    freshness: {
      generatedAt: '2026-02-19T12:00:00.000Z',
      expiresAt: '2026-02-19T12:01:00.000Z',
      stale: false,
    },
    source: 'fallback_v1',
    ...overrides,
  }
}

describe('coach decision policy', () => {
  it('normalizes in-trade decision by removing entry action and forcing management verdict', () => {
    const normalized = normalizeCoachDecisionForMode(baseDecision(), 'in_trade', { scopedSetupId: 'setup-1' })

    expect(normalized).not.toBeNull()
    expect(normalized?.verdict).toBe('WAIT')
    expect(normalized?.actions.some((action) => action.id === 'ENTER_TRADE_FOCUS')).toBe(false)
    expect(normalized?.actions.some((action) => action.id === 'EXIT_TRADE_FOCUS')).toBe(true)
  })

  it('normalizes pre-trade decision by removing exit action', () => {
    const decisionWithExit = baseDecision({
      verdict: 'EXIT',
      actions: [
        { id: 'EXIT_TRADE_FOCUS', label: 'Exit Trade Focus', style: 'secondary', payload: { setupId: 'setup-1' } },
        { id: 'OPEN_HISTORY', label: 'Open Coach History', style: 'ghost' },
      ],
    })
    const normalized = normalizeCoachDecisionForMode(decisionWithExit, 'evaluate', { scopedSetupId: 'setup-1' })

    expect(normalized).not.toBeNull()
    expect(normalized?.verdict).toBe('WAIT')
    expect(normalized?.actions.some((action) => action.id === 'EXIT_TRADE_FOCUS')).toBe(false)
  })

  it('returns original reference when no changes are needed', () => {
    const decision = baseDecision({
      verdict: 'REDUCE',
      actions: [
        { id: 'EXIT_TRADE_FOCUS', label: 'Exit Trade Focus', style: 'secondary', payload: { setupId: 'setup-1' } },
        { id: 'OPEN_HISTORY', label: 'Open Coach History', style: 'ghost' },
      ],
    })
    const normalized = normalizeCoachDecisionForMode(decision, 'in_trade', { scopedSetupId: 'setup-1' })

    expect(normalized).toBe(decision)
  })
})
