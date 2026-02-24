import { describe, expect, it, vi } from 'vitest'
import type { WidgetAction } from '../widget-actions'
import { toTieredActions } from '../widget-action-bar'

const MockIcon = (() => null) as unknown as WidgetAction['icon']

function action(label: string, variant: WidgetAction['variant'] = 'secondary'): WidgetAction {
  return { label, icon: MockIcon, variant, action: vi.fn() }
}

describe('WidgetActionBar quick-tier policy', () => {
  it('keeps primary action first', () => {
    const tiered = toTieredActions([
      action('Open Journal'),
      action('Show on Chart', 'primary'),
      action('Risk Plan'),
      action('Explain Simply'),
    ])
    expect(tiered.quick[0]?.label).toBe('Show on Chart')
  })

  it('keeps View Options visible when present', () => {
    const tiered = toTieredActions([
      action('Show on Chart', 'primary'),
      action('Risk Plan'),
      action('Explain Simply'),
      action('View Options'),
      action('Ask AI'),
    ])
    expect(tiered.quick.map((item) => item.label)).toContain('View Options')
  })

  it('keeps Set Alert visible when no Analyze action exists', () => {
    const tiered = toTieredActions([
      action('Show on Chart', 'primary'),
      action('Risk Plan'),
      action('Explain Simply'),
      action('Set Alert'),
      action('Ask AI'),
    ])
    expect(tiered.quick.map((item) => item.label)).toContain('Set Alert')
  })

  it('keeps Analyze visible when present', () => {
    const tiered = toTieredActions([
      action('Show on Chart', 'primary'),
      action('Risk Plan'),
      action('View Options'),
      action('Analyze'),
      action('Ask AI'),
      action('Copy'),
    ])
    expect(tiered.quick.map((item) => item.label)).toContain('Analyze')
  })
})
