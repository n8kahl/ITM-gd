/* @vitest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import {
  ReplayTranscriptSidebar,
  type ReplayTranscriptMessage,
} from '@/components/spx-command-center/replay-transcript-sidebar'

function buildMessage(overrides: Partial<ReplayTranscriptMessage>): ReplayTranscriptMessage {
  return {
    id: null,
    authorName: 'Caller',
    authorId: 'caller-1',
    content: 'message',
    sentAt: '2026-03-01T14:30:00.000Z',
    isSignal: false,
    signalType: null,
    parsedTradeId: null,
    ...overrides,
  }
}

describe('spx-command-center/replay-transcript-sidebar', () => {
  it('renders signal color coding, reduced commentary opacity, and thesis treatment', async () => {
    const messages: ReplayTranscriptMessage[] = [
      buildMessage({ id: 'prep', signalType: 'prep', isSignal: true, content: 'Prep 6040C' }),
      buildMessage({ id: 'fill', signalType: 'filled_avg', isSignal: true, content: 'Filled AVG 1.20', sentAt: '2026-03-01T14:31:00.000Z' }),
      buildMessage({ id: 'trim', signalType: 'trim', isSignal: true, content: 'Trim 25%', sentAt: '2026-03-01T14:32:00.000Z' }),
      buildMessage({ id: 'stop', signalType: 'stops', isSignal: true, content: 'Stops 1.05', sentAt: '2026-03-01T14:33:00.000Z' }),
      buildMessage({ id: 'exit', signalType: 'exit_above', isSignal: true, content: 'Fully out', sentAt: '2026-03-01T14:34:00.000Z' }),
      buildMessage({
        id: 'thesis',
        signalType: 'commentary',
        isSignal: false,
        content: 'Thesis: looking for a squeeze because gamma is pinned at the call wall.',
        sentAt: '2026-03-01T14:35:00.000Z',
      }),
      buildMessage({
        id: 'commentary',
        signalType: 'commentary',
        isSignal: false,
        content: 'Watching tape.',
        sentAt: '2026-03-01T14:36:00.000Z',
      }),
    ]

    render(createElement(ReplayTranscriptSidebar, {
      sessionId: 'session-1',
      messages,
    }))

    expect(screen.getByTestId('spx-replay-transcript-row-0')).toHaveAttribute('data-signal-kind', 'prep')
    expect(screen.getByTestId('spx-replay-transcript-row-1')).toHaveAttribute('data-signal-kind', 'fill')
    expect(screen.getByTestId('spx-replay-transcript-row-2')).toHaveAttribute('data-signal-kind', 'trim')
    expect(screen.getByTestId('spx-replay-transcript-row-3')).toHaveAttribute('data-signal-kind', 'stop')
    expect(screen.getByTestId('spx-replay-transcript-row-4')).toHaveAttribute('data-signal-kind', 'exit')
    expect(screen.getByTestId('spx-replay-transcript-thesis-5')).toBeInTheDocument()
    expect(screen.getByTestId('spx-replay-transcript-row-6').className).toContain('opacity-65')

    await waitFor(() => {
      expect(screen.getByText(/Caller Thesis/i)).toBeInTheDocument()
    })
  })

  it('focuses transcript row by cursor time (latest message at-or-before cursor)', async () => {
    const messages: ReplayTranscriptMessage[] = [
      buildMessage({ id: 'm1', content: 'M1', sentAt: '2026-03-01T14:30:00.000Z' }),
      buildMessage({ id: 'm2', content: 'M2', sentAt: '2026-03-01T14:35:00.000Z' }),
      buildMessage({ id: 'm3', content: 'M3', sentAt: '2026-03-01T14:40:00.000Z' }),
    ]

    const { rerender } = render(createElement(ReplayTranscriptSidebar, {
      sessionId: 'session-1',
      messages,
      cursorTimeIso: '2026-03-01T14:36:30.000Z',
    }))

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-transcript-row-1')).toHaveAttribute('aria-current', 'true')
    })

    rerender(createElement(ReplayTranscriptSidebar, {
      sessionId: 'session-1',
      messages,
      cursorTimeIso: '2026-03-01T14:29:30.000Z',
    }))

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-transcript-row-0')).toHaveAttribute('aria-current', 'true')
    })
  })

  it('prioritizes jump requests over cursor sync and re-triggers on request id changes', async () => {
    const messages: ReplayTranscriptMessage[] = [
      buildMessage({ id: 'm1', content: 'M1', sentAt: '2026-03-01T14:30:00.000Z' }),
      buildMessage({ id: 'm2', content: 'M2', sentAt: '2026-03-01T14:35:00.000Z' }),
      buildMessage({ id: 'm3', content: 'M3', sentAt: '2026-03-01T14:40:00.000Z' }),
    ]

    const { rerender } = render(createElement(ReplayTranscriptSidebar, {
      sessionId: 'session-1',
      messages,
      cursorTimeIso: '2026-03-01T14:30:30.000Z',
    }))

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-transcript-row-0')).toHaveAttribute('aria-current', 'true')
    })

    rerender(createElement(ReplayTranscriptSidebar, {
      sessionId: 'session-1',
      messages,
      cursorTimeIso: '2026-03-01T14:30:30.000Z',
      jumpRequest: {
        requestId: 1,
        timeIso: '2026-03-01T14:40:00.000Z',
      },
    }))

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-transcript-row-2')).toHaveAttribute('aria-current', 'true')
    })

    rerender(createElement(ReplayTranscriptSidebar, {
      sessionId: 'session-1',
      messages,
      cursorTimeIso: '2026-03-01T14:30:30.000Z',
      jumpRequest: {
        requestId: 2,
        timeIso: '2026-03-01T14:40:00.000Z',
      },
    }))

    await waitFor(() => {
      expect(screen.getByTestId('spx-replay-transcript-row-2')).toHaveAttribute('aria-current', 'true')
    })
  })
})
