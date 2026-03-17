import { describe, expect, it } from 'vitest'

import { buildFollowUps } from '../follow-up-chips'

describe('buildFollowUps', () => {
  it('does not turn deictic words like HERE into content-only ticker chips', () => {
    const chips = buildFollowUps('The chart for HERE with these key levels is now displayed in the center panel.')

    expect(chips[0]?.label).not.toContain('HERE')
  })

  it('keeps ticker chips when function calls provide an explicit symbol', () => {
    const chips = buildFollowUps('The chart is updated.', [
      {
        function: 'get_key_levels',
        arguments: { symbol: 'SPY' },
        result: { symbol: 'SPY' },
      },
    ])

    expect(chips[0]?.label).toContain('SPY')
  })
})
