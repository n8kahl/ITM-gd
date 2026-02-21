import { describe, expect, it } from 'vitest'

import { applySPXAlertSuppression } from '@/lib/spx/alert-suppression'
import type { CoachMessage } from '@/lib/types/spx-command-center'

function message(id: string, content: string, timestamp: string, priority: CoachMessage['priority'] = 'alert'): CoachMessage {
  return {
    id,
    type: 'alert',
    priority,
    setupId: 'setup-1',
    content,
    structuredData: {},
    timestamp,
  }
}

describe('alert suppression', () => {
  it('suppresses duplicate alerts inside cooldown windows', () => {
    const result = applySPXAlertSuppression([
      message('a1', 'Risk elevated at stop proximity', '2026-02-21T15:10:00.000Z'),
      message('a2', 'Risk elevated at stop proximity', '2026-02-21T15:08:30.000Z'),
      message('a3', 'Risk elevated at stop proximity', '2026-02-21T15:07:50.000Z'),
      message('g1', 'General reminder', '2026-02-21T15:07:00.000Z', 'guidance'),
    ], { cooldownMs: 4 * 60 * 1000 })

    expect(result.suppressedCount).toBe(2)
    expect(result.messages.map((item) => item.id)).toContain('a1')
    expect(result.messages.map((item) => item.id)).toContain('g1')
  })
})
