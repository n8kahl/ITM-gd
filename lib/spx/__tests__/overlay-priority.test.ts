import { describe, expect, it } from 'vitest'
import { resolveSPXOverlayPriorityPolicy } from '@/lib/spx/overlay-priority'

describe('overlay priority policy', () => {
  it('keeps full overlays in normal decision tier', () => {
    const policy = resolveSPXOverlayPriorityPolicy({
      viewportWidth: 1500,
      viewportHeight: 860,
      focusMode: 'decision',
      spatialThrottled: false,
      showCone: true,
      showSpatialCoach: true,
      showSpatialGhostCards: true,
    })

    expect(policy.tier).toBe('normal')
    expect(policy.allowCone).toBe(true)
    expect(policy.allowSpatialCoach).toBe(true)
    expect(policy.allowGhostCards).toBe(true)
    expect(policy.levelVisibilityBudget.maxTotalLabels).toBe(16)
  })

  it('suppresses ghost cards and tightens label budget in tight tier', () => {
    const policy = resolveSPXOverlayPriorityPolicy({
      viewportWidth: 1180,
      viewportHeight: 720,
      focusMode: 'execution',
      spatialThrottled: false,
      showCone: true,
      showSpatialCoach: true,
      showSpatialGhostCards: true,
    })

    expect(policy.tier).toBe('tight')
    expect(policy.allowCone).toBe(true)
    expect(policy.allowSpatialCoach).toBe(true)
    expect(policy.allowGhostCards).toBe(false)
    expect(policy.levelVisibilityBudget.maxTotalLabels).toBe(12)
  })

  it('prioritizes risk clarity in critical tier', () => {
    const policy = resolveSPXOverlayPriorityPolicy({
      viewportWidth: 1000,
      viewportHeight: 560,
      focusMode: 'risk_only',
      spatialThrottled: false,
      showCone: true,
      showSpatialCoach: true,
      showSpatialGhostCards: true,
    })

    expect(policy.tier).toBe('critical')
    expect(policy.allowCone).toBe(false)
    expect(policy.allowSpatialCoach).toBe(false)
    expect(policy.allowGhostCards).toBe(false)
    expect(policy.allowTopographicLadder).toBe(false)
    expect(policy.levelVisibilityBudget.maxTotalLabels).toBeLessThanOrEqual(7)
    expect(policy.levelVisibilityBudget.pixelCollisionGap).toBeGreaterThanOrEqual(24)
  })

  it('keeps coach while dropping cone in critical decision tier', () => {
    const policy = resolveSPXOverlayPriorityPolicy({
      viewportWidth: 1060,
      viewportHeight: 640,
      focusMode: 'decision',
      spatialThrottled: true,
      showCone: true,
      showSpatialCoach: true,
      showSpatialGhostCards: true,
    })

    expect(policy.tier).toBe('critical')
    expect(policy.allowCone).toBe(false)
    expect(policy.allowSpatialCoach).toBe(true)
    expect(policy.allowGhostCards).toBe(false)
  })
})
