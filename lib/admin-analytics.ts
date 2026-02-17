export type AnalyticsPeriod = 'today' | '7d' | '30d' | '90d' | 'all'

export interface AdminAnalyticsPlatform {
  total_members: number
  new_members: number
  total_journal_entries: number
  ai_analysis_count: number
  ai_coach_sessions: number
  ai_coach_messages: number
  shared_trade_cards: number
  active_users: number
  active_learners: number
  pending_applications: number
}

export interface AdminAnalyticsMarketing {
  total_page_views: number
  unique_visitors: number
  total_clicks: number
  total_subscribers: number
  total_contacts: number
  conversion_rate: number
}

export interface DatedCountPoint {
  date: string
  count: number
}

export interface DatedViewsPoint {
  date: string
  views: number
}

export interface ConversionFunnel {
  modal_opened: number
  modal_closed: number
  form_submitted: number
  subscribed: number
}

export interface TopPage {
  path: string
  views: number
}

export interface RecentSubscriber {
  id: string
  name: string | null
  email: string
  phone: string | null
  instagram_handle: string | null
  twitter_handle: string | null
  created_at: string
}

export interface RecentContact {
  id: string
  name: string
  email: string
  message: string
  phone: string | null
  created_at: string
}

export interface RecentPageView {
  id: string
  session_id: string
  page_path: string
  referrer: string | null
  device_type: string | null
  browser: string | null
  os: string | null
  created_at: string
}

export interface RecentSale {
  id: string
  subscriber_name: string
  tier_name: string
  amount: string
  created_at: string
}

export interface AICoachActivity {
  session_id: string
  user_id: string
  user_name: string
  message_count: number
  created_at: string
}

export interface AdminAnalyticsResponse {
  period: AnalyticsPeriod
  platform: AdminAnalyticsPlatform
  marketing: AdminAnalyticsMarketing
  page_views_by_day: DatedViewsPoint[]
  conversions_by_day: DatedCountPoint[]
  conversion_funnel: ConversionFunnel
  device_breakdown: Record<string, number>
  browser_breakdown: Record<string, number>
  click_breakdown: Record<string, number>
  top_pages: TopPage[]
  recent_subscribers: RecentSubscriber[]
  recent_contacts: RecentContact[]
  recent_page_views: RecentPageView[]
  recent_sales: RecentSale[]
  ai_coach_activity: AICoachActivity[]
}

export function normalizeAnalyticsPeriod(input?: string | null): AnalyticsPeriod {
  switch ((input || '').toLowerCase()) {
    case 'today':
      return 'today'
    case '7d':
    case '7days':
      return '7d'
    case '30d':
    case '30days':
      return '30d'
    case '90d':
    case '90days':
      return '90d'
    case 'all':
      return 'all'
    default:
      return '30d'
  }
}

export function analyticsPeriodDays(period: AnalyticsPeriod): number {
  switch (period) {
    case 'today':
      return 1
    case '7d':
      return 7
    case '30d':
      return 30
    case '90d':
      return 90
    case 'all':
      return 36500
    default:
      return 30
  }
}

export function analyticsPeriodStartIso(period: AnalyticsPeriod): string | null {
  const now = new Date()

  if (period === 'all') {
    return null
  }

  if (period === 'today') {
    const startOfDayUtc = new Date(now)
    startOfDayUtc.setUTCHours(0, 0, 0, 0)
    return startOfDayUtc.toISOString()
  }

  const days = analyticsPeriodDays(period)
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return start.toISOString()
}
