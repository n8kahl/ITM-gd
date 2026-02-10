import webpush from 'web-push';
import { supabase } from '../../config/database';
import { logger } from '../../lib/logger';

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  subscription: webpush.PushSubscription;
}

interface AutoJournalPushInput {
  userId: string;
  marketDate: string;
  createdCount: number;
}

let vapidConfigured = false;

function ensureVapidConfiguration(): boolean {
  if (vapidConfigured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@tradeitm.com';

  if (!publicKey || !privateKey) {
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return true;
  } catch (error) {
    logger.warn('Push notifications: failed to configure VAPID details', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

function isExpiredSubscriptionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return statusCode === 404 || statusCode === 410;
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return 'Unknown push error';
}

export async function sendAutoJournalPushNotifications(input: AutoJournalPushInput): Promise<number> {
  if (input.createdCount <= 0) return 0;
  if (!ensureVapidConfiguration()) return 0;

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id,endpoint,subscription')
    .eq('user_id', input.userId)
    .eq('is_active', true)
    .limit(20);

  if (error) {
    logger.warn('Push notifications: failed to load user subscriptions', {
      userId: input.userId,
      error: error.message,
      code: (error as { code?: string }).code,
    });
    return 0;
  }

  const subscriptions = (data || []) as PushSubscriptionRow[];
  if (subscriptions.length === 0) return 0;

  const payload = JSON.stringify({
    title: 'Auto-Journal Drafts Ready',
    body: `We detected ${input.createdCount} trade${input.createdCount === 1 ? '' : 's'} from today. Review and confirm your draft entries.`,
    url: '/members/journal',
    tag: `auto-journal-${input.marketDate}`,
    requireInteraction: true,
  });

  let sentCount = 0;
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(subscription.subscription, payload);
      sentCount += 1;

      await supabase
        .from('push_subscriptions')
        .update({
          last_success_at: new Date().toISOString(),
          last_error: null,
          is_active: true,
        })
        .eq('id', subscription.id);
    } catch (pushError) {
      const lastError = stringifyError(pushError);
      const isExpired = isExpiredSubscriptionError(pushError);

      await supabase
        .from('push_subscriptions')
        .update({
          last_error: lastError,
          is_active: isExpired ? false : true,
        })
        .eq('id', subscription.id);

      logger.warn('Push notifications: failed to deliver push payload', {
        userId: input.userId,
        endpoint: subscription.endpoint,
        expired: isExpired,
        error: lastError,
      });
    }
  }

  return sentCount;
}
