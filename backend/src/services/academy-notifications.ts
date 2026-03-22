/**
 * Academy Achievement Notification Service
 *
 * Sends push notifications when users:
 *   - Unlock an achievement
 *   - Reach a new level (rank up)
 *   - Complete a challenge
 *
 * Uses web-push directly (backend dep) and queries push_subscriptions via Supabase.
 */

import webpush from 'web-push';
import { supabase } from '../config/database';
import { logger } from '../lib/logger';

// ---------------------------------------------------------------------------
// VAPID init (lazy, once)
// ---------------------------------------------------------------------------

let vapidInitialised = false;

function ensureVapid(): boolean {
  if (vapidInitialised) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@tradeitm.com';

  if (!publicKey || !privateKey) {
    logger.warn('[academy-notifications] VAPID keys not configured — push disabled');
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidInitialised = true;
  return true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface PushSubscriptionRow {
  id: string;
  subscription: webpush.PushSubscription;
}

/**
 * Resolve active push subscriptions for a single user.
 */
async function getUserSubscriptions(userId: string): Promise<PushSubscriptionRow[]> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) {
    logger.warn('Failed to fetch push subscriptions for achievement notification', {
      userId,
      error: error.message,
    });
    return [];
  }

  return (data ?? []) as PushSubscriptionRow[];
}

// ---------------------------------------------------------------------------
// Notification payload shape (matches public/sw.js push handler)
// ---------------------------------------------------------------------------

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

/**
 * Send a push notification to a single user (all their active subscriptions).
 * Failures are logged but never thrown — notifications are best-effort.
 */
async function sendUserNotification(
  userId: string,
  payload: NotificationPayload
): Promise<void> {
  try {
    if (!ensureVapid()) return;

    const subscriptions = await getUserSubscriptions(userId);
    if (subscriptions.length === 0) return;

    const payloadStr = JSON.stringify(payload);

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(sub.subscription, payloadStr);

          // Fire-and-forget success tracking
          supabase
            .from('push_subscriptions')
            .update({ last_success_at: new Date().toISOString(), last_error: null })
            .eq('id', sub.id)
            .then(() => {});
        } catch (err: unknown) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 410 || statusCode === 404) {
            // Subscription expired — deactivate
            supabase
              .from('push_subscriptions')
              .update({ is_active: false, last_error: 'Endpoint expired (410 Gone)' })
              .eq('id', sub.id)
              .then(() => {});
          } else {
            logger.warn('Push delivery failed for subscription', {
              subscriptionId: sub.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      })
    );
  } catch (err) {
    logger.warn('Failed to send achievement notification', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Public API — Achievement Notifications
// ---------------------------------------------------------------------------

/**
 * Notify a user that they unlocked a new achievement.
 */
export async function notifyAchievementUnlocked(
  userId: string,
  achievementTitle: string,
  achievementCategory: string
): Promise<void> {
  await sendUserNotification(userId, {
    title: 'Achievement Unlocked!',
    body: `You earned "${achievementTitle}" in ${achievementCategory}`,
    icon: '/logo.png',
    badge: '/logo.png',
    url: '/members/academy?tab=achievements',
    tag: 'achievement-unlock',
  });
}

/**
 * Notify a user that they reached a new level.
 */
export async function notifyLevelUp(
  userId: string,
  newLevel: number
): Promise<void> {
  await sendUserNotification(userId, {
    title: 'Level Up!',
    body: `Congratulations! You've reached Level ${newLevel}`,
    icon: '/logo.png',
    badge: '/logo.png',
    url: '/members/academy?tab=progress',
    tag: 'level-up',
  });
}

/**
 * Notify a user that they completed a challenge.
 */
export async function notifyChallengeCompleted(
  userId: string,
  challengeTitle: string,
  xpAwarded: number
): Promise<void> {
  await sendUserNotification(userId, {
    title: 'Challenge Completed!',
    body: `You finished "${challengeTitle}" and earned ${xpAwarded} XP`,
    icon: '/logo.png',
    badge: '/logo.png',
    url: '/members/academy?tab=challenges',
    tag: 'challenge-complete',
  });
}

/**
 * Notify a user about a streak milestone.
 */
export async function notifyStreakMilestone(
  userId: string,
  streakDays: number
): Promise<void> {
  await sendUserNotification(userId, {
    title: 'Streak Milestone!',
    body: `Amazing! You've maintained a ${streakDays}-day streak`,
    icon: '/logo.png',
    badge: '/logo.png',
    url: '/members/academy?tab=progress',
    tag: 'streak-milestone',
  });
}
