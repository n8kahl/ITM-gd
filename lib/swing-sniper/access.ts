export const SWING_SNIPER_TAB_ID = 'swing-sniper'

export type SwingSniperTabLike = {
  tab_id: string
  is_active?: boolean
}

export function hasSwingSniperTabAccess(tabs: SwingSniperTabLike[]): boolean {
  return tabs.some((tab) => tab.tab_id === SWING_SNIPER_TAB_ID && tab.is_active !== false)
}
