export interface CannedResponse {
  label: string
  shortcut: string
  text: string
}

export interface PricingTierApiRow {
  id: string
  monthly_price: string
}

export interface Conversation {
  id: string
  visitor_id: string
  visitor_name: string | null
  visitor_email: string | null
  status: string
  ai_handled: boolean
  escalation_reason: string | null
  lead_score: number | null
  last_message_at: string
  created_at: string
  metadata: Record<string, unknown>
}

export interface Message {
  id: string
  conversation_id: string
  sender_type: string
  sender_name: string
  message_text: string
  image_url: string | null
  ai_generated: boolean
  ai_confidence: number | null
  created_at: string
}

export interface ChatStats {
  total: number
  active: number
  resolved: number
  archived: number
  escalated: number
}

export const DEFAULT_CANNED_RESPONSES: CannedResponse[] = [
  {
    label: 'Pricing Overview',
    shortcut: '/pricing',
    text: `Our membership tiers:

• **Core Tier ({{core_price}}/mo)**: SPX day trades, morning watchlist, high-volume alerts
• **Pro Tier ({{pro_price}}/mo)**: Everything in Core + LEAPS, advanced swing trades
• **Executive Tier ({{exec_price}}/mo)**: Everything in Pro + NDX alerts, high-conviction LEAPS

All sales are final. Refunds are not required under our Refund Policy.`
  },
  {
    label: 'Trade Alert Details',
    shortcut: '/stats',
    text: `Our educational trade alerts typically include:

• Structured setups with entries, invalidation levels, and take-profit planning
• 1-3 alerts daily during market hours (9:30am-4pm ET)
• Exact entries, stop losses, and take profits when a setup is published
• Educational commentary and market context around the setup

Trading involves substantial risk of loss. Past performance does not guarantee future results.`
  },
  {
    label: 'How to Join',
    shortcut: '/join',
    text: `Here's how to get started:

1. Choose your tier at tradeitm.com
2. Complete checkout via LaunchPass
3. Join our Discord community (invite sent automatically)
4. Start receiving alerts immediately!

Questions about which tier is right for you?`
  },
  {
    label: 'Billing & Refund Policy',
    shortcut: '/refund',
    text: `All sales are final. Trade In The Money is not obligated to issue refunds.

Any exception is discretionary and does not create an entitlement to a refund.`
  },
  {
    label: 'Executive Tier Details',
    shortcut: '/executive',
    text: `Executive Tier ({{exec_price}}/mo) is our premium tier for serious traders:

• Real-time NDX alerts (our highest-conviction setups)
• High-conviction LEAPS positions
• Advanced trade commentary & risk scaling education
• Priority support from our team

This tier is designed for traders with larger accounts looking to maximize returns.`
  }
]

export const DEFAULT_PRICE_MAP = {
  core_price: '$199',
  pro_price: '$299',
  exec_price: '$499',
}

export function normalizePrice(rawPrice: string | null | undefined): string | null {
  if (!rawPrice) return null
  return rawPrice.startsWith('$') ? rawPrice : `$${rawPrice}`
}

export function resolveCannedResponseTemplates(
  templates: CannedResponse[],
  priceMap: Record<'core_price' | 'pro_price' | 'exec_price', string>
): CannedResponse[] {
  return templates.map((template) => ({
    ...template,
    text: template.text
      .replaceAll('$199/mo', '{{core_price}}/mo')
      .replaceAll('$299/mo', '{{pro_price}}/mo')
      .replaceAll('$499/mo', '{{exec_price}}/mo')
      .replaceAll('$199', '{{core_price}}')
      .replaceAll('$299', '{{pro_price}}')
      .replaceAll('$499', '{{exec_price}}')
      .replaceAll('{{core_price}}', priceMap.core_price)
      .replaceAll('{{pro_price}}', priceMap.pro_price)
      .replaceAll('{{exec_price}}', priceMap.exec_price),
  }))
}

export function getAdminSessionId(): string {
  if (typeof window === 'undefined') return 'admin-ssr'

  let sessionId = sessionStorage.getItem('admin_session_id')
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    sessionStorage.setItem('admin_session_id', sessionId)
  }
  return sessionId
}
