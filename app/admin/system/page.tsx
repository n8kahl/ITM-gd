'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Activity,
  Database,
  Cloud,
  Bot,
  HardDrive,
  Zap,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Clock,
  TrendingUp,
  BarChart3,
  Server,
  Shield,
  Inbox,
  RotateCw,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface DLQEntry {
  id: string
  event_type: string
  payload: Record<string, unknown>
  error_message: string | null
  error_stack: string | null
  source: string
  created_at: string
  retried_at: string | null
  retry_count: number
  resolved: boolean
}

interface EdgeFunctionMetrics {
  functionName: string
  totalInvocations: number
  successCount: number
  errorCount: number
  errorRate: number
  avgExecutionTimeMs: number
  p95ExecutionTimeMs: number
  lastInvokedAt: string | null
  lastError: string | null
}

interface DiagnosticResult {
  name: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  details?: string
  latency?: number
  circuitState?: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  failureCount?: number
}

interface SystemDiagnostics {
  success: boolean
  status: 'healthy' | 'warning' | 'degraded'
  timestamp: string
  results: DiagnosticResult[]
}

// Map diagnostic names to icons
const diagnosticIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'Database Connection': Database,
  'Edge Functions': Cloud,
  'OpenAI Integration': Zap,
  'Massive.com': TrendingUp,
  'FRED': BarChart3,
  'FMP': BarChart3,
  'Discord Bot': Bot,
  'Redis': Server,
  'Storage': HardDrive,
}

