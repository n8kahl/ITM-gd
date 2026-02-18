import { describe, expect, it } from 'vitest'

import { getBlockMarkdown } from '@/components/academy/academy-media'

describe('getBlockMarkdown', () => {
  it('returns markdown when present', () => {
    const result = getBlockMarkdown({ markdown: '## Header' })
    expect(result).toBe('## Header')
  })

  it('returns plain content text when content is markdown text', () => {
    const result = getBlockMarkdown({ content: 'Regular block copy' })
    expect(result).toBe('Regular block copy')
  })

  it('converts stringified JSON with component_id to readable markdown', () => {
    const result = getBlockMarkdown({
      content: '{"component_id":"position-sizer"}',
    })

    expect(result).toContain('Interactive component')
    expect(result).toContain('position-sizer')
  })

  it('converts stringified JSON chart payload to readable markdown', () => {
    const result = getBlockMarkdown({
      content: JSON.stringify({
        title: 'SPX Intraday',
        description: 'Observe support and resistance interactions.',
        annotations: [
          { label: 'Support', value: 4495 },
          { label: 'Resistance', value: 4525 },
        ],
      }),
    })

    expect(result).toContain('### SPX Intraday')
    expect(result).toContain('Observe support and resistance interactions.')
    expect(result).toContain('Support: 4495')
    expect(result).toContain('Resistance: 4525')
  })

  it('converts object content payload to readable markdown', () => {
    const result = getBlockMarkdown({
      content: {
        title: 'LEAPS Position Lifecycle',
        description: 'Track entry, roll, and exit decisions over time.',
      },
    })

    expect(result).toContain('### LEAPS Position Lifecycle')
    expect(result).toContain('Track entry, roll, and exit decisions over time.')
  })
})
