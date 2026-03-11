export const MONEY_MAKER_TAB_ID = 'money-maker'

export type MoneyMakerTabLike = {
  tab_id: string
  is_active?: boolean
}

export function hasMoneyMakerTabAccess(tabs: MoneyMakerTabLike[]): boolean {
  return tabs.some((tab) => tab.tab_id === MONEY_MAKER_TAB_ID && tab.is_active !== false)
}
