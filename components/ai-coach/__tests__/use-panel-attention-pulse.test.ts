import { describe, expect, it } from 'vitest'
import { resolvePanelAttentionLabel } from '@/hooks/use-panel-attention-pulse'

describe('resolvePanelAttentionLabel', () => {
  it('maps widget and chart events to user-facing labels', () => {
    expect(resolvePanelAttentionLabel('ai-coach-widget-chart')).toBe('Chart updated')
    expect(resolvePanelAttentionLabel('ai-coach-widget-options')).toBe('Options loaded')
    expect(resolvePanelAttentionLabel('ai-coach-widget-alert')).toBe('Alert panel open')
    expect(resolvePanelAttentionLabel('ai-coach-widget-analyze')).toBe('Analyzing position')
    expect(resolvePanelAttentionLabel('ai-coach-widget-view')).toBe('View changed')
    expect(resolvePanelAttentionLabel('ai-coach-show-chart')).toBe('Chart updated')
  })

  it('returns null for unsupported events', () => {
    expect(resolvePanelAttentionLabel('ai-coach-widget-chat')).toBeNull()
    expect(resolvePanelAttentionLabel('totally-custom-event')).toBeNull()
  })
})
