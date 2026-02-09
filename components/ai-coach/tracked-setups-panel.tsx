'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Target,
  CandlestickChart,
  Loader2,
  X,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Archive,
  RotateCcw,
  Trash2,
  MessageSquare,
  Edit3,
  Save,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { WidgetActionBar } from './widget-action-bar'
import { WidgetContextMenu } from './widget-context-menu'
import {
  alertAction,
  analyzeAction,
  chartAction,
  chatAction,
  copyAction,
  optionsAction,
  type WidgetAction,
} from './widget-actions'
import {
  getTrackedSetups,
  updateTrackedSetup,
  deleteTrackedSetup,
  AICoachAPIError,
  type TrackedSetup,
  type TrackedSetupStatus,
} from '@/lib/api/ai-coach'

interface TrackedSetupsPanelProps {
  onClose: () => void
  onSendPrompt?: (prompt: string) => void
}

type StatusFilter = 'all' | TrackedSetupStatus

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'triggered', label: 'Triggered' },
  { value: 'invalidated', label: 'Invalidated' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All' },
]

const STATUS_BADGE_STYLES: Record<TrackedSetupStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  triggered: 'bg-sky-500/15 text-sky-300 border-sky-500/25',
  invalidated: 'bg-red-500/15 text-red-300 border-red-500/25',
  archived: 'bg-white/10 text-white/60 border-white/15',
}

const DIRECTION_STYLES: Record<'bullish' | 'bearish' | 'neutral', string> = {
  bullish: 'text-emerald-400',
  bearish: 'text-red-400',
  neutral: 'text-amber-400',
}

interface SetupTradePlan {
  entry: number | null
  stopLoss: number | null
  target: number | null
  strike: number | null
  expiry: string | null
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.+-]/g, '')
    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {}
}

function extractTradePlan(setup: TrackedSetup): SetupTradePlan {
  const opportunityData = asRecord(setup.opportunity_data)
  const suggestedTrade = asRecord(opportunityData.suggestedTrade)
  const metadata = asRecord(opportunityData.metadata)

  const strikes = Array.isArray(suggestedTrade.strikes) ? suggestedTrade.strikes : []
  const parsedStrikes = strikes
    .map((value) => parseNumeric(value))
    .filter((value): value is number => value != null)

  const entry = parseNumeric(suggestedTrade.entry)
    ?? parseNumeric(opportunityData.entry)
    ?? parseNumeric(opportunityData.currentPrice)
  const stopLoss = parseNumeric(suggestedTrade.stopLoss)
    ?? parseNumeric(opportunityData.stopLoss)
    ?? parseNumeric(metadata.stop_loss)
  const target = parseNumeric(suggestedTrade.target)
    ?? parseNumeric(opportunityData.target)
    ?? parseNumeric(metadata.target)
  const strike = parsedStrikes[0]
    ?? parseNumeric(opportunityData.strike)
    ?? entry
  const expiry = typeof suggestedTrade.expiry === 'string'
    ? suggestedTrade.expiry
    : typeof opportunityData.expiry === 'string'
      ? opportunityData.expiry
      : null

  return { entry, stopLoss, target, strike, expiry }
}

function buildChartOverlayAction(setup: TrackedSetup, plan: SetupTradePlan): WidgetAction {
  return {
    label: 'Chart Overlay',
    icon: CandlestickChart,
    variant: 'primary',
    action: () => {
      chartAction(
        setup.symbol,
        plan.entry ?? plan.strike ?? undefined,
        '15m',
        `${setup.setup_type} setup`,
      ).action()

      const support: Array<{ name: string; price: number }> = []
      const resistance: Array<{ name: string; price: number }> = []

      if (plan.entry != null) {
        if (setup.direction === 'bearish') {
          resistance.push({ name: 'Entry', price: plan.entry })
        } else {
          support.push({ name: 'Entry', price: plan.entry })
        }
      }

      if (plan.stopLoss != null) {
        if (setup.direction === 'bearish') {
          support.push({ name: 'Stop', price: plan.stopLoss })
        } else {
          resistance.push({ name: 'Stop', price: plan.stopLoss })
        }
      }

      if (plan.target != null) {
        if (setup.direction === 'bearish') {
          support.push({ name: 'Target', price: plan.target })
        } else {
          resistance.push({ name: 'Target', price: plan.target })
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ai-coach-show-chart', {
          detail: {
            symbol: setup.symbol,
            timeframe: '15m',
            levels: {
              support: support.length > 0 ? support : undefined,
              resistance: resistance.length > 0 ? resistance : undefined,
            },
          },
        }))
      }
    },
  }
}

