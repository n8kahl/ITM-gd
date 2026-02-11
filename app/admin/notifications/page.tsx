'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Bell,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Users,
  User,
  Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NotificationUserSearch } from '@/components/admin/notification-user-search'
import type {
  NotificationBroadcast,
  BroadcastTargetType,
  BroadcastStatus,
} from '@/lib/types/notifications'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIER_OPTIONS = [
  { id: 'core', label: 'Core', color: 'text-emerald-400 bg-emerald-900/30 border-emerald-800/50' },
  { id: 'pro', label: 'Pro', color: 'text-champagne bg-champagne/10 border-champagne/30' },
  { id: 'executive', label: 'Executive', color: 'text-amber-300 bg-amber-900/20 border-amber-700/40' },
]

const STATUS_STYLES: Record<BroadcastStatus, { icon: typeof Bell; label: string; className: string }> = {
  draft: { icon: Clock, label: 'Draft', className: 'text-white/50 bg-white/5 border-white/10' },
  scheduled: { icon: Clock, label: 'Scheduled', className: 'text-amber-300 bg-amber-900/20 border-amber-700/40' },
  sending: { icon: Loader2, label: 'Sending', className: 'text-blue-300 bg-blue-900/20 border-blue-700/40' },
  sent: { icon: CheckCircle2, label: 'Sent', className: 'text-emerald-400 bg-emerald-900/30 border-emerald-800/50' },
  failed: { icon: AlertCircle, label: 'Failed', className: 'text-red-400 bg-red-900/20 border-red-700/40' },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTarget(broadcast: NotificationBroadcast): string {
  if (broadcast.target_type === 'all') return 'All Users'
  if (broadcast.target_type === 'tier' && broadcast.target_tiers?.length) {
    return broadcast.target_tiers.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')
  }
  if (broadcast.target_type === 'individual' && broadcast.target_user_ids?.length) {
    const count = broadcast.target_user_ids.length
    return `${count} user${count !== 1 ? 's' : ''}`
  }
  return 'Unknown'
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(dateStr))
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminNotificationsPage() {
  // Form state
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [url, setUrl] = useState('/members')
  const [tag, setTag] = useState('')
  const [requireInteraction, setRequireInteraction] = useState(false)
  const [targetType, setTargetType] = useState<BroadcastTargetType>('all')
  const [targetTiers, setTargetTiers] = useState<string[]>([])
  const [targetUsers, setTargetUsers] = useState<Array<{ user_id: string; discord_username: string | null }>>([])

  // Sending state
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // History state
  const [history, setHistory] = useState<NotificationBroadcast[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // -------------------------------------------------------------------------
  // Load history
  // -------------------------------------------------------------------------

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const params = new URLSearchParams({ limit: '20' })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const response = await fetch(`/api/admin/notifications?${params.toString()}`)
      const data = await response.json()
      if (data.success) {
        setHistory(data.data ?? [])
        setHistoryTotal(data.total ?? 0)
      }
    } catch {
      // silent
    } finally {
      setHistoryLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // -------------------------------------------------------------------------
  // Send notification
  // -------------------------------------------------------------------------

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return
    if (targetType === 'tier' && targetTiers.length === 0) return
    if (targetType === 'individual' && targetUsers.length === 0) return

    setSending(true)
    setSendResult(null)

    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          url: url.trim() || '/members',
          tag: tag.trim() || undefined,
          requireInteraction,
          targetType,
          targetTiers: targetType === 'tier' ? targetTiers : undefined,
          targetUserIds: targetType === 'individual' ? targetUsers.map((u) => u.user_id) : undefined,
        }),
      })

      const data = await response.json()

      if (data.success) {
        const stats = data.stats
        const msg = stats
          ? `Sent to ${stats.delivered}/${stats.targeted} subscriptions${stats.failed > 0 ? ` (${stats.failed} failed)` : ''}`
          : 'Notification created'
        setSendResult({ type: 'success', message: msg })

        // Reset form
        setTitle('')
        setBody('')
        setUrl('/members')
        setTag('')
        setRequireInteraction(false)
        setTargetType('all')
        setTargetTiers([])
        setTargetUsers([])

        // Refresh history
        loadHistory()
      } else {
        setSendResult({ type: 'error', message: data.error || 'Failed to send' })
      }
    } catch (err) {
      setSendResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Network error',
      })
    } finally {
      setSending(false)
    }
  }

  // -------------------------------------------------------------------------
  // Tier checkbox toggle
  // -------------------------------------------------------------------------

  const toggleTier = (tierId: string) => {
    setTargetTiers((prev) =>
      prev.includes(tierId) ? prev.filter((t) => t !== tierId) : [...prev, tierId],
    )
  }

  // -------------------------------------------------------------------------
  // Form validity
  // -------------------------------------------------------------------------

  const isFormValid =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    (targetType === 'all' ||
      (targetType === 'tier' && targetTiers.length > 0) ||
      (targetType === 'individual' && targetUsers.length > 0))

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight flex items-center gap-3">
          <Bell className="w-6 h-6 text-emerald-400" />
          Push Notifications
        </h1>
        <p className="text-sm text-white/40 mt-1">
          Compose and send push notifications to members by tier, individually, or to everyone.
        </p>
      </div>

      {/* Compose Panel */}
      <div className="glass-card-heavy rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-semibold text-white">Compose Notification</h2>

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1.5">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="New Trade Alert"
            className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/30"
          />
          <p className="text-[10px] text-white/25 mt-1 text-right">{title.length}/100</p>
        </div>

        {/* Body */}
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1.5">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="We just posted a high-conviction setup in the trading room..."
            className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/30 resize-none"
          />
          <p className="text-[10px] text-white/25 mt-1 text-right">{body.length}/500</p>
        </div>

        {/* URL + Tag row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              Deep Link URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/members/journal"
              className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              Tag <span className="text-white/20">(optional)</span>
            </label>
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="trade-alert"
              className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/30"
            />
          </div>
        </div>

        {/* Require interaction toggle */}
        <label className="flex items-center gap-3 cursor-pointer group">
          <button
            type="button"
            role="switch"
            aria-checked={requireInteraction}
            onClick={() => setRequireInteraction(!requireInteraction)}
            className={cn(
              'relative w-10 h-5 rounded-full transition-colors duration-200',
              requireInteraction ? 'bg-emerald-600' : 'bg-white/10',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200',
                requireInteraction && 'translate-x-5',
              )}
            />
          </button>
          <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
            Require interaction (notification stays until dismissed)
          </span>
        </label>

        {/* Target Selector */}
        <div>
          <label className="block text-xs font-medium text-white/60 mb-2">Target Audience</label>
          <div className="flex flex-wrap gap-2 mb-4">
            {([
              { type: 'all' as const, label: 'All Users', icon: Users },
              { type: 'tier' as const, label: 'By Tier', icon: Layers },
              { type: 'individual' as const, label: 'Individual', icon: User },
            ]).map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                onClick={() => setTargetType(type)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200',
                  targetType === type
                    ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50'
                    : 'bg-white/5 text-white/50 border-white/10 hover:text-white/70 hover:bg-white/8',
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Tier checkboxes */}
          {targetType === 'tier' && (
            <div className="flex flex-wrap gap-2 pl-1">
              {TIER_OPTIONS.map((tier) => (
                <label
                  key={tier.id}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-all',
                    targetTiers.includes(tier.id)
                      ? tier.color
                      : 'text-white/40 bg-white/3 border-white/8 hover:border-white/15',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={targetTiers.includes(tier.id)}
                    onChange={() => toggleTier(tier.id)}
                    className="sr-only"
                  />
                  <div
                    className={cn(
                      'w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors',
                      targetTiers.includes(tier.id)
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-white/20',
                    )}
                  >
                    {targetTiers.includes(tier.id) && (
                      <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                    )}
                  </div>
                  {tier.label}
                </label>
              ))}
            </div>
          )}

          {/* Individual user search */}
          {targetType === 'individual' && (
            <NotificationUserSearch
              selectedUsers={targetUsers}
              onSelect={(user) =>
                setTargetUsers((prev) => [...prev, user])
              }
              onRemove={(userId) =>
                setTargetUsers((prev) => prev.filter((u) => u.user_id !== userId))
              }
            />
          )}
        </div>

        {/* Send result banner */}
        {sendResult && (
          <div
            className={cn(
              'flex items-center gap-2 px-4 py-3 rounded-lg text-sm border',
              sendResult.type === 'success'
                ? 'bg-emerald-900/20 text-emerald-300 border-emerald-800/50'
                : 'bg-red-900/20 text-red-300 border-red-800/50',
            )}
          >
            {sendResult.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            {sendResult.message}
          </div>
        )}

        {/* Send button */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-white/30">
            {targetType === 'all' && 'Sends to all users with active push subscriptions'}
            {targetType === 'tier' && targetTiers.length > 0 &&
              `Sends to ${targetTiers.join(', ')} tier members`}
            {targetType === 'tier' && targetTiers.length === 0 && 'Select at least one tier'}
            {targetType === 'individual' &&
              `${targetUsers.length} user${targetUsers.length !== 1 ? 's' : ''} selected`}
          </p>
          <button
            type="button"
            onClick={handleSend}
            disabled={!isFormValid || sending}
            className={cn(
              'flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300',
              isFormValid && !sending
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_4px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_8px_30px_rgba(16,185,129,0.35)]'
                : 'bg-white/5 text-white/25 cursor-not-allowed',
            )}
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {sending ? 'Sending...' : 'Send Notification'}
          </button>
        </div>
      </div>

      {/* History Section */}
      <div className="glass-card-heavy rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">
            Broadcast History
            {historyTotal > 0 && (
              <span className="text-sm text-white/30 font-normal ml-2">({historyTotal})</span>
            )}
          </h2>

          <div className="flex items-center gap-2">
            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            >
              <option value="all">All Status</option>
              <option value="sent">Sent</option>
              <option value="sending">Sending</option>
              <option value="scheduled">Scheduled</option>
              <option value="failed">Failed</option>
            </select>

            <button
              type="button"
              onClick={loadHistory}
              className="p-1.5 rounded-lg text-white/40 hover:text-emerald-400 hover:bg-white/5 transition-colors"
              aria-label="Refresh history"
            >
              <RefreshCw className={cn('w-4 h-4', historyLoading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* History table */}
        {historyLoading && history.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-white/30">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading...
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-8 h-8 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/30">No broadcasts yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-[10px] font-bold uppercase tracking-widest text-white/25 pb-3 pr-4">
                    Notification
                  </th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-widest text-white/25 pb-3 pr-4">
                    Target
                  </th>
                  <th className="text-left text-[10px] font-bold uppercase tracking-widest text-white/25 pb-3 pr-4">
                    Status
                  </th>
                  <th className="text-right text-[10px] font-bold uppercase tracking-widest text-white/25 pb-3 pr-4">
                    Delivered
                  </th>
                  <th className="text-right text-[10px] font-bold uppercase tracking-widest text-white/25 pb-3">
                    Sent
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {history.map((broadcast) => {
                  const statusConfig = STATUS_STYLES[broadcast.status] || STATUS_STYLES.draft
                  const StatusIcon = statusConfig.icon

                  return (
                    <tr key={broadcast.id} className="group hover:bg-white/[0.02] transition-colors">
                      {/* Title + body preview */}
                      <td className="py-3 pr-4">
                        <p className="text-sm font-medium text-white truncate max-w-[220px]">
                          {broadcast.title}
                        </p>
                        <p className="text-xs text-white/30 truncate max-w-[220px] mt-0.5">
                          {broadcast.body}
                        </p>
                      </td>

                      {/* Target */}
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-1.5 text-xs text-white/60">
                          {broadcast.target_type === 'all' && <Users className="w-3 h-3" />}
                          {broadcast.target_type === 'tier' && <Layers className="w-3 h-3" />}
                          {broadcast.target_type === 'individual' && <User className="w-3 h-3" />}
                          {formatTarget(broadcast)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 pr-4">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border',
                            statusConfig.className,
                          )}
                        >
                          <StatusIcon
                            className={cn(
                              'w-3 h-3',
                              broadcast.status === 'sending' && 'animate-spin',
                            )}
                          />
                          {statusConfig.label}
                        </span>
                      </td>

                      {/* Delivered / Failed */}
                      <td className="py-3 pr-4 text-right">
                        <span className="text-sm font-mono text-emerald-400">
                          {broadcast.delivered_count}
                        </span>
                        {broadcast.failed_count > 0 && (
                          <span className="text-sm font-mono text-red-400 ml-1">
                            / {broadcast.failed_count}
                          </span>
                        )}
                        {broadcast.total_targeted > 0 && (
                          <span className="text-xs text-white/20 ml-1">
                            of {broadcast.total_targeted}
                          </span>
                        )}
                      </td>

                      {/* Sent date */}
                      <td className="py-3 text-right">
                        <span className="text-xs text-white/40">
                          {formatDate(broadcast.sent_at || broadcast.created_at)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
