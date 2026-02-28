import { expect, test, type Page } from '@playwright/test'
import { authenticateAsMember } from './helpers/member-auth'
import { setupSPXCommandCenterMocks } from './helpers/spx-mocks'
import { getContractOrderedTradeStreamSnapshot, readTradeStreamSnapshotFixture } from './helpers/spx-trade-stream-contract'

const TELEMETRY_EVENT = {
  TRADE_STREAM_RENDERED: 'spx_trade_stream_rendered',
  TRADE_STREAM_ROW_SELECTED: 'spx_trade_stream_row_selected',
  TRADE_STREAM_STAGE_PATH_SUPPRESSED: 'spx_trade_stream_stage_path_suppressed',
  DECISION_LATENCY_MEASURED: 'spx_decision_latency_measured',
} as const

type TelemetryRecord = {
  event: string
  payload: Record<string, unknown>
}

function buildTradeStreamStageSnapshot() {
  const snapshot = getContractOrderedTradeStreamSnapshot(readTradeStreamSnapshotFixture('expectedOrdered'))
  const seedItem = snapshot.items[0]
  if (!seedItem) {
    throw new Error('Expected at least one trade stream item in expectedOrdered fixture')
  }

  const generatedAt = new Date(Date.now() - 2_000).toISOString()
  return {
    ...snapshot,
    items: [
      {
        ...seedItem,
        id: 'setup-1',
        stableIdHash: 'setup-1',
        lifecycleState: 'triggered' as const,
        status: 'ready',
        direction: 'bullish' as const,
        setupType: 'fade_at_wall' as const,
        entryZone: { low: 6028, high: 6030 },
        stop: 6024,
        target1: 6038,
        target2: 6044,
        recommendedAction: 'STAGE' as const,
        actionBlockedReason: null,
        freshness: {
          ...seedItem.freshness,
          generatedAt,
          ageMs: 2_000,
          degraded: false,
        },
      },
    ],
    nowFocusItemId: 'setup-1',
    countsByLifecycle: {
      forming: 0,
      triggered: 1,
      past: 0,
    },
    feedTrust: {
      ...snapshot.feedTrust,
      generatedAt,
      ageMs: 2_000,
      degraded: false,
      stale: false,
      reason: null,
    },
    generatedAt,
  }
}

async function readTelemetryBuffer(page: Page): Promise<TelemetryRecord[]> {
  return page.evaluate(() => {
    const records = (window as Window & {
      __spxCommandCenterTelemetry?: Array<{
        event?: string
        payload?: Record<string, unknown>
      }>
    }).__spxCommandCenterTelemetry || []
    return records.map((record) => ({
      event: typeof record.event === 'string' ? record.event : '',
      payload: record.payload || {},
    }))
  })
}

async function waitForTelemetryEvent(page: Page, eventName: string): Promise<void> {
  await expect.poll(async () => {
    const events = await readTelemetryBuffer(page)
    return events.some((event) => event.event === eventName)
  }).toBe(true)
}

async function openWithTradeStreamSnapshot(page: Page): Promise<void> {
  const snapshot = buildTradeStreamStageSnapshot()
  await setupSPXCommandCenterMocks(page, { tradeStreamFixtureId: 'expectedOrdered' })
  await page.route('**/api/spx/trade-stream', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(snapshot),
    })
  })
  await page.addInitScript(() => {
    ;(window as Window & { __spxExpertTradeStreamEnabled?: boolean }).__spxExpertTradeStreamEnabled = true
  })
  await authenticateAsMember(page)
  await page.goto('/members/spx-command-center', { waitUntil: 'domcontentloaded' })
}

