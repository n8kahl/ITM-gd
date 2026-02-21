'use client'

export interface SPXUXFlags {
  oneClickEntry: boolean
  mobileFullTradeFocus: boolean
  keyboardShortcuts: boolean
  layoutStateMachine: boolean
  mobileSmartStack: boolean
  coachProactive: boolean
  contextSplitV1: boolean
  commandPalette: boolean
  spatialHudV1: boolean
  spatialCoachGhostCards: boolean
  coachDockV1: boolean
  coachAlertLifecycleV2: boolean
  coachTimelineV2: boolean
  coachMotionV1: boolean
  coachDecisionV2: boolean
  coachSurfaceV2: boolean
  coachHistoryDrawerV1: boolean
  coachMemoryV1: boolean
  coachTrustSignalsV1: boolean
}

export interface SPXUXFlagLifecycleMetadata {
  owner: string
  rolloutStage: 'ga' | 'beta' | 'experiment' | 'retiring'
  createdOn: string
  reviewBy: string
  removalCondition: string
}

export const DEFAULT_SPX_UX_FLAGS: Readonly<SPXUXFlags> = Object.freeze({
  oneClickEntry: true,
  mobileFullTradeFocus: true,
  keyboardShortcuts: true,
  layoutStateMachine: true,
  mobileSmartStack: true,
  coachProactive: true,
  contextSplitV1: true,
  commandPalette: true,
  spatialHudV1: true,
  spatialCoachGhostCards: false,
  coachDockV1: true,
  coachAlertLifecycleV2: true,
  coachTimelineV2: true,
  coachMotionV1: true,
  coachDecisionV2: false,
  coachSurfaceV2: true,
  coachHistoryDrawerV1: false,
  coachMemoryV1: false,
  coachTrustSignalsV1: false,
})

