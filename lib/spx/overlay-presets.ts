export type SPXOverlayPreset = 'execution' | 'flow' | 'spatial'

export type SPXOverlayPresetState = {
  showLevels: boolean
  showCone: boolean
  showSpatialCoach: boolean
  showGEXGlow: boolean
}

export const SPX_OVERLAY_PRESET_STATE: Record<SPXOverlayPreset, SPXOverlayPresetState> = {
  execution: {
    showLevels: true,
    showCone: false,
    showSpatialCoach: false,
    showGEXGlow: false,
  },
  flow: {
    showLevels: true,
    showCone: false,
    showSpatialCoach: false,
    showGEXGlow: true,
  },
  spatial: {
    showLevels: true,
    showCone: true,
    showSpatialCoach: true,
    showGEXGlow: true,
  },
}

export function resolveOverlayPresetFromState(state: SPXOverlayPresetState): SPXOverlayPreset {
  if (state.showLevels && state.showCone && state.showSpatialCoach && state.showGEXGlow) {
    return 'spatial'
  }

  if (state.showLevels && !state.showCone && !state.showSpatialCoach && state.showGEXGlow) {
    return 'flow'
  }

  return 'execution'
}
