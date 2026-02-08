'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Bell,
  Plus,
  X,
  Loader2,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Ban,
  Trash2,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import {
  getAlerts,
  createAlert,
  cancelAlert,
  deleteAlert,
  AICoachAPIError,
  type AlertEntry,
  type AlertCreateInput,
  type AlertType,
  type AlertStatus,
} from '@/lib/api/ai-coach'

// ============================================
// TYPES
// ============================================

interface AlertsPanelProps {
  onClose: () => void
}

// ============================================
// CONSTANTS
// ============================================

const ALERT_TYPES: { value: AlertType; label: string; icon: typeof TrendingUp; description: string }[] = [
  { value: 'price_above', label: 'Price Above', icon: TrendingUp, description: 'When price rises above target' },
  { value: 'price_below', label: 'Price Below', icon: TrendingDown, description: 'When price drops below target' },
  { value: 'level_approach', label: 'Level Approach', icon: Activity, description: 'When price nears a key level' },
  { value: 'level_break', label: 'Level Break', icon: BarChart3, description: 'When a key level is broken' },
  { value: 'volume_spike', label: 'Volume Spike', icon: BarChart3, description: 'Unusual volume detected' },
]

// ============================================
// COMPONENT
// ============================================

export function AlertsPanel({ onClose }: AlertsPanelProps) {
  const { session } = useMemberAuth()
  const [alerts, setAlerts] = useState<AlertEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState<AlertStatus | ''>('active')

  const token = session?.access_token

  const fetchAlerts = useCallback(async () => {
    if (!token) return
    setIsLoading(true)
    setError(null)

    try {
      const result = await getAlerts(token, {
        status: filterStatus || undefined,
      })
      setAlerts(result.alerts)
    } catch (err) {
      const msg = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to load alerts'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [token, filterStatus])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  const handleCancel = useCallback(async (id: string) => {
    if (!token) return
    try {
      await cancelAlert(id, token)
      setAlerts(prev => prev.map(a =>
        a.id === id ? { ...a, status: 'cancelled' as AlertStatus } : a
      ))
    } catch (err) {
      const msg = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to cancel alert'
      setError(msg)
    }
  }, [token])

  const handleDelete = useCallback(async (id: string) => {
    if (!token) return
    try {
      await deleteAlert(id, token)
      setAlerts(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      const msg = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to delete alert'
      setError(msg)
    }
  }, [token])

  const handleCreated = useCallback(() => {
    setShowForm(false)
    fetchAlerts()
  }, [fetchAlerts])

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-medium text-white">Price Alerts</h2>
          {alerts.filter(a => a.status === 'active').length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
              {alerts.filter(a => a.status === 'active').length} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 rounded-lg px-2 py-1 transition-all"
          >
            <Plus className="w-3 h-3" />
            New Alert
          </button>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* New Alert Form */}
        {showForm && (
          <div className="p-4 border-b border-white/5">
            <AlertForm token={token} onCreated={handleCreated} onCancel={() => setShowForm(false)} />
          </div>
        )}

        {/* Filter bar */}
        <div className="px-4 py-2 flex items-center gap-2 border-b border-white/5">
          {(['active', 'triggered', 'cancelled', ''] as const).map(status => (
            <button
              key={status || 'all'}
              onClick={() => setFilterStatus(status)}
              className={cn(
                'text-xs px-2 py-1 rounded transition-colors',
                filterStatus === status
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-white/40 hover:text-white/60'
              )}
            >
              {status === '' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="text-center py-12">
            <p className="text-sm text-red-400 mb-2">{error}</p>
            <button onClick={fetchAlerts} className="text-xs text-emerald-500 hover:text-emerald-400">
              Retry
            </button>
          </div>
        )}

        {/* Alerts List */}
        {!isLoading && !error && (
          <div className="p-4 space-y-2">
            {alerts.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-8 h-8 text-white/10 mx-auto mb-3" />
                <p className="text-sm text-white/40">No alerts</p>
                <p className="text-xs text-white/25 mt-1">
                  Create alerts to get notified on price movements
                </p>
              </div>
            ) : (
              alerts.map(alert => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onCancel={handleCancel}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// ALERT CARD
// ============================================

function AlertCard({
  alert,
  onCancel,
  onDelete,
}: {
  alert: AlertEntry
  onCancel: (id: string) => void
  onDelete: (id: string) => void
}) {
  const typeConfig = ALERT_TYPES.find(t => t.value === alert.alert_type)
  const Icon = typeConfig?.icon || Activity

  return (
    <div className={cn(
      'glass-card-heavy rounded-lg p-3 border',
      alert.status === 'active' ? 'border-emerald-500/20' :
      alert.status === 'triggered' ? 'border-amber-500/20' :
      'border-white/5 opacity-60'
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={cn(
            'w-4 h-4',
            alert.status === 'active' ? 'text-emerald-400' :
            alert.status === 'triggered' ? 'text-amber-400' :
            'text-white/30'
          )} />
          <span className="text-sm font-medium text-white">{alert.symbol}</span>
          <span className="text-xs text-white/30">
            {typeConfig?.label || alert.alert_type}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={alert.status} />
          {alert.status === 'active' && (
            <button
              onClick={() => onCancel(alert.id)}
              className="text-white/20 hover:text-amber-400 transition-colors"
              title="Cancel alert"
            >
              <Ban className="w-3.5 h-3.5" />
            </button>
          )}
          {alert.status !== 'active' && (
            <button
              onClick={() => onDelete(alert.id)}
              className="text-white/20 hover:text-red-400 transition-colors"
              title="Delete alert"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div>
          <span className="text-white/30">Target:</span>
          <span className="text-white/70 ml-1 font-medium">${alert.target_value.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-white/30">Created:</span>
          <span className="text-white/50 ml-1">
            {new Date(alert.created_at).toLocaleDateString()}
          </span>
        </div>
        {alert.triggered_at && (
          <div>
            <span className="text-white/30">Triggered:</span>
            <span className="text-amber-400 ml-1">
              {new Date(alert.triggered_at).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {alert.notes && (
        <p className="text-[11px] text-white/30 mt-1.5">{alert.notes}</p>
      )}
    </div>
  )
}

// ============================================
// ALERT FORM
// ============================================

function AlertForm({
  token,
  onCreated,
  onCancel,
}: {
  token?: string
  onCreated: () => void
  onCancel: () => void
}) {
  const [symbol, setSymbol] = useState('SPX')
  const [alertType, setAlertType] = useState<AlertType>('price_above')
  const [targetValue, setTargetValue] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = useCallback(async () => {
    if (!token || !targetValue) return

    setIsSubmitting(true)
    setFormError(null)

    const input: AlertCreateInput = {
      symbol: symbol.toUpperCase(),
      alert_type: alertType,
      target_value: parseFloat(targetValue),
      notes: notes || undefined,
    }

    try {
      await createAlert(input, token)
      onCreated()
    } catch (err) {
      const msg = err instanceof AICoachAPIError
        ? err.apiError.message
        : 'Failed to create alert'
      setFormError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }, [token, symbol, alertType, targetValue, notes, onCreated])

  return (
    <div className="space-y-3">
      {formError && (
        <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-400">{formError}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/40 block mb-1">Symbol</label>
          <select
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none transition-colors"
          >
            <option value="SPX" className="bg-[#0a0a0a]">SPX</option>
            <option value="NDX" className="bg-[#0a0a0a]">NDX</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-white/40 block mb-1">Target Price</label>
          <input
            type="number"
            step="0.01"
            value={targetValue}
            onChange={e => setTargetValue(e.target.value)}
            placeholder="5900.00"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-white/40 block mb-1">Alert Type</label>
        <div className="grid grid-cols-2 gap-2">
          {ALERT_TYPES.slice(0, 4).map(type => {
            const TypeIcon = type.icon
            return (
              <button
                key={type.value}
                onClick={() => setAlertType(type.value)}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-lg border text-left transition-all text-xs',
                  alertType === type.value
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-white/5 text-white/40 hover:border-white/10'
                )}
              >
                <TypeIcon className="w-3.5 h-3.5 shrink-0" />
                {type.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="text-xs text-white/40 block mb-1">Notes (optional)</label>
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. Watch for PDH rejection"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none transition-colors"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !targetValue}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2',
            isSubmitting || !targetValue
              ? 'bg-white/5 text-white/30 cursor-not-allowed'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white'
          )}
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          {isSubmitting ? 'Creating...' : 'Create Alert'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm text-white/40 hover:text-white/60 bg-white/5 hover:bg-white/10 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ============================================
// HELPERS
// ============================================

function StatusBadge({ status }: { status: AlertStatus }) {
  const config = {
    active: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Active' },
    triggered: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Triggered' },
    cancelled: { bg: 'bg-white/5', text: 'text-white/30', label: 'Cancelled' },
  }

  const c = config[status]

  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded', c.bg, c.text)}>
      {c.label}
    </span>
  )
}