export const SPX_UX_FLAG_METADATA: Readonly<Record<keyof SPXUXFlags, SPXUXFlagLifecycleMetadata>> = Object.freeze({
  oneClickEntry: {
    owner: 'spx-execution',
    rolloutStage: 'ga',
    createdOn: '2026-02-20',
    reviewBy: '2026-03-20',
    removalCondition: 'Retire when trade focus is entirely command-driven.',
  },
  mobileFullTradeFocus: {
    owner: 'spx-mobile',
    rolloutStage: 'ga',
    createdOn: '2026-02-20',
    reviewBy: '2026-03-20',
    removalCondition: 'Remove when mobile state machine no longer has fallback mode.',
  },
  keyboardShortcuts: {
    owner: 'spx-execution',
    rolloutStage: 'ga',
    createdOn: '2026-02-20',
    reviewBy: '2026-04-01',
    removalCondition: 'Keep unless replaced by universal command engine.',
  },
  layoutStateMachine: {
    owner: 'spx-platform',
    rolloutStage: 'ga',
    createdOn: '2026-02-20',
    reviewBy: '2026-04-01',
    removalCondition: 'Remove once legacy layout path is deleted.',
  },
  mobileSmartStack: {
    owner: 'spx-mobile',
    rolloutStage: 'beta',
    createdOn: '2026-02-20',
    reviewBy: '2026-03-15',
    removalCondition: 'Promote to GA when tabbed fallback usage stays under 5%.',
  },
  coachProactive: {
    owner: 'spx-coach',
    rolloutStage: 'ga',
    createdOn: '2026-02-20',
    reviewBy: '2026-04-01',
    removalCondition: 'Retire if proactive channel is merged into decision briefs.',
  },
  contextSplitV1: {
    owner: 'spx-platform',
    rolloutStage: 'ga',
    createdOn: '2026-02-20',
    reviewBy: '2026-03-20',
    removalCondition: 'Delete after context split implementation is permanently default.',
  },
  commandPalette: {
    owner: 'spx-execution',
    rolloutStage: 'ga',
    createdOn: '2026-02-20',
    reviewBy: '2026-04-01',
    removalCondition: 'Remove only if command palette is replaced globally.',
  },
  spatialHudV1: {
    owner: 'spx-visual',
    rolloutStage: 'beta',
    createdOn: '2026-02-20',
    reviewBy: '2026-03-10',
    removalCondition: 'Promote to GA after performance and conversion targets are met.',
  },
  spatialCoachGhostCards: {
    owner: 'spx-visual',
    rolloutStage: 'experiment',
    createdOn: '2026-02-21',
    reviewBy: '2026-03-10',
    removalCondition: 'Promote only after ghost signal quality and noise metrics meet runbook thresholds.',
  },
  coachDockV1: {
    owner: 'spx-coach',
    rolloutStage: 'ga',
    createdOn: '2026-02-20',
    reviewBy: '2026-04-01',
    removalCondition: 'Retire when coach dock interactions are merged into persistent rail.',
  },
  coachAlertLifecycleV2: {
    owner: 'spx-coach',
    rolloutStage: 'ga',
    createdOn: '2026-02-20',
    reviewBy: '2026-04-01',
    removalCondition: 'Retire only if alert lifecycle becomes server-native.',
  },
  coachTimelineV2: {
    owner: 'spx-coach',
    rolloutStage: 'ga',
    createdOn: '2026-02-20',
    reviewBy: '2026-04-01',
    removalCondition: 'Remove when timeline is baseline and no legacy view remains.',
  },
  coachMotionV1: {
    owner: 'spx-visual',
    rolloutStage: 'ga',
    createdOn: '2026-02-20',
    reviewBy: '2026-04-01',
    removalCondition: 'Retire when motion primitives become shared platform defaults.',
  },
  coachDecisionV2: {
    owner: 'spx-coach',
    rolloutStage: 'experiment',
    createdOn: '2026-02-20',
    reviewBy: '2026-03-08',
    removalCondition: 'Promote or remove based on decision action conversion uplift.',
  },
  coachSurfaceV2: {
    owner: 'spx-coach',
    rolloutStage: 'ga',
    createdOn: '2026-02-20',
    reviewBy: '2026-04-01',
    removalCondition: 'Retire when surface v3 replaces this panel contract.',
  },
  coachHistoryDrawerV1: {
    owner: 'spx-coach',
    rolloutStage: 'experiment',
    createdOn: '2026-02-20',
    reviewBy: '2026-03-10',
    removalCondition: 'Remove if open-rate fails threshold against inline history.',
  },
  coachMemoryV1: {
    owner: 'spx-coach',
    rolloutStage: 'experiment',
    createdOn: '2026-02-20',
    reviewBy: '2026-03-10',
    removalCondition: 'Retire if memory summaries are moved server-side.',
  },
  coachTrustSignalsV1: {
    owner: 'spx-coach',
    rolloutStage: 'experiment',
    createdOn: '2026-02-20',
    reviewBy: '2026-03-10',
    removalCondition: 'Promote only after trust-signal fidelity review is complete.',
  },
})