test.describe('SPX trade stream telemetry', () => {
  test('captures rendered, row-select, and decision-latency telemetry in trade-stream mode', async ({ page }) => {
    await openWithTradeStreamSnapshot(page)

    const row = page.getByTestId('spx-trade-stream-row-setup-1')
    await expect(page.getByTestId('spx-trade-stream')).toBeVisible()
    await expect(row).toBeVisible()

    await waitForTelemetryEvent(page, TELEMETRY_EVENT.TRADE_STREAM_RENDERED)

    await row.click()

    await waitForTelemetryEvent(page, TELEMETRY_EVENT.TRADE_STREAM_ROW_SELECTED)
    await expect.poll(async () => {
      const events = await readTelemetryBuffer(page)
      return events.some((event) => {
        if (event.event !== TELEMETRY_EVENT.DECISION_LATENCY_MEASURED) return false
        return event.payload.decisionType === 'row_select' && event.payload.setupId === 'setup-1'
      })
    }).toBe(true)

    const events = await readTelemetryBuffer(page)
    const renderedEvent = events.find((event) => event.event === TELEMETRY_EVENT.TRADE_STREAM_RENDERED)
    expect(renderedEvent?.payload.mode).toBe('trade_stream')
    expect(renderedEvent?.payload.surface).toBe('setup_feed')

    const rowSelectedEvent = events.find((event) => event.event === TELEMETRY_EVENT.TRADE_STREAM_ROW_SELECTED)
    expect(rowSelectedEvent?.payload.mode).toBe('trade_stream')
    expect(rowSelectedEvent?.payload.lifecycleState).toBe('triggered')
    expect(rowSelectedEvent?.payload.recommendedAction).toBe('STAGE')
    expect(rowSelectedEvent?.payload.setupId).toBe('setup-1')
    expect(rowSelectedEvent?.payload.stableIdHash).toBe('setup-1')

    const rowSelectLatencyEvent = [...events].reverse().find((event) => (
      event.event === TELEMETRY_EVENT.DECISION_LATENCY_MEASURED
      && event.payload.decisionType === 'row_select'
      && event.payload.setupId === 'setup-1'
    ))
    expect(rowSelectLatencyEvent).toBeTruthy()
    expect(rowSelectLatencyEvent?.payload.mode).toBe('trade_stream')
    expect(rowSelectLatencyEvent?.payload.surface).toBe('trade_stream_row_select')
    expect(typeof rowSelectLatencyEvent?.payload.latencyMs).toBe('number')
    expect(Number(rowSelectLatencyEvent?.payload.latencyMs)).toBeGreaterThanOrEqual(0)
  })

  test('emits suppression telemetry when STAGE row action is deduped by primary CTA ownership', async ({ page }) => {
    await openWithTradeStreamSnapshot(page)

    const row = page.getByTestId('spx-trade-stream-row-setup-1')
    await expect(page.getByTestId('spx-trade-stream')).toBeVisible()
    await expect(row).toBeVisible()
    await expect(row.getByTestId('spx-trade-stream-row-action')).toHaveCount(0)
    await expect(row.getByTestId('spx-trade-stream-row-stage-via-primary-cta')).toBeVisible()

    await waitForTelemetryEvent(page, TELEMETRY_EVENT.TRADE_STREAM_STAGE_PATH_SUPPRESSED)

    const events = await readTelemetryBuffer(page)
    const suppressedEvent = [...events].reverse().find((event) => (
      event.event === TELEMETRY_EVENT.TRADE_STREAM_STAGE_PATH_SUPPRESSED
      && event.payload.setupId === 'setup-1'
    ))

    expect(suppressedEvent).toBeTruthy()
    expect(suppressedEvent?.payload.mode).toBe('trade_stream')
    expect(suppressedEvent?.payload.surface).toBe('trade_stream_row_action')
    expect(suppressedEvent?.payload.blocked).toBe(true)
    expect(suppressedEvent?.payload.lifecycleState).toBe('triggered')
    expect(suppressedEvent?.payload.recommendedAction).toBe('STAGE')
    expect(suppressedEvent?.payload.stableIdHash).toBe('setup-1')
  })
})
