export const SPX_SHORTCUT_EVENT = {
  FLOW_TOGGLE: 'spx:flow-toggle-shortcut',
  COACH_QUICK_ACTION: 'spx:coach-quick-action',
  COACH_OPEN_DETAILS: 'spx:coach-open-details',
} as const

export interface SPXCoachQuickActionEventDetail {
  index: number
  source?: 'keyboard' | 'ui' | 'command_palette'
}

export interface SPXCoachOpenDetailsEventDetail {
  messageId?: string
  setupId?: string | null
  source?: 'spatial_node' | 'ui' | 'keyboard'
}