const FLAG_ENV_KEYS: Record<keyof SPXUXFlags, string[]> = {
  oneClickEntry: ['NEXT_PUBLIC_SPX_UX_ONE_CLICK_ENTRY', 'SPX_UX_ONE_CLICK_ENTRY'],
  mobileFullTradeFocus: ['NEXT_PUBLIC_SPX_UX_MOBILE_FULL_TRADE_FOCUS', 'SPX_UX_MOBILE_FULL_TRADE_FOCUS'],
  keyboardShortcuts: ['NEXT_PUBLIC_SPX_UX_KEYBOARD_SHORTCUTS', 'SPX_UX_KEYBOARD_SHORTCUTS'],
  layoutStateMachine: ['NEXT_PUBLIC_SPX_UX_LAYOUT_STATE_MACHINE', 'SPX_UX_LAYOUT_STATE_MACHINE'],
  mobileSmartStack: ['NEXT_PUBLIC_SPX_UX_MOBILE_SMART_STACK', 'SPX_UX_MOBILE_SMART_STACK'],
  coachProactive: ['NEXT_PUBLIC_SPX_UX_COACH_PROACTIVE', 'SPX_UX_COACH_PROACTIVE'],
  contextSplitV1: ['NEXT_PUBLIC_SPX_UX_CONTEXT_SPLIT_V1', 'SPX_UX_CONTEXT_SPLIT_V1'],
  commandPalette: ['NEXT_PUBLIC_SPX_UX_COMMAND_PALETTE', 'SPX_UX_COMMAND_PALETTE'],
  spatialHudV1: ['NEXT_PUBLIC_SPX_UX_SPATIAL_HUD_V1', 'SPX_UX_SPATIAL_HUD_V1'],
  spatialCoachGhostCards: ['NEXT_PUBLIC_SPX_UX_SPATIAL_COACH_GHOST_CARDS', 'SPX_UX_SPATIAL_COACH_GHOST_CARDS'],
  coachDockV1: ['NEXT_PUBLIC_SPX_UX_COACH_DOCK_V1', 'SPX_UX_COACH_DOCK_V1'],
  coachAlertLifecycleV2: ['NEXT_PUBLIC_SPX_UX_COACH_ALERT_LIFECYCLE_V2', 'SPX_UX_COACH_ALERT_LIFECYCLE_V2'],
  coachTimelineV2: ['NEXT_PUBLIC_SPX_UX_COACH_TIMELINE_V2', 'SPX_UX_COACH_TIMELINE_V2'],
  coachMotionV1: ['NEXT_PUBLIC_SPX_UX_COACH_MOTION_V1', 'SPX_UX_COACH_MOTION_V1'],
  coachDecisionV2: ['NEXT_PUBLIC_SPX_UX_COACH_DECISION_V2', 'SPX_UX_COACH_DECISION_V2'],
  coachSurfaceV2: ['NEXT_PUBLIC_SPX_UX_COACH_SURFACE_V2', 'SPX_UX_COACH_SURFACE_V2'],
  coachHistoryDrawerV1: ['NEXT_PUBLIC_SPX_UX_COACH_HISTORY_DRAWER_V1', 'SPX_UX_COACH_HISTORY_DRAWER_V1'],
  coachMemoryV1: ['NEXT_PUBLIC_SPX_UX_COACH_MEMORY_V1', 'SPX_UX_COACH_MEMORY_V1'],
  coachTrustSignalsV1: ['NEXT_PUBLIC_SPX_UX_COACH_TRUST_SIGNALS_V1', 'SPX_UX_COACH_TRUST_SIGNALS_V1'],
}

function parseBooleanFlag(value: string | undefined): boolean | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false
  return null
}

function resolveFlagFromEnv(flag: keyof SPXUXFlags): boolean | null {
  const envKeys = FLAG_ENV_KEYS[flag]
  for (const key of envKeys) {
    const parsed = parseBooleanFlag(process.env[key])
    if (parsed != null) return parsed
  }
  return null
}

function resolveWindowOverrides(): Partial<SPXUXFlags> {
  if (typeof window === 'undefined') return {}
  const candidate = window.__spxUxFlags
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return {}
  return candidate
}

