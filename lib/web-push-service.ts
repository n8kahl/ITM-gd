/**
 * Server-side push notification delivery using VAPID / web-push.
 *
 * Usage:
 *   import { initWebPush, sendBatchNotifications } from '@/lib/web-push-service'
 *
 * Requires env vars: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 */

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import type { NotificationPayload } from '@/lib/types/notifications'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

let vapidInitialised = false

export function initWebPush() {
  if (vapidInitialised) return

  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@tradeitm.com'

  if (!publicKey || !privateKey) {
    console.warn('[web-push] VAPID keys not configured — push delivery disabled')
    return
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidInitialised = true
}

// ---------------------------------------------------------------------------
// Single subscription delivery
// ---------------------------------------------------------------------------

interface DeliveryResult {
  subscriptionId: string
  success: boolean
  expired?: boolean
  error?: string
}

/**
 * Send a push notification to one subscription.
 * Returns `{ expired: true }` when the endpoint responds with 410 Gone.
 */
export async function sendToSubscription(
  subscriptionId: string,
  subscriptionData: webpush.PushSubscription,
  payload: NotificationPayload,
): Promise<DeliveryResult> {
  initWebPush()

  try {
    await webpush.sendNotification(subscriptionData, JSON.stringify(payload))
    return { subscriptionId, success: true }
  } catch (err: any) {
    const statusCode = err?.statusCode ?? err?.status
    if (statusCode === 410 || statusCode === 404) {
      return { subscriptionId, success: false, expired: true }
    }
    return {
      subscriptionId,
      success: false,
      error: err?.message ?? 'Unknown push delivery error',
    }
  }
}

// ---------------------------------------------------------------------------
// Deactivate expired subscriptions
// ---------------------------------------------------------------------------

export async function deactivateSubscription(subscriptionId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  await supabase
    .from('push_subscriptions')
    .update({ is_active: false, last_error: 'Endpoint expired (410 Gone)' })
    .eq('id', subscriptionId)
}

// ---------------------------------------------------------------------------
// Record last success
// ---------------------------------------------------------------------------

export async function markDeliverySuccess(subscriptionId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  await supabase
    .from('push_subscriptions')
    .update({ last_success_at: new Date().toISOString(), last_error: null })
    .eq('id', subscriptionId)
}

// ---------------------------------------------------------------------------
// Batch delivery
// ---------------------------------------------------------------------------

interface BatchStats {
  targeted: number
  delivered: number
  failed: number
}

/**
 * Send a notification payload to an array of subscriptions.
 * Processes in batches of `batchSize` with a short delay between batches
 * to avoid overwhelming push services.
 */
export async function sendBatchNotifications(
  subscriptions: Array<{ id: string; subscription: webpush.PushSubscription }>,
  payload: NotificationPayload,
  batchSize = 50,
  delayMs = 300,
): Promise<BatchStats> {
  initWebPush()

  const stats: BatchStats = { targeted: subscriptions.length, delivered: 0, failed: 0 }

  for (let i = 0; i < subscriptions.length; i += batchSize) {
    const batch = subscriptions.slice(i, i + batchSize)

    const results = await Promise.allSettled(
      batch.map((sub) => sendToSubscription(sub.id, sub.subscription, payload)),
    )

    for (const result of results) {
      if (result.status === 'rejected') {
        stats.failed++
        continue
      }

      const delivery = result.value

      if (delivery.success) {
        stats.delivered++
        // Fire-and-forget success tracking
        markDeliverySuccess(delivery.subscriptionId).catch(() => {})
      } else {
        stats.failed++
        if (delivery.expired) {
          // Fire-and-forget deactivation
          deactivateSubscription(delivery.subscriptionId).catch(() => {})
        }
      }
    }

    // Delay between batches (skip after last batch)
    if (i + batchSize < subscriptions.length) {
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }

  return stats
}

// ---------------------------------------------------------------------------
// Tier resolution: map tier names → Discord role IDs → user subscriptions
// ---------------------------------------------------------------------------

/**
 * Query active push subscriptions matching the given targeting criteria.
 */
export async function resolveTargetSubscriptions(
  targetType: 'all' | 'tier' | 'individual',
  targetTiers?: string[] | null,
  targetUserIds?: string[] | null,
): Promise<Array<{ id: string; subscription: webpush.PushSubscription }>> {
  const supabase = getSupabaseAdmin()

  // --- Individual targeting: direct user_id lookup ---
  if (targetType === 'individual' && targetUserIds?.length) {
    const { data } = await supabase
      .from('push_subscriptions')
      .select('id, subscription')
      .in('user_id', targetUserIds)
      .eq('is_active', true)

    return (data ?? []).map((row) => ({
      id: row.id,
      subscription: row.subscription as webpush.PushSubscription,
    }))
  }

  // --- All users ---
  if (targetType === 'all') {
    const { data } = await supabase
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('is_active', true)

    return (data ?? []).map((row) => ({
      id: row.id,
      subscription: row.subscription as webpush.PushSubscription,
    }))
  }

  // --- Tier targeting ---
  if (targetType === 'tier' && targetTiers?.length) {
    // Step 1: Fetch role→tier mapping from app_settings
    const { data: settingRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'role_tier_mapping')
      .single()

    if (!settingRow?.value) {
      console.warn('[web-push] No role_tier_mapping in app_settings — cannot resolve tiers')
      return []
    }

    const mapping: Record<string, string> =
      typeof settingRow.value === 'string'
        ? JSON.parse(settingRow.value)
        : settingRow.value

    // Invert: tier name → discord role IDs
    const roleIdsForTiers: string[] = []
    for (const [roleId, tierName] of Object.entries(mapping)) {
      if (targetTiers.includes(tierName)) {
        roleIdsForTiers.push(roleId)
      }
    }

    if (roleIdsForTiers.length === 0) return []

    // Step 2: Find user_ids whose discord_roles overlap with target role IDs
    const { data: profiles } = await supabase
      .from('user_discord_profiles')
      .select('user_id, discord_roles')

    if (!profiles?.length) return []

    const matchingUserIds = profiles
      .filter((p) => {
        const roles: string[] = p.discord_roles ?? []
        return roles.some((r: string) => roleIdsForTiers.includes(r))
      })
      .map((p) => p.user_id)

    if (matchingUserIds.length === 0) return []

    // Step 3: Get active subscriptions for those users
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, subscription')
      .in('user_id', matchingUserIds)
      .eq('is_active', true)

    return (subs ?? []).map((row) => ({
      id: row.id,
      subscription: row.subscription as webpush.PushSubscription,
    }))
  }

  return []
}
