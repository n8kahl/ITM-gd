import { describe, expect, it, vi } from 'vitest'
import type { WidgetAction } from '../widget-actions'
import { toTieredActions } from '../widget-action-bar'

const MockIcon = (() => null) as unknown as WidgetAction['icon']

describe('WidgetActionBarV2', () => {
  const quickActions: WidgetAction[] = [
    { label: 'Show on Chart', icon: MockIcon, variant: 'primary', action: vi.fn() },
    { label: 'Set Alert', icon: MockIcon, variant: 'secondary', action: vi.fn() },
  ]
  const overflowActions: WidgetAction[] = [
    { label: 'Copy', icon: MockIcon, variant: 'secondary', action: vi.fn() },
    { label: 'View Options', icon: MockIcon, variant: 'secondary', action: vi.fn() },
  ]

  it('keeps up to three actions visible and pushes remainder to overflow', () => {
    const tiered = toTieredActions([...quickActions, ...overflowActions])
    expect(tiered.quick.map((action) => action.label)).toEqual(['Show on Chart', 'Set Alert', 'Copy'])
    expect(tiered.overflow.map((action) => action.label)).toEqual(['View Options'])
  })

  it('prioritizes a primary action in quick actions', () => {
    const extra: WidgetAction = { label: 'Open Journal', icon: MockIcon, variant: 'secondary', action: vi.fn() }
    const tiered = toTieredActions([extra, ...quickActions, ...overflowActions])
    expect(tiered.quick[0]?.label).toBe('Show on Chart')
  })
})
