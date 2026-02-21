export type SPXCommandSource = 'command_palette' | 'keyboard_shortcut' | 'action_strip'

export type SPXCommandId =
  | 'select-top-setup'
  | 'cycle-next-setup'
  | 'cycle-prev-setup'
  | 'select-current-setup'
  | 'deselect-setup'
  | 'enter-trade-focus'
  | 'exit-trade-focus'
  | 'toggle-level-overlay'
  | 'toggle-flow-panel'
  | 'toggle-immersive'
  | 'toggle-sidebar'
  | 'toggle-spatial-coach'
  | 'toggle-probability-cone'
  | 'toggle-gex-glow'
  | 'toggle-view-mode'
  | 'toggle-replay'
  | 'toggle-replay-playback'
  | 'cycle-replay-window'
  | 'cycle-replay-speed'
  | 'focus-mode-decision'
  | 'focus-mode-execution'
  | 'focus-mode-risk-only'
  | 'show-shortcuts-help'
  | 'hide-shortcuts-help'
  | 'coach-risk-check'
  | 'coach-exit-strategy'
  | 'coach-quick-action-1'
  | 'coach-quick-action-2'
  | 'coach-quick-action-3'
  | 'coach-quick-action-4'

export type SPXCommandGroup = 'Setups' | 'Execution' | 'View' | 'Overlays' | 'Replay' | 'Coach' | 'Help'

export const SPX_KEYBOARD_COMMAND_BINDINGS: Partial<Record<string, SPXCommandId>> = {
  l: 'toggle-level-overlay',
  f: 'toggle-flow-panel',
  i: 'toggle-immersive',
  s: 'toggle-sidebar',
  a: 'toggle-spatial-coach',
  c: 'toggle-probability-cone',
  g: 'toggle-gex-glow',
  v: 'toggle-view-mode',
  r: 'toggle-replay',
  p: 'toggle-replay-playback',
}

type OverlayBlockedMeta = {
  overlay: 'immersive' | 'sidebar' | 'coach' | 'cone' | 'gex'
  blockedAction: string
}

export const SPX_OVERLAY_BLOCKED_META: Partial<Record<SPXCommandId, OverlayBlockedMeta>> = {
  'toggle-immersive': {
    overlay: 'immersive',
    blockedAction: 'toggle_immersive_blocked',
  },
  'toggle-sidebar': {
    overlay: 'sidebar',
    blockedAction: 'toggle_sidebar_blocked',
  },
  'toggle-spatial-coach': {
    overlay: 'coach',
    blockedAction: 'toggle_spatial_coach_blocked',
  },
  'toggle-probability-cone': {
    overlay: 'cone',
    blockedAction: 'toggle_cone_blocked',
  },
  'toggle-gex-glow': {
    overlay: 'gex',
    blockedAction: 'toggle_gex_glow_blocked',
  },
}
