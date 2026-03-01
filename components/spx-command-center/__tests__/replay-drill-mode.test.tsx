/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  ReplayDrillMode,
  type ReplayDrillHistoryEntry,
  type ReplayDrillSubmissionPayload,
} from '@/components/spx-command-center/replay-drill-mode'

const BASE_HISTORY_ENTRY: ReplayDrillHistoryEntry = {
  id: 'result-1',
  sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  parsedTradeId: 'trade-1',
  decisionAt: '2026-03-01T15:00:00.000Z',
  direction: 'long',
  strike: 6030,
  stopLevel: 6025,
  targetLevel: 6040,
  learnerRr: 2,
  learnerPnlPct: 18.4,
  actualPnlPct: 18.4,
  engineDirection: 'bullish',
  directionMatch: true,
  score: 100,
  feedbackSummary: 'Strong replay read.',
  createdAt: '2026-03-01T15:10:00.000Z',
  session: null,
  trade: null,
}

describe('spx-command-center/replay-drill-mode', () => {
  it('pauses, hides future outcome, and reveals scored comparison after submit', async () => {
    const onSubmit = vi.fn<(payload: ReplayDrillSubmissionPayload) => Promise<{ result: ReplayDrillHistoryEntry }>>()
      .mockResolvedValue({ result: BASE_HISTORY_ENTRY })

    render(
      <ReplayDrillMode
        sessionId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        symbol="SPX"
        trades={[
          {
            id: 'trade-1',
            tradeIndex: 1,
            contract: { symbol: 'SPX', strike: 6030, type: 'call', expiry: '2026-03-01' },
            entry: {
              direction: 'long',
              price: 1.2,
              timestamp: '2026-03-01T15:00:00.000Z',
              sizing: 'starter',
            },
            stop: { initial: 0.9 },
            targets: { target1: 1.8, target2: 2.4 },
            outcome: {
              finalPnlPct: 18.4,
              isWinner: true,
              fullyExited: true,
              exitTimestamp: '2026-03-01T15:20:00.000Z',
            },
            entrySnapshotId: 'snap-1',
          },
        ]}
        snapshots={[
          {
            id: 'snap-1',
            captured_at: '2026-03-01T14:59:00.000Z',
            mtf_composite: 0.8,
            mtf_1h_trend: 'up',
          },
        ]}
        history={[]}
        historyLoading={false}
        historyError={null}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.click(screen.getByTestId('spx-replay-drill-start'))

    expect(screen.getByTestId('spx-replay-drill-hidden')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('spx-replay-drill-direction-long'))
    fireEvent.change(screen.getByTestId('spx-replay-drill-input-strike'), { target: { value: '6030' } })
    fireEvent.change(screen.getByTestId('spx-replay-drill-input-stop'), { target: { value: '6025' } })
    fireEvent.change(screen.getByTestId('spx-replay-drill-input-target'), { target: { value: '6040' } })

    fireEvent.click(screen.getByTestId('spx-replay-drill-reveal'))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        parsedTradeId: 'trade-1',
        decisionAt: '2026-03-01T15:00:00.000Z',
        direction: 'long',
        strike: 6030,
        stopLevel: 6025,
        targetLevel: 6040,
        actualPnlPct: 18.4,
        engineDirection: 'bullish',
      })
    })

    expect(await screen.findByTestId('spx-replay-drill-reveal-panel')).toBeInTheDocument()
    expect(screen.getByTestId('spx-replay-drill-score')).toHaveTextContent('Score 100')
  })

  it('requires strike/stop/target for long/short submissions', async () => {
    const onSubmit = vi.fn<(payload: ReplayDrillSubmissionPayload) => Promise<{ result: ReplayDrillHistoryEntry }>>()
      .mockResolvedValue({ result: BASE_HISTORY_ENTRY })

    render(
      <ReplayDrillMode
        sessionId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        symbol="SPX"
        trades={[
          {
            id: 'trade-1',
            tradeIndex: 1,
            contract: { symbol: 'SPX', strike: 6030, type: 'call', expiry: '2026-03-01' },
            entry: {
              direction: 'long',
              price: 1.2,
              timestamp: '2026-03-01T15:00:00.000Z',
              sizing: 'starter',
            },
            outcome: {
              finalPnlPct: 18.4,
              isWinner: true,
              fullyExited: true,
              exitTimestamp: '2026-03-01T15:20:00.000Z',
            },
          },
        ]}
        snapshots={[]}
        history={[]}
        historyLoading={false}
        historyError={null}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.click(screen.getByTestId('spx-replay-drill-start'))
    fireEvent.click(screen.getByTestId('spx-replay-drill-direction-short'))
    fireEvent.click(screen.getByTestId('spx-replay-drill-reveal'))

    expect(await screen.findByText(/Strike, stop, and target are required/i)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('renders persisted drill history rows', () => {
    render(
      <ReplayDrillMode
        sessionId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        symbol="SPX"
        trades={[
          {
            id: 'trade-1',
            tradeIndex: 1,
            contract: { symbol: 'SPX', strike: 6030, type: 'call', expiry: '2026-03-01' },
            entry: {
              direction: 'long',
              price: 1.2,
              timestamp: '2026-03-01T15:00:00.000Z',
              sizing: 'starter',
            },
            outcome: {
              finalPnlPct: 18.4,
              isWinner: true,
              fullyExited: true,
              exitTimestamp: '2026-03-01T15:20:00.000Z',
            },
          },
        ]}
        snapshots={[]}
        history={[
          BASE_HISTORY_ENTRY,
          {
            ...BASE_HISTORY_ENTRY,
            id: 'result-2',
            direction: 'flat',
            learnerPnlPct: 0,
            score: 82,
            decisionAt: '2026-03-01T14:45:00.000Z',
          },
        ]}
        historyLoading={false}
        historyError={null}
        onSubmit={vi.fn().mockResolvedValue({ result: BASE_HISTORY_ENTRY })}
      />,
    )

    expect(screen.getByTestId('spx-replay-drill-history')).toBeInTheDocument()
    expect(screen.getAllByText(/Score/).length).toBeGreaterThan(1)
  })
})
