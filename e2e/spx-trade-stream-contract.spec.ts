import { expect, test } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'
import {
  assertTradeStreamLifecycleOrder,
  getContractOrderedTradeStreamSnapshot,
  readTradeStreamSelectorContractFixture,
  readTradeStreamSnapshotFixture,
  selectNowFocusItemId,
  TRADE_STREAM_LIFECYCLE_ORDER,
  type TradeStreamSnapshotContract,
} from './helpers/spx-trade-stream-contract'

test.describe('SPX Expert Trade Stream contract', () => {
  test('selector contract fixture is deterministic and complete', async () => {
    const selectorContract = readTradeStreamSelectorContractFixture()
    expect(selectorContract.route).toBe('/members/spx-command-center')
    expect(selectorContract.lifecycleOrder).toEqual([...TRADE_STREAM_LIFECYCLE_ORDER])

    const selectorValues = Object.values(selectorContract.selectors)
    expect(selectorValues.length).toBeGreaterThanOrEqual(12)
    expect(new Set(selectorValues).size).toBe(selectorValues.length)

    for (const value of selectorValues) {
      expect(value).toMatch(/^spx-(command-center|now-focus|trade-stream)/)
    }

    expect(selectorContract.dynamicSelectors.tradeStreamRowByStableHash).toContain('{stableIdHash}')
    expect(selectorContract.selectors.lifecycleGroupForming).toBe('spx-trade-stream-lifecycle-forming')
    expect(selectorContract.selectors.lifecycleGroupTriggered).toBe('spx-trade-stream-lifecycle-triggered')
    expect(selectorContract.selectors.lifecycleGroupPast).toBe('spx-trade-stream-lifecycle-past')
  })

  test('fixture payload order contract enforces lifecycle and now-focus rules', async () => {
    const unorderedFixture = readTradeStreamSnapshotFixture('unordered')
    const orderedFixture = getContractOrderedTradeStreamSnapshot(unorderedFixture)
    const expectedOrderedFixture = readTradeStreamSnapshotFixture('expectedOrdered')

    expect(assertTradeStreamLifecycleOrder(orderedFixture.items)).toBe(true)
    expect(orderedFixture.items.map((item) => item.id)).toEqual(
      expectedOrderedFixture.items.map((item) => item.id),
    )
    expect(orderedFixture.countsByLifecycle).toEqual(expectedOrderedFixture.countsByLifecycle)
    expect(orderedFixture.nowFocusItemId).toBe(expectedOrderedFixture.nowFocusItemId)
    expect(orderedFixture.nowFocusItemId).toBe(selectNowFocusItemId(orderedFixture.items))
  })

  test('now-focus tie-break does not prioritize lifecycle rank', async () => {
    const unorderedFixture = readTradeStreamSnapshotFixture('unordered')
    const items = unorderedFixture.items.map((item) => ({ ...item }))
    const forming = items.find((item) => item.lifecycleState === 'forming')
    const triggered = items.find((item) => item.lifecycleState === 'triggered')
    expect(forming).toBeTruthy()
    expect(triggered).toBeTruthy()
    if (!forming || !triggered) return

    // Force an urgency tie across lifecycle states and verify deterministic
    // tie-break does not depend on lifecycle rank ordering.
    forming.momentPriority = 100
    triggered.momentPriority = 100
    forming.timing.createdAt = '2026-02-28T14:31:00.000Z'
    triggered.timing.triggeredAt = '2026-02-28T14:30:00.000Z'

    const focusId = selectNowFocusItemId([forming, triggered])
    expect(focusId).toBe(forming.id)
  })

  test('mocked trade-stream endpoint returns lifecycle-ordered payload', async ({ page }) => {
    await setupSPXCommandCenterMocks(page, { tradeStreamFixtureId: 'unordered' })
    await authenticateAsMember(page)

    const payload = await page.evaluate(async () => {
      const response = await fetch('/api/spx/trade-stream')
      if (!response.ok) {
        throw new Error(`Expected 200 from /api/spx/trade-stream, received ${response.status}`)
      }
      return await response.json()
    }) as TradeStreamSnapshotContract

    const expectedOrderedFixture = readTradeStreamSnapshotFixture('expectedOrdered')
    expect(payload.items).toHaveLength(6)
    expect(assertTradeStreamLifecycleOrder(payload.items)).toBe(true)
    expect(payload.countsByLifecycle).toEqual({ forming: 2, triggered: 2, past: 2 })
    expect(payload.nowFocusItemId).toBe(selectNowFocusItemId(payload.items))
    expect(payload.items.map((item) => item.id)).toEqual(expectedOrderedFixture.items.map((item) => item.id))
    expect(payload.items.map((item) => item.lifecycleState)).toEqual([
      'forming',
      'forming',
      'triggered',
      'triggered',
      'past',
      'past',
    ])
  })
})