export default function SystemPage() {
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState<Date | null>(null)
  const [edgeFunctions, setEdgeFunctions] = useState<EdgeFunctionMetrics[]>([])
  const [edgeFnLoading, setEdgeFnLoading] = useState(true)
  const [dlqEntries, setDlqEntries] = useState<DLQEntry[]>([])
  const [dlqTotal, setDlqTotal] = useState(0)
  const [dlqLoading, setDlqLoading] = useState(true)
  const [dlqActionLoading, setDlqActionLoading] = useState<string | null>(null)

  const runDiagnostics = useCallback(async () => {
    setLoading(true)
    setEdgeFnLoading(true)
    setDlqLoading(true)
    setError(null)

    try {
      const [systemRes, edgeFnRes, dlqRes] = await Promise.all([
        fetch('/api/admin/system'),
        fetch('/api/admin/system/edge-functions'),
        fetch('/api/admin/system/dlq'),
      ])

      const systemData = await systemRes.json()
      if (systemData.success) {
        setDiagnostics(systemData)
        setLastRun(new Date())
      } else {
        setError(systemData.error || 'Failed to run diagnostics')
      }

      const edgeFnData = await edgeFnRes.json()
      if (edgeFnData.success) {
        setEdgeFunctions(edgeFnData.metrics || [])
      }

      const dlqData = await dlqRes.json()
      if (dlqData.success) {
        setDlqEntries(dlqData.entries || [])
        setDlqTotal(dlqData.total || 0)
      }
    } catch {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
      setEdgeFnLoading(false)
      setDlqLoading(false)
    }
  }, [])

  const handleDlqAction = useCallback(async (action: 'retry' | 'dismiss', ids: string[]) => {
    setDlqActionLoading(ids[0])
    try {
      const response = await fetch('/api/admin/system/dlq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids }),
      })
      const data = await response.json()
      if (data.success) {
        // Remove dismissed/retried entries from local state
        if (action === 'dismiss') {
          setDlqEntries((prev: DLQEntry[]) => prev.filter((e: DLQEntry) => !ids.includes(e.id)))
          setDlqTotal((prev: number) => Math.max(0, prev - ids.length))
        } else {
          // Re-fetch to get updated retry counts
          const dlqRes = await fetch('/api/admin/system/dlq')
          const dlqData = await dlqRes.json()
          if (dlqData.success) {
            setDlqEntries(dlqData.entries || [])
            setDlqTotal(dlqData.total || 0)
          }
        }
      }
    } catch {
      // Silently fail — user can retry manually
    } finally {
      setDlqActionLoading(null)
    }
  }, [])

  // Run diagnostics on mount and auto-refresh every 30 seconds
  useEffect(() => {
    runDiagnostics()
    const interval = setInterval(() => { runDiagnostics() }, 30000)
    return () => clearInterval(interval)
  }, [runDiagnostics])

  // Calculate stats
  const passCount = diagnostics?.results.filter((r: DiagnosticResult) => r.status === 'pass').length || 0
  const failCount = diagnostics?.results.filter((r: DiagnosticResult) => r.status === 'fail').length || 0
  const warningCount = diagnostics?.results.filter((r: DiagnosticResult) => r.status === 'warning').length || 0
  const totalLatency = diagnostics?.results.reduce((sum: number, r: DiagnosticResult) => sum + (r.latency || 0), 0) || 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-3">
            <Activity className="w-8 h-8 text-emerald-500" />
            System Status
          </h1>
          <p className="text-white/60 mt-1">
            Live diagnostics for all system integrations
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRun && (
            <div className="flex flex-col items-end">
              <span className="text-sm text-white/40 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Last run: {lastRun.toLocaleTimeString()}
              </span>
              <span className="text-xs text-white/30">Auto-refreshes every 30s</span>
            </div>
          )}
          <Button
            onClick={runDiagnostics}
            disabled={loading}
            className="bg-emerald-500 hover:bg-emerald-600 text-black"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Run Diagnostics
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Overall Status Card */}
      <Card className={cn(
        'border',
        diagnostics?.status === 'healthy' && 'bg-emerald-500/10 border-emerald-500/30',
        diagnostics?.status === 'warning' && 'bg-amber-500/10 border-amber-500/30',
        diagnostics?.status === 'degraded' && 'bg-red-500/10 border-red-500/30',
        !diagnostics && 'bg-white/5 border-white/10'
      )}>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {loading ? (
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
                </div>
              ) : diagnostics?.status === 'healthy' ? (
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
              ) : diagnostics?.status === 'warning' ? (
                <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-amber-400" />
                </div>
              ) : diagnostics?.status === 'degraded' ? (
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-red-400" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                  <Activity className="w-8 h-8 text-white/40" />
                </div>
              )}
              <div>
                <h2 className={cn(
                  'text-2xl font-bold',
                  diagnostics?.status === 'healthy' && 'text-emerald-400',
                  diagnostics?.status === 'warning' && 'text-amber-400',
                  diagnostics?.status === 'degraded' && 'text-red-400',
                  !diagnostics && 'text-white/60'
                )}>
                  {loading ? 'Running Diagnostics...' :
                   diagnostics?.status === 'healthy' ? 'All Systems Operational' :
                   diagnostics?.status === 'warning' ? 'Partial Issues Detected' :
                   diagnostics?.status === 'degraded' ? 'System Issues Detected' :
                   'Unknown Status'}
                </h2>
                <p className="text-white/60 mt-1">
                  {loading ? 'Checking all integrations...' :
                   error ? error :
                   `${passCount} passed, ${warningCount} warnings, ${failCount} failed`}
                </p>
              </div>
            </div>
            {diagnostics && (
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-400">{passCount}</p>
                  <p className="text-white/40">Passed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-400">{warningCount}</p>
                  <p className="text-white/40">Warnings</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-400">{failCount}</p>
                  <p className="text-white/40">Failed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">{totalLatency}ms</p>
                  <p className="text-white/40">Total Latency</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Individual Diagnostic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading ? (
          // Loading skeletons — show 9 placeholders
          [...Array(9)].map((_, i) => (
            <Card key={i} className="bg-[#0a0a0b] border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-white/5 animate-pulse" />
                  <div className="flex-1">
                    <div className="h-5 w-32 bg-white/5 rounded animate-pulse mb-2" />
                    <div className="h-4 w-48 bg-white/5 rounded animate-pulse" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : error ? (
          <Card className="bg-red-500/10 border-red-500/20 col-span-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <XCircle className="w-6 h-6 text-red-400" />
                <p className="text-red-400">{error}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          diagnostics?.results.map((result: DiagnosticResult) => (
            <DiagnosticCard key={result.name} result={result} />
          ))
        )}
      </div>

      {/* Edge Function Monitoring */}
      <Card className="bg-[#0a0a0b] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Cloud className="w-5 h-5 text-emerald-500" />
            Edge Function Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent>
          {edgeFnLoading ? (
            <div className="flex items-center gap-2 text-white/40">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading edge function metrics...
            </div>
          ) : edgeFunctions.length === 0 ? (
            <p className="text-white/40">No edge function data available</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/50">
                    <th className="text-left py-2 pr-4 font-medium">Function</th>
                    <th className="text-right py-2 px-3 font-medium">Invocations</th>
                    <th className="text-right py-2 px-3 font-medium">Errors</th>
                    <th className="text-right py-2 px-3 font-medium">Error Rate</th>
                    <th className="text-right py-2 px-3 font-medium">Avg Time</th>
                    <th className="text-right py-2 px-3 font-medium">P95 Time</th>
                    <th className="text-right py-2 pl-3 font-medium">Last Invoked</th>
                  </tr>
                </thead>
                <tbody>
                  {edgeFunctions.map((fn: EdgeFunctionMetrics) => (
                    <tr key={fn.functionName} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 pr-4 font-mono text-white">{fn.functionName}</td>
                      <td className="text-right py-2 px-3 text-white/70">{fn.totalInvocations}</td>
                      <td className="text-right py-2 px-3">
                        <span className={fn.errorCount > 0 ? 'text-red-400' : 'text-white/40'}>
                          {fn.errorCount}
                        </span>
                      </td>
                      <td className="text-right py-2 px-3">
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-xs font-mono',
                          fn.errorRate === 0 && 'bg-emerald-500/10 text-emerald-400',
                          fn.errorRate > 0 && fn.errorRate < 10 && 'bg-amber-500/10 text-amber-400',
                          fn.errorRate >= 10 && 'bg-red-500/10 text-red-400',
                        )}>
                          {fn.errorRate}%
                        </span>
                      </td>
                      <td className="text-right py-2 px-3 font-mono text-white/60">
                        {fn.totalInvocations > 0 ? `${fn.avgExecutionTimeMs}ms` : '—'}
                      </td>
                      <td className="text-right py-2 px-3 font-mono text-white/60">
                        {fn.totalInvocations > 0 ? `${fn.p95ExecutionTimeMs}ms` : '—'}
                      </td>
                      <td className="text-right py-2 pl-3 text-white/40 text-xs">
                        {fn.lastInvokedAt
                          ? new Date(fn.lastInvokedAt).toLocaleString()
                          : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dead Letter Queue */}
      <Card className="bg-[#0a0a0b] border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <Inbox className="w-5 h-5 text-emerald-500" />
              Dead Letter Queue
              {dlqTotal > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-mono">
                  {dlqTotal} unresolved
                </span>
              )}
            </CardTitle>
            {dlqEntries.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDlqAction('dismiss', dlqEntries.map((e: DLQEntry) => e.id))}
                disabled={dlqActionLoading !== null}
                className="text-white/60 border-white/20 hover:bg-white/5"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Dismiss All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {dlqLoading ? (
            <div className="flex items-center gap-2 text-white/40">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading dead letter queue...
            </div>
          ) : dlqEntries.length === 0 ? (
            <div className="flex items-center gap-2 text-white/40">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              No unresolved entries — all clear
            </div>
          ) : (
            <div className="space-y-3">
              {dlqEntries.map((entry: DLQEntry) => (
                <div
                  key={entry.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-white">{entry.event_type}</span>
                      <span className="text-xs text-white/30">from {entry.source}</span>
                      {entry.retry_count > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono">
                          {entry.retry_count} retries
                        </span>
                      )}
                    </div>
                    {entry.error_message && (
                      <p className="text-xs text-red-400/80 mt-1 truncate" title={entry.error_message}>
                        {entry.error_message}
                      </p>
                    )}
                    <p className="text-xs text-white/30 mt-1">
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDlqAction('retry', [entry.id])}
                      disabled={dlqActionLoading === entry.id}
                      className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      {dlqActionLoading === entry.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RotateCw className="w-3 h-3 mr-1" />
                      )}
                      Retry
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDlqAction('dismiss', [entry.id])}
                      disabled={dlqActionLoading === entry.id}
                      className="text-white/40 border-white/20 hover:bg-white/5"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="bg-[#0a0a0b] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-lg">Status Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-white/70">Pass</span>
              <span className="text-white/40 text-sm">- Service is operational</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-white/70">Warning</span>
              <span className="text-white/40 text-sm">- Partially configured or minor issue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-white/70">Fail</span>
              <span className="text-white/40 text-sm">- Service unavailable or not configured</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-3 h-3 text-white/70" />
              <span className="text-white/70">Circuit Breaker</span>
              <span className="text-white/40 text-sm">- Shows CLOSED/OPEN/HALF_OPEN state</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Individual Diagnostic Card Component
function DiagnosticCard({ result }: { result: DiagnosticResult }) {
  const Icon = diagnosticIcons[result.name] || Activity

  return (
    <Card className={cn(
      'border transition-colors',
      result.status === 'pass' && 'bg-[#0a0a0b] border-emerald-500/30 hover:border-emerald-500/50',
      result.status === 'warning' && 'bg-[#0a0a0b] border-amber-500/30 hover:border-amber-500/50',
      result.status === 'fail' && 'bg-[#0a0a0b] border-red-500/30 hover:border-red-500/50',
    )}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          {/* Status Icon */}
          <div className={cn(
            'w-12 h-12 rounded-lg flex items-center justify-center',
            result.status === 'pass' && 'bg-emerald-500/20',
            result.status === 'warning' && 'bg-amber-500/20',
            result.status === 'fail' && 'bg-red-500/20',
          )}>
            <Icon className={cn(
              'w-6 h-6',
              result.status === 'pass' && 'text-emerald-400',
              result.status === 'warning' && 'text-amber-400',
              result.status === 'fail' && 'text-red-400',
            )} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-white truncate">{result.name}</h3>
              {result.status === 'pass' ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              ) : result.status === 'warning' ? (
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              )}
            </div>
            <p className={cn(
              'text-sm mt-1',
              result.status === 'pass' && 'text-emerald-400/80',
              result.status === 'warning' && 'text-amber-400/80',
              result.status === 'fail' && 'text-red-400/80',
            )}>
              {result.message}
            </p>
            {result.details && (
              <p className="text-xs text-white/40 mt-2 truncate" title={result.details}>
                {result.details}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2">
              {result.latency !== undefined && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-white/30" />
                  <span className="text-xs text-white/30">{result.latency}ms</span>
                </div>
              )}
              {result.circuitState && (
                <div className={cn(
                  'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono',
                  result.circuitState === 'CLOSED' && 'bg-emerald-500/10 text-emerald-400',
                  result.circuitState === 'OPEN' && 'bg-red-500/10 text-red-400',
                  result.circuitState === 'HALF_OPEN' && 'bg-amber-500/10 text-amber-400',
                )}>
                  <Shield className="w-3 h-3" />
                  <span>{result.circuitState}</span>
                  {result.failureCount !== undefined && result.failureCount > 0 && (
                    <span className="text-white/40">({result.failureCount})</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
