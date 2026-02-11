/**
 * Push notification types for admin broadcast system.
 *
 * Payload shape matches what public/sw.js expects in its
 * `push` event listener (title, body, icon, badge, url, tag, requireInteraction).
 */

// -------------------------------------------------------------------
// Payload sent to the browser push service (received by SW)
// -------------------------------------------------------------------

export interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  url?: string
  tag?: string
  requireInteraction?: boolean
}

// -------------------------------------------------------------------
// Broadcast record stored in notification_broadcasts table
// -------------------------------------------------------------------

export type BroadcastTargetType = 'all' | 'tier' | 'individual'
export type BroadcastStatus = 'draft' | 'sending' | 'sent' | 'failed' | 'scheduled'

export interface NotificationBroadcast {
  id: string
  title: string
  body: string
  url: string | null
  tag: string | null
  require_interaction: boolean
  target_type: BroadcastTargetType
  target_tiers: string[] | null
  target_user_ids: string[] | null
  status: BroadcastStatus
  scheduled_at: string | null
  sent_at: string | null
  delivered_count: number
  failed_count: number
  total_targeted: number
  created_by: string
  created_at: string
  updated_at: string
}

// -------------------------------------------------------------------
// API request / response shapes
// -------------------------------------------------------------------

export interface SendNotificationRequest {
  title: string
  body: string
  url?: string
  tag?: string
  requireInteraction?: boolean
  targetType: BroadcastTargetType
  targetTiers?: string[]
  targetUserIds?: string[]
  scheduleAt?: string // ISO 8601
}

export interface BroadcastListResponse {
  success: boolean
  data: NotificationBroadcast[]
  total: number
  error?: string
}

export interface SendNotificationResponse {
  success: boolean
  data?: NotificationBroadcast
  stats?: {
    targeted: number
    delivered: number
    failed: number
  }
  error?: string
}

// -------------------------------------------------------------------
// User search result for individual targeting
// -------------------------------------------------------------------

export interface TargetableUser {
  user_id: string
  discord_username: string | null
  discord_avatar: string | null
  discord_user_id: string | null
  has_subscription: boolean
}
