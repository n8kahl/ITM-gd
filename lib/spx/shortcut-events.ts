export const SPX_SHORTCUT_EVENT = {
  FLOW_TOGGLE: 'spx:flow-toggle-shortcut',
  COACH_QUICK_ACTION: 'spx:coach-quick-action',
} as const

export interface SPXCoachQuickActionEventDetail {
  index: number
  source?: 'keyboard' | 'ui'
}
