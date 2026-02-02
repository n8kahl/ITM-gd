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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface DiagnosticResult {
  name: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  details?: string
  latency?: number
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
  'Discord Bot': Bot,
  'Storage': HardDrive,
}

export default function SystemPage() {
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRun, setLastRun] = useState<Date | null>(null)

  const runDiagnostics = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/system')
      const data = await response.json()

      if (data.success) {
        setDiagnostics(data)
        setLastRun(new Date())
      } else {
        setError(data.error || 'Failed to run diagnostics')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }, [])

  // Run diagnostics on mount and auto-refresh every 30 seconds
  useEffect(() => {
    runDiagnostics()

    // Set up auto-refresh interval
    const interval = setInterval(() => {
      runDiagnostics()
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [runDiagnostics])

  // Calculate stats
  const passCount = diagnostics?.results.filter(r => r.status === 'pass').length || 0
  const failCount = diagnostics?.results.filter(r => r.status === 'fail').length || 0
  const warningCount = diagnostics?.results.filter(r => r.status === 'warning').length || 0
  const totalLatency = diagnostics?.results.reduce((sum, r) => sum + (r.latency || 0), 0) || 0

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
          // Loading skeletons
          [...Array(5)].map((_, i) => (
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
          diagnostics?.results.map((result) => (
            <DiagnosticCard key={result.name} result={result} />
          ))
        )}
      </div>

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
            {result.latency !== undefined && (
              <div className="flex items-center gap-1 mt-2">
                <Clock className="w-3 h-3 text-white/30" />
                <span className="text-xs text-white/30">{result.latency}ms</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