export function getSPXUXFlags(overrides?: Partial<SPXUXFlags>): SPXUXFlags {
  const envResolved: SPXUXFlags = {
    oneClickEntry: resolveFlagFromEnv('oneClickEntry') ?? DEFAULT_SPX_UX_FLAGS.oneClickEntry,
    mobileFullTradeFocus: resolveFlagFromEnv('mobileFullTradeFocus') ?? DEFAULT_SPX_UX_FLAGS.mobileFullTradeFocus,
    keyboardShortcuts: resolveFlagFromEnv('keyboardShortcuts') ?? DEFAULT_SPX_UX_FLAGS.keyboardShortcuts,
    layoutStateMachine: resolveFlagFromEnv('layoutStateMachine') ?? DEFAULT_SPX_UX_FLAGS.layoutStateMachine,
    mobileSmartStack: resolveFlagFromEnv('mobileSmartStack') ?? DEFAULT_SPX_UX_FLAGS.mobileSmartStack,
    coachProactive: resolveFlagFromEnv('coachProactive') ?? DEFAULT_SPX_UX_FLAGS.coachProactive,
    contextSplitV1: resolveFlagFromEnv('contextSplitV1') ?? DEFAULT_SPX_UX_FLAGS.contextSplitV1,
    commandPalette: resolveFlagFromEnv('commandPalette') ?? DEFAULT_SPX_UX_FLAGS.commandPalette,
    spatialHudV1: resolveFlagFromEnv('spatialHudV1') ?? DEFAULT_SPX_UX_FLAGS.spatialHudV1,
    spatialCoachGhostCards: resolveFlagFromEnv('spatialCoachGhostCards') ?? DEFAULT_SPX_UX_FLAGS.spatialCoachGhostCards,
    coachDockV1: resolveFlagFromEnv('coachDockV1') ?? DEFAULT_SPX_UX_FLAGS.coachDockV1,
    coachAlertLifecycleV2: resolveFlagFromEnv('coachAlertLifecycleV2') ?? DEFAULT_SPX_UX_FLAGS.coachAlertLifecycleV2,
    coachTimelineV2: resolveFlagFromEnv('coachTimelineV2') ?? DEFAULT_SPX_UX_FLAGS.coachTimelineV2,
    coachMotionV1: resolveFlagFromEnv('coachMotionV1') ?? DEFAULT_SPX_UX_FLAGS.coachMotionV1,
    coachDecisionV2: resolveFlagFromEnv('coachDecisionV2') ?? DEFAULT_SPX_UX_FLAGS.coachDecisionV2,
    coachSurfaceV2: resolveFlagFromEnv('coachSurfaceV2') ?? DEFAULT_SPX_UX_FLAGS.coachSurfaceV2,
    coachHistoryDrawerV1: resolveFlagFromEnv('coachHistoryDrawerV1') ?? DEFAULT_SPX_UX_FLAGS.coachHistoryDrawerV1,
    coachMemoryV1: resolveFlagFromEnv('coachMemoryV1') ?? DEFAULT_SPX_UX_FLAGS.coachMemoryV1,
    coachTrustSignalsV1: resolveFlagFromEnv('coachTrustSignalsV1') ?? DEFAULT_SPX_UX_FLAGS.coachTrustSignalsV1,
  }

  return {
    ...envResolved,
    ...resolveWindowOverrides(),
    ...(overrides || {}),
  }
}

export function getEnabledSPXUXFlagKeys(flags: SPXUXFlags): Array<keyof SPXUXFlags> {
  return (Object.keys(flags) as Array<keyof SPXUXFlags>).filter((key) => flags[key])
}

export function getSPXUXFlagMetadataCoverageGaps(): Array<keyof SPXUXFlags> {
  const keys = Object.keys(DEFAULT_SPX_UX_FLAGS) as Array<keyof SPXUXFlags>
  return keys.filter((key) => !SPX_UX_FLAG_METADATA[key])
}

export function getSPXUXFlagCatalog(flags: SPXUXFlags): Array<{
  key: keyof SPXUXFlags
  enabled: boolean
  metadata: SPXUXFlagLifecycleMetadata
}> {
  return (Object.keys(flags) as Array<keyof SPXUXFlags>).map((key) => ({
    key,
    enabled: Boolean(flags[key]),
    metadata: SPX_UX_FLAG_METADATA[key],
  }))
}

declare global {
  interface Window {
    __spxUxFlags?: Partial<SPXUXFlags>
  }
}
