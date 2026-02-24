import { describe, expect, it } from 'vitest'

import {
  createTriggeredAlertState,
  ingestTriggeredAlertSetups,
  MAX_TRIGGER_ALERT_HISTORY,
  sanitizeTriggeredAlertHistory,
  type TriggeredAlertHistoryItem,
} from '@/lib/spx/triggered-alert-history'
import type { Setup } from '@/lib/types/spx-command-center'

function buildSetup(partial?: Partial<Setup>): Setup {
  return {
    id: partial?.id ?? 'setup-1',
    type: partial?.type ?? 'mean_reversion',
    direction: partial?.direction ?? 'bullish',
    entryZone: partial?.entryZone ?? { low: 6888, high: 6890 },
    stop: partial?.stop ?? 6883,
    target1: partial?.target1 ?? { price: 6892, label: 'T1' },
    target2: partial?.target2 ?? { price: 6894, label: 'T2' },
    confluenceScore: partial?.confluenceScore ?? 4.1,
    confluenceSources: partial?.confluenceSources ?? ['flow_confirmation'],
    clusterZone: partial?.clusterZone ?? {
      id: 'cluster-1',
      priceLow: 6887.5,
      priceHigh: 6890.5,
      clusterScore: 3.9,
      type: 'defended',
      sources: [],
      testCount: 2,
      lastTestAt: '2026-02-24T14:00:00.000Z',
      held: true,
      holdRate: 61,
    },
    regime: partial?.regime ?? 'ranging',
    status: partial?.status ?? 'ready',
    probability: partial?.probability ?? 61,
    recommendedContract: null,
    createdAt: partial?.createdAt ?? '2026-02-24T14:00:00.000Z',
    triggeredAt: partial?.triggeredAt ?? null,
    statusUpdatedAt: partial?.statusUpdatedAt,
  }
}

describe('triggered alert history', () => {
  it('captures ready -> triggered transitions', () => {
    const initial = ingestTriggeredAlertSetups(createTriggeredAlertState(), [
      buildSetup({ id: 's-1', status: 'ready' }),
    ])
    const next = ingestTriggeredAlertSetups(initial, [
      buildSetup({ id: 's-1', status: 'triggered', statusUpdatedAt: '2026-02-24T15:00:00.000Z' }),
    ])

    expect(next.history).toHaveLength(1)
    expect(next.history[0]?.setupId).toBe('s-1')
  })

  it('captures triggered setups on first ingest for replay continuity', () => {
    const next = ingestTriggeredAlertSetups(createTriggeredAlertState(), [
      buildSetup({ id: 's-2', status: 'triggered', statusUpdatedAt: '2026-02-24T15:01:00.000Z' }),
    ])

    expect(next.history).toHaveLength(1)
    expect(next.history[0]?.id).toContain('s-2')
  })

  it('dedupes repeated ingests by deterministic id', () => {
    const setup = buildSetup({ id: 's-3', status: 'triggered', statusUpdatedAt: '2026-02-24T15:02:00.000Z' })
    const first = ingestTriggeredAlertSetups(createTriggeredAlertState(), [setup])
    const second = ingestTriggeredAlertSetups(first, [setup])

    expect(second.history).toHaveLength(1)
  })

  it('sanitizes localStorage payloads', () => {
    const valid: TriggeredAlertHistoryItem = {
      id: 'id-1',
      setupId: 'setup-1',
      setupType: 'mean_reversion',
      direction: 'bullish',
      regime: 'ranging',
      triggeredAt: '2026-02-24T15:00:00.000Z',
      entryLow: 6888,
      entryHigh: 6890,
      stop: 6883,
      target1: 6892,
      target2: 6894,
      confluenceScore: 4.1,
      probability: 61,
    }

    const output = sanitizeTriggeredAlertHistory([valid, { invalid: true }])
    expect(output).toEqual([valid])
  })

  it('backfills legacy localStorage payloads missing confluence/probability', () => {
    const output = sanitizeTriggeredAlertHistory([{
      id: 'legacy-1',
      setupId: 'setup-legacy',
      setupType: 'mean_reversion',
      direction: 'bullish',
      regime: 'ranging',
      triggeredAt: '2026-02-24T15:00:00.000Z',
      entryLow: 6888,
      entryHigh: 6890,
      stop: 6883,
      target1: 6892,
      target2: 6894,
    }])

    expect(output).toHaveLength(1)
    expect(output[0]?.confluenceScore).toBe(0)
    expect(output[0]?.probability).toBe(0)
  })

  it('caps retained history at max length', () => {
    const items = Array.from({ length: MAX_TRIGGER_ALERT_HISTORY + 5 }, (_, idx) =>
      buildSetup({
        id: `setup-${idx}`,
        status: 'triggered',
        statusUpdatedAt: `2026-02-24T15:${String(idx).padStart(2, '0')}:00.000Z`,
      }),
    )
    const next = ingestTriggeredAlertSetups(createTriggeredAlertState(), items)
    expect(next.history.length).toBe(MAX_TRIGGER_ALERT_HISTORY)
  })
})
