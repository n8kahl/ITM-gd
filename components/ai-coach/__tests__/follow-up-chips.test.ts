import { describe, expect, it } from 'vitest'
import { buildFollowUps } from '../follow-up-chips'

describe('buildFollowUps', () => {
  it('returns schema-tied follow-up intents for structured trade responses', () => {
    const chips = buildFollowUps(
      [
        'Bias: Bullish above 6020.',
        'Setup: Opening-drive continuation.',
        'Entry: Reclaim 6020.25 with 5m close.',
        'Stop: 15m close below 5988.',
        'Targets: T1 6031, T2 6042.',
        'Invalidation: Lose 5988 on acceptance.',
        'Risk: Keep size small around event windows.',
        'Confidence: medium, 66%.',
      ].join('\n'),
      [
        {
          function: 'get_key_levels',
          arguments: { symbol: 'SPX' },
          result: { symbol: 'SPX' },
        },
      ] as any,
    )

    expect(chips.map((chip) => chip.label)).toEqual([
      'Refine Entry',
      'Stress-Test Stop',
      'Adjust Targets',
    ])
  })

  it('prioritizes clarify-before-commit intent for low-confidence structured responses', () => {
    const chips = buildFollowUps(
      [
        'Bias: Neutral.',
        'Setup: Range chop.',
        'Entry: Break 6020 for continuation.',
        'Stop: 15m close below 5988.',
        'Targets: T1 6030, T2 6040.',
        'Invalidation: Acceptance below 5988.',
        'Risk: Slippage risk is elevated.',
        'Confidence: low, 48%.',
      ].join('\n'),
      [
        {
          function: 'get_key_levels',
          arguments: { symbol: 'SPX' },
          result: { symbol: 'SPX' },
        },
      ] as any,
    )

    expect(chips[0]?.label).toBe('Clarify Before Commit')
    expect(chips.some((chip) => chip.label === 'Stress-Test Stop')).toBe(true)
  })

  it('keeps legacy symbol/context follow-ups when structured schema is absent', () => {
    const chips = buildFollowUps(
      'SPX is testing PDH with mixed breadth. Watch rejection versus reclaim.',
      [
        {
          function: 'get_key_levels',
          arguments: { symbol: 'SPX' },
          result: { symbol: 'SPX' },
        },
      ] as any,
    )

    const labels = chips.map((chip) => chip.label)
    expect(labels).toContain('Explain SPX Simply')
    expect(labels).toContain('SPX Game Plan')
  })
})
