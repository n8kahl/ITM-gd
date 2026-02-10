import { getSupabaseAdminClient } from '@/lib/api/member-auth'

const JOURNAL_ANALYTICS_REFRESH_DEBOUNCE_MS = 5_000

const pendingUserIds = new Set<string>()
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let refreshInFlight = false

function scheduleRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
  }

  refreshTimer = setTimeout(() => {
    void flushQueuedRefreshes()
  }, JOURNAL_ANALYTICS_REFRESH_DEBOUNCE_MS)

  if (typeof refreshTimer.unref === 'function') {
    refreshTimer.unref()
  }
}

async function flushQueuedRefreshes() {
  refreshTimer = null

  if (pendingUserIds.size === 0) {
    return
  }

  if (refreshInFlight) {
    scheduleRefresh()
    return
  }

  const queuedUsers = Array.from(pendingUserIds)
  pendingUserIds.clear()
  refreshInFlight = true

  try {
    const supabase = getSupabaseAdminClient()
    const { error } = await supabase.rpc('refresh_journal_analytics_cache')
    if (error) {
      throw new Error(error.message)
    }
  } catch (error) {
    console.error('[journal-analytics-refresh] failed to refresh analytics cache', {
      queuedUsers: queuedUsers.length,
      error: error instanceof Error ? error.message : String(error),
    })

    for (const userId of queuedUsers) {
      pendingUserIds.add(userId)
    }
  } finally {
    refreshInFlight = false
    if (pendingUserIds.size > 0) {
      scheduleRefresh()
    }
  }
}

/**
 * Queue a debounced analytics refresh after journal mutations.
 * The refresh is deduped per user and coalesced across rapid writes.
 */
export function enqueueJournalAnalyticsRefresh(userId: string) {
  if (!userId) return
  pendingUserIds.add(userId)
  scheduleRefresh()
}
