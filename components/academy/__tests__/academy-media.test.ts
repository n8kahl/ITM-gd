import { describe, expect, it } from 'vitest'

import { getBlockMarkdown, resolveLessonImage, resolveModuleImage } from '@/components/academy/academy-media'

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

  it('normalizes scenario drill copy into readable markdown sections', () => {
    const result = getBlockMarkdown({
      markdown:
        'Scenario 1: Trader Goal - "Understand Alert Mechanics" A new trader needs context. → Path: Welcome → Reading the Alerts → Est. time: 8 hours. Checkpoint: Paper trade 2 alerts. Scenario 2: Trader Goal - "Build a Short Premium Strategy" Wants repeatable process. → Path: Options 101 → Risk Management → Est. time: 12 hours. Checkpoint: Complete 5 paper trades.',
    })

    expect(result).toContain('### Scenario 1')
    expect(result).toContain('### Scenario 2')
    expect(result).toContain('**Trader Goal:**')
    expect(result).toContain('**Path:**')
    expect(result).toContain('**Estimated time:**')
    expect(result).toContain('**Checkpoint:**')
  })
})

describe('academy media URL resolution', () => {
  it('falls back to inferred local image for unsafe external module media', () => {
    const result = resolveModuleImage({
      slug: 'risk-management',
      title: 'Risk Management',
      coverImageUrl: 'https://evil.example.com/track.png',
    })

    expect(result).toBe('/academy/illustrations/risk-sizing.svg')
  })

  it('accepts supabase-hosted lesson media URLs', () => {
    const result = resolveLessonImage({
      slug: 'welcome',
      title: 'Welcome',
      heroImageUrl: 'https://abc123.supabase.co/storage/v1/object/public/academy-media/lesson.png',
    })

    expect(result).toBe('https://abc123.supabase.co/storage/v1/object/public/academy-media/lesson.png')
  })
})
