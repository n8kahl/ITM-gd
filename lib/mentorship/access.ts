export const MENTORSHIP_TAB_ID = 'mentorship'

export type MentorshipTabLike = {
  tab_id: string
  is_active?: boolean
}

export function hasMentorshipTabAccess(tabs: MentorshipTabLike[]): boolean {
  return tabs.some((tab) => tab.tab_id === MENTORSHIP_TAB_ID && tab.is_active !== false)
}
