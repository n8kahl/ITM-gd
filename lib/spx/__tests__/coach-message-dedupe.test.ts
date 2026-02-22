import { describe, expect, it } from 'vitest'
import { dedupeCoachMessagesForTimeline } from '@/lib/spx/coach-message-dedupe'
import type { CoachMessage } from '@/lib/types/spx-command-center'

function createMessage(input: Partial<CoachMessage> & Pick<CoachMessage, 'id' | 'content' | 'timestamp'>): CoachMessage {
  return {
    id: input.id,
    type: input.type || 'pre_trade',
    priority: input.priority || 'guidance',
    setupId: input.setupId || null,
    content: input.content,
    structuredData: input.structuredData || {},
    timestamp: input.timestamp,
  }
}

describe('dedupeCoachMessagesForTimeline', () => {
  it('suppresses semantic duplicates inside the dedupe window', () => {
    const messages = [
      createMessage({
        id: 'newest',
        setupId: 'setup-1',
        content: 'Pre-trade brief: fade at wall 6889.44 | stop 6886.14 | target1 6915.65',
        timestamp: '2026-02-22T15:05:00.000Z',
      }),
      createMessage({
        id: 'older-dup',
        setupId: 'setup-1',
        content: 'Pre-trade brief: fade at wall 6888.90 | stop 6886.10 | target1 6915.70',
        timestamp: '2026-02-22T15:01:00.000Z',
      }),
      createMessage({
        id: 'other',
        setupId: 'setup-1',
        content: 'Flow divergence warning: counter-regime pressure increasing.',
        timestamp: '2026-02-22T14:58:00.000Z',
      }),
    ]

    const deduped = dedupeCoachMessagesForTimeline(messages)
    expect(deduped.map((message) => message.id)).toEqual(['newest', 'other'])
  })

  it('keeps duplicates when they are outside the dedupe window', () => {
    const messages = [
      createMessage({
        id: 'newest',
        setupId: 'setup-2',
        content: 'Entry window is open. Confluence remains elevated.',
        timestamp: '2026-02-22T15:30:00.000Z',
      }),
      createMessage({
        id: 'old',
        setupId: 'setup-2',
        content: 'Entry window is open. Confluence remains elevated.',
        timestamp: '2026-02-22T15:05:00.000Z',
      }),
    ]

    const deduped = dedupeCoachMessagesForTimeline(messages)
    expect(deduped.map((message) => message.id)).toEqual(['newest', 'old'])
  })
})
