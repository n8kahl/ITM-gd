import { describe, expect, it } from 'vitest'

import { DEFAULT_SPX_UX_FLAGS, getEnabledSPXUXFlagKeys, getSPXUXFlags } from '@/lib/spx/flags'

describe('SPX UX flags', () => {
  it('uses the rollout baseline defaults', () => {
    expect(getSPXUXFlags()).toEqual(DEFAULT_SPX_UX_FLAGS)
  })

  it('allows explicit runtime overrides', () => {
    const flags = getSPXUXFlags({
      oneClickEntry: true,
      keyboardShortcuts: true,
      mobileFullTradeFocus: true,
      layoutStateMachine: false,
    })

    expect(flags.oneClickEntry).toBe(true)
    expect(flags.keyboardShortcuts).toBe(true)
    expect(flags.mobileFullTradeFocus).toBe(true)
    expect(flags.layoutStateMachine).toBe(false)
  })

  it('returns enabled flag keys only', () => {
    const enabled = getEnabledSPXUXFlagKeys({
      ...DEFAULT_SPX_UX_FLAGS,
      oneClickEntry: true,
      coachProactive: true,
      commandPalette: true,
    })

    expect(enabled).toEqual([
      'oneClickEntry',
      'mobileFullTradeFocus',
      'keyboardShortcuts',
      'layoutStateMachine',
      'mobileSmartStack',
      'coachProactive',
      'contextSplitV1',
      'commandPalette',
      'spatialHudV1',
      'coachDockV1',
      'coachAlertLifecycleV2',
      'coachTimelineV2',
      'coachMotionV1',
      'coachSurfaceV2',
    ])
  })
})
