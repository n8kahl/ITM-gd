function readBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name]
  if (value == null) return fallback
  const normalized = value.trim().toLowerCase()
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') return true
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') return false
  return fallback
}

const uiDefaultEnabled = process.env.NODE_ENV !== 'production'

export const SPX_FEATURE_FLAGS = {
  briefingBarV1: readBoolean('NEXT_PUBLIC_SPX_BRIEFING_BAR_V1', uiDefaultEnabled),
  actionStripV1: readBoolean('NEXT_PUBLIC_SPX_ACTION_STRIP_V1', uiDefaultEnabled),
  twoTierLayoutV1: readBoolean('NEXT_PUBLIC_SPX_TWO_TIER_LAYOUT_V1', false),
  setupCardV2: readBoolean('NEXT_PUBLIC_SPX_SETUP_CARD_V2', uiDefaultEnabled),
  flowV2: readBoolean('NEXT_PUBLIC_SPX_FLOW_V2', uiDefaultEnabled),
  levelMapV2: readBoolean('NEXT_PUBLIC_SPX_LEVEL_MAP_V2', false),
  coachV2: readBoolean('NEXT_PUBLIC_SPX_COACH_V2', false),
  mobileBriefV1: readBoolean('NEXT_PUBLIC_SPX_MOBILE_BRIEF_V1', false),
} as const

export type SPXFeatureFlagKey = keyof typeof SPX_FEATURE_FLAGS
