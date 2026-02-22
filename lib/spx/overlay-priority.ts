export type SPXOverlayPriorityTier = 'normal' | 'tight' | 'critical'

export type SPXOverlayFocusMode = 'decision' | 'execution' | 'risk_only'

export interface SPXLevelVisibilityBudget {
  nearWindowPoints: number
  nearLabelBudget: number
  maxTotalLabels: number
  minGapPoints: number
  pixelCollisionGap: number
}

export interface ResolveSPXOverlayPriorityPolicyInput {
  viewportWidth: number
  viewportHeight: number
  focusMode: SPXOverlayFocusMode
  spatialThrottled: boolean
  showCone: boolean
  showSpatialCoach: boolean
  showSpatialGhostCards: boolean
}

export interface SPXOverlayPriorityPolicy {
  tier: SPXOverlayPriorityTier
  rightSafeAreaPx: number
  bottomSafeAreaPx: number
  allowCone: boolean
  allowSpatialCoach: boolean
  allowGhostCards: boolean
  allowTopographicLadder: boolean
  levelVisibilityBudget: SPXLevelVisibilityBudget
}

const NORMAL_LEVEL_BUDGET: SPXLevelVisibilityBudget = {
  nearWindowPoints: 16,
  nearLabelBudget: 7,
  maxTotalLabels: 16,
  minGapPoints: 1.2,
  pixelCollisionGap: 16,
}

const TIGHT_LEVEL_BUDGET: SPXLevelVisibilityBudget = {
  nearWindowPoints: 13,
  nearLabelBudget: 5,
  maxTotalLabels: 12,
  minGapPoints: 1.45,
  pixelCollisionGap: 20,
}

const CRITICAL_LEVEL_BUDGET: SPXLevelVisibilityBudget = {
  nearWindowPoints: 10,
  nearLabelBudget: 4,
  maxTotalLabels: 8,
  minGapPoints: 1.8,
  pixelCollisionGap: 24,
}

function resolveTier(
  viewportWidth: number,
  viewportHeight: number,
  spatialThrottled: boolean,
): SPXOverlayPriorityTier {
  // Use post-sidebar viewport dimensions (already reduced by side rails/panels).
  // Keep default desktop Spatial HUD in normal tier; tighten only on genuinely constrained canvases.
  if (spatialThrottled || viewportWidth < 430 || viewportHeight < 340) return 'critical'
  if (viewportWidth < 480 || viewportHeight < 400) return 'tight'
  return 'normal'
}

export function resolveSPXOverlayPriorityPolicy(
  input: ResolveSPXOverlayPriorityPolicyInput,
): SPXOverlayPriorityPolicy {
  const tier = resolveTier(input.viewportWidth, input.viewportHeight, input.spatialThrottled)
  const isRiskOnly = input.focusMode === 'risk_only'

  const allowCone = Boolean(
    input.showCone
    && tier !== 'critical',
  )

  const allowSpatialCoach = Boolean(
    input.showSpatialCoach
    && !isRiskOnly
    && (tier !== 'critical' || input.focusMode === 'decision'),
  )

  const allowGhostCards = Boolean(
    allowSpatialCoach
    && input.showSpatialGhostCards
    && input.focusMode === 'decision'
    && tier === 'normal',
  )

  const baseBudget = tier === 'critical'
    ? CRITICAL_LEVEL_BUDGET
    : tier === 'tight'
      ? TIGHT_LEVEL_BUDGET
      : NORMAL_LEVEL_BUDGET

  const levelVisibilityBudget: SPXLevelVisibilityBudget = isRiskOnly
    ? {
      ...baseBudget,
      nearLabelBudget: Math.min(baseBudget.nearLabelBudget, 4),
      maxTotalLabels: Math.min(baseBudget.maxTotalLabels, 7),
      minGapPoints: Math.max(baseBudget.minGapPoints, 1.9),
      pixelCollisionGap: Math.max(baseBudget.pixelCollisionGap, 24),
    }
    : baseBudget

  return {
    tier,
    rightSafeAreaPx: tier === 'critical' ? 52 : tier === 'tight' ? 60 : 68,
    bottomSafeAreaPx: tier === 'critical' ? 112 : tier === 'tight' ? 116 : 124,
    allowCone,
    allowSpatialCoach,
    allowGhostCards,
    allowTopographicLadder: tier !== 'critical',
    levelVisibilityBudget,
  }
}
