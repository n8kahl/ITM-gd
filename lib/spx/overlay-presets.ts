export type SPXOverlayPreset = 'execution' | 'flow' | 'spatial'

export type SPXOverlayPresetState = {
  showCone: boolean
  showSpatialCoach: boolean
  showGEXGlow: boolean
}

export const SPX_OVERLAY_PRESET_STATE: Record<SPXOverlayPreset, SPXOverlayPresetState> = {
  execution: {
    showCone: false,
    showSpatialCoach: false,
    showGEXGlow: false,
  },
  flow: {
    showCone: false,
    showSpatialCoach: false,
    showGEXGlow: true,
  },
  spatial: {
    showCone: true,
    showSpatialCoach: true,
    showGEXGlow: true,
  },
}

export function resolveOverlayPresetFromState(state: SPXOverlayPresetState): SPXOverlayPreset {
  if (state.showCone && state.showSpatialCoach && state.showGEXGlow) {
    return 'spatial'
  }

  if (!state.showCone && !state.showSpatialCoach && state.showGEXGlow) {
    return 'flow'
  }

  return 'execution'
}
