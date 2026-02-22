import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SPX_UX_FLAGS,
  getEnabledSPXUXFlagKeys,
  getSPXUXFlagCatalog,
  getSPXUXFlagMetadataCoverageGaps,
  getSPXUXFlags,
} from '@/lib/spx/flags'

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
      'setupRealtimeAlertsV1',
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

  it('has lifecycle metadata for every flag', () => {
    expect(getSPXUXFlagMetadataCoverageGaps()).toEqual([])
    const catalog = getSPXUXFlagCatalog(DEFAULT_SPX_UX_FLAGS)
    expect(catalog.length).toBe(Object.keys(DEFAULT_SPX_UX_FLAGS).length)
    expect(catalog.every((entry) => entry.metadata.owner.length > 0)).toBe(true)
  })
})