export function TrackedSetupsPanel({ onClose, onSendPrompt }: TrackedSetupsPanelProps) {
  const { session } = useMemberAuth()
  const token = session?.access_token
  const userId = session?.user?.id

  const [trackedSetups, setTrackedSetups] = useState<TrackedSetup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('active')
  const [mutatingIds, setMutatingIds] = useState<Record<string, boolean>>({})
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const wsRef = useRef<WebSocket | null>(null)

  const fetchSetups = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    setError(null)

    try {
      const result = await getTrackedSetups(
        token,
        filterStatus === 'all' ? undefined : { status: filterStatus },
      )
      setTrackedSetups(result.trackedSetups)
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to load tracked setups'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [filterStatus, token])

  useEffect(() => {
    void fetchSetups()
  }, [fetchSetups])

  useEffect(() => {
    if (!userId) return

    const setupChannel = `setups:${userId}`
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || ''
    let wsUrl = `${protocol}//${window.location.host}/ws/prices`
    if (backendUrl) {
      try {
        wsUrl = `${protocol}//${new URL(backendUrl).host}/ws/prices`
      } catch {
        wsUrl = `${protocol}//${window.location.host}/ws/prices`
      }
    }

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', channels: [setupChannel] }))
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (
          (message?.type === 'setup_update' || message?.type === 'setup_detected')
          && message?.channel === setupChannel
        ) {
          void fetchSetups()
        }
      } catch {
        // Ignore malformed messages
      }
    }

    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'unsubscribe', channels: [setupChannel] }))
      }
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [fetchSetups, userId])

  const setMutating = useCallback((id: string, value: boolean) => {
    setMutatingIds((prev) => ({ ...prev, [id]: value }))
  }, [])

  const handleStatusChange = useCallback(async (id: string, status: TrackedSetupStatus) => {
    if (!token) return

    setMutating(id, true)
    setError(null)

    try {
      const result = await updateTrackedSetup(id, token, { status })
      setTrackedSetups((prev) => prev.map((item) => (
        item.id === id ? result.trackedSetup : item
      )))
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to update setup status'
      setError(message)
    } finally {
      setMutating(id, false)
    }
  }, [setMutating, token])

  const handleDelete = useCallback(async (id: string) => {
    if (!token) return

    setMutating(id, true)
    setError(null)

    try {
      await deleteTrackedSetup(id, token)
      setTrackedSetups((prev) => prev.filter((item) => item.id !== id))
      if (editingNotesId === id) {
        setEditingNotesId(null)
        setNotesDraft('')
      }
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to delete tracked setup'
      setError(message)
    } finally {
      setMutating(id, false)
    }
  }, [editingNotesId, setMutating, token])

  const startEditingNotes = useCallback((setup: TrackedSetup) => {
    setEditingNotesId(setup.id)
    setNotesDraft(setup.notes || '')
  }, [])

  const cancelEditingNotes = useCallback(() => {
    setEditingNotesId(null)
    setNotesDraft('')
  }, [])

  const handleSaveNotes = useCallback(async (id: string) => {
    if (!token) return

    setMutating(id, true)
    setError(null)

    try {
      const result = await updateTrackedSetup(id, token, { notes: notesDraft.trim() || null })
      setTrackedSetups((prev) => prev.map((item) => (
        item.id === id ? result.trackedSetup : item
      )))
      setEditingNotesId(null)
      setNotesDraft('')
    } catch (err) {
      const message = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to save notes'
      setError(message)
    } finally {
      setMutating(id, false)
    }
  }, [notesDraft, setMutating, token])

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-medium text-white">Tracked Setups</h2>
          {trackedSetups.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
              {trackedSetups.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSetups}
            disabled={isLoading}
            className={cn(
              'flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all',
              isLoading
                ? 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed'
                : 'text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border-emerald-500/20',
            )}
          >
            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Refresh
          </button>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-4 py-2 flex items-center gap-2 border-b border-white/5 overflow-x-auto">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status.value}
            onClick={() => setFilterStatus(status.value)}
            className={cn(
              'text-xs px-2 py-1 rounded transition-colors whitespace-nowrap',
              filterStatus === status.value
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-white/40 hover:text-white/60',
            )}
          >
            {status.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          </div>
        )}

        {!isLoading && error && (
          <div className="text-center py-12">
            <p className="text-sm text-red-400 mb-2">{error}</p>
            <button onClick={fetchSetups} className="text-xs text-emerald-500 hover:text-emerald-400">
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && trackedSetups.length === 0 && (
          <div className="text-center py-16">
            <Target className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/40">No tracked setups</p>
            <p className="text-xs text-white/25 mt-1">Track scanner ideas to monitor them through the day.</p>
          </div>
        )}

        {!isLoading && !error && trackedSetups.length > 0 && (
          <div className="p-4 space-y-3">
            {trackedSetups.map((setup) => {
              const isMutating = !!mutatingIds[setup.id]
              const isEditingNotes = editingNotesId === setup.id
              const score = typeof setup.opportunity_data?.score === 'number'
                ? setup.opportunity_data.score
                : null
              const plan = extractTradePlan(setup)
              const alertPrice = plan.entry ?? plan.strike
              const askPrompt = `Review my ${setup.setup_type} setup on ${setup.symbol}. It's currently ${setup.status}. Give me key risk/reward checkpoints and what to monitor next.`
              const workflowActions: WidgetAction[] = [
                buildChartOverlayAction(setup, plan),
                optionsAction(setup.symbol, plan.strike ?? undefined, plan.expiry ?? undefined),
                ...(alertPrice != null
                  ? [alertAction(
                      setup.symbol,
                      alertPrice,
                      setup.direction === 'bearish' ? 'price_below' : 'price_above',
                      `${setup.setup_type} (${setup.status})`,
                    )]
                  : []),
                analyzeAction({
                  symbol: setup.symbol,
                  type: setup.direction === 'bearish' ? 'put' : setup.direction === 'bullish' ? 'call' : 'stock',
                  strike: plan.strike ?? undefined,
                  expiry: plan.expiry ?? undefined,
                  quantity: 1,
                  entryPrice: plan.entry ?? 1,
                  entryDate: new Date().toISOString().slice(0, 10),
                }),
                chatAction(askPrompt),
              ]
              const contextActions = [
                ...workflowActions,
                copyAction(`${setup.symbol} ${setup.setup_type} ${setup.status}`),
              ]

              return (
                <WidgetContextMenu key={setup.id} actions={contextActions}>
                  <div
                    className="glass-card-heavy rounded-lg p-3 border border-white/10"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="text-sm font-semibold text-white">{setup.symbol}</span>
                          <span className="text-[11px] text-white/50 uppercase tracking-wide">{setup.setup_type}</span>
                          <span className={cn('text-[11px] font-medium capitalize', DIRECTION_STYLES[setup.direction])}>
                            {setup.direction}
                          </span>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border capitalize', STATUS_BADGE_STYLES[setup.status])}>
                            {setup.status}
                          </span>
                          {score !== null && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                              Score {score}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/35 mt-1">
                          Tracked {new Date(setup.tracked_at).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {onSendPrompt && (
                          <button
                            onClick={() => onSendPrompt(askPrompt)}
                            className="text-white/30 hover:text-emerald-400 transition-colors"
                            title="Ask AI about this setup"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(setup.id)}
                          disabled={isMutating}
                          className={cn(
                            'transition-colors',
                            isMutating ? 'text-white/20 cursor-not-allowed' : 'text-white/30 hover:text-red-400',
                          )}
                          title="Delete setup"
                        >
                          {isMutating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <WidgetActionBar actions={workflowActions} className="mt-2" />

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {setup.status !== 'triggered' && (
                        <StatusActionButton
                          label="Mark Triggered"
                          icon={CheckCircle2}
                          onClick={() => handleStatusChange(setup.id, 'triggered')}
                          disabled={isMutating}
                          tone="positive"
                        />
                      )}
                      {setup.status !== 'invalidated' && (
                        <StatusActionButton
                          label="Mark Invalidated"
                          icon={XCircle}
                          onClick={() => handleStatusChange(setup.id, 'invalidated')}
                          disabled={isMutating}
                          tone="danger"
                        />
                      )}
                      {setup.status !== 'archived' && (
                        <StatusActionButton
                          label="Archive"
                          icon={Archive}
                          onClick={() => handleStatusChange(setup.id, 'archived')}
                          disabled={isMutating}
                          tone="muted"
                        />
                      )}
                      {setup.status !== 'active' && (
                        <StatusActionButton
                          label="Reopen"
                          icon={RotateCcw}
                          onClick={() => handleStatusChange(setup.id, 'active')}
                          disabled={isMutating}
                          tone="primary"
                        />
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/5">
                      {isEditingNotes ? (
                        <div className="space-y-2">
                          <textarea
                            value={notesDraft}
                            onChange={(event) => setNotesDraft(event.target.value)}
                            placeholder="Add setup notes..."
                            rows={3}
                            className="w-full rounded-md bg-white/5 border border-white/10 px-2.5 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/35 resize-none"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSaveNotes(setup.id)}
                              disabled={isMutating}
                              className={cn(
                                'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border transition-colors',
                                isMutating
                                  ? 'text-white/35 border-white/10 cursor-not-allowed'
                                  : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15',
                              )}
                            >
                              <Save className="w-3 h-3" />
                              Save Notes
                            </button>
                            <button
                              onClick={cancelEditingNotes}
                              disabled={isMutating}
                              className="text-xs px-2.5 py-1.5 rounded border border-white/10 text-white/50 hover:text-white/70 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditingNotes(setup)}
                          className="w-full text-left text-xs rounded-md border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-2 transition-colors"
                        >
                          <span className="flex items-center gap-1.5 text-white/45 mb-1">
                            <Edit3 className="w-3 h-3" />
                            Notes
                          </span>
                          <span className="text-white/70">
                            {setup.notes?.trim() ? setup.notes : 'Add notes for this tracked setup...'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </WidgetContextMenu>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusActionButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  tone,
}: {
  label: string
  icon: typeof CheckCircle2
  onClick: () => void
  disabled?: boolean
  tone: 'positive' | 'danger' | 'muted' | 'primary'
}) {
  const toneClass = tone === 'positive'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
    : tone === 'danger'
      ? 'border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/15'
      : tone === 'muted'
        ? 'border-white/15 bg-white/10 text-white/65 hover:bg-white/15'
        : 'border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/15'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border transition-colors',
        disabled ? 'opacity-50 cursor-not-allowed' : toneClass,
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  )
}
