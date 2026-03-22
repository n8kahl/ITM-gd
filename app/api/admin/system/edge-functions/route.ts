import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/supabase-server'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

// Known edge functions in this project
const EDGE_FUNCTIONS = [
  'aggregate-chat-analytics',
  'analyze-trade-screenshot',
  'chat-visitor-sync',
  'compute-leaderboards',
  'create-team-member',
  'cron-archive-conversations',
  'handle-chat-message',
  'notify-team-lead',
  'send-chat-transcript',
  'send-push-notification',
  'sync-discord-roles',
] as const

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

// GET - Edge function execution metrics (last 24h by default)
export async function GET(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const hoursBack = Math.min(parseInt(searchParams.get('hours') || '24', 10), 168)

  try {
    const supabase = getSupabaseAdmin()
    const since = new Date(Date.now() - hoursBack * 3600000).toISOString()

    // Query aggregated metrics per function
    const { data: logs, error } = await supabase
      .from('edge_function_logs')
      .select('function_name, status, execution_time_ms, error_message, invoked_at')
      .gte('invoked_at', since)
      .order('invoked_at', { ascending: false })

    if (error) {
      // Table may not exist yet — return empty metrics
      if (error.code === '42P01') {
        return NextResponse.json({
          success: true,
          metrics: EDGE_FUNCTIONS.map(fn => buildEmptyMetrics(fn)),
          hoursBack,
          tableExists: false,
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group by function name and compute metrics
    const byFunction = new Map<string, Array<{ status: string; execution_time_ms: number; error_message: string | null; invoked_at: string }>>()
    for (const fn of EDGE_FUNCTIONS) {
      byFunction.set(fn, [])
    }
    for (const log of logs || []) {
      const existing = byFunction.get(log.function_name)
      if (existing) {
        existing.push(log)
      } else {
        byFunction.set(log.function_name, [log])
      }
    }

    const metrics: EdgeFunctionMetrics[] = []
    for (const [fnName, fnLogs] of byFunction) {
      if (fnLogs.length === 0) {
        metrics.push(buildEmptyMetrics(fnName))
        continue
      }

      const successCount = fnLogs.filter(l => l.status === 'success').length
      const errorCount = fnLogs.filter(l => l.status === 'error').length
      const totalInvocations = fnLogs.length
      const executionTimes = fnLogs.map(l => l.execution_time_ms).sort((a, b) => a - b)
      const avgExecutionTimeMs = Math.round(executionTimes.reduce((s, t) => s + t, 0) / totalInvocations)
      const p95Index = Math.min(Math.floor(totalInvocations * 0.95), totalInvocations - 1)
      const p95ExecutionTimeMs = executionTimes[p95Index]
      const lastError = fnLogs.find(l => l.status === 'error')?.error_message || null

      metrics.push({
        functionName: fnName,
        totalInvocations,
        successCount,
        errorCount,
        errorRate: totalInvocations > 0 ? Math.round((errorCount / totalInvocations) * 100) : 0,
        avgExecutionTimeMs,
        p95ExecutionTimeMs,
        lastInvokedAt: fnLogs[0].invoked_at,
        lastError,
      })
    }

    return NextResponse.json({
      success: true,
      metrics,
      hoursBack,
      tableExists: true,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

function buildEmptyMetrics(functionName: string): EdgeFunctionMetrics {
  return {
    functionName,
    totalInvocations: 0,
    successCount: 0,
    errorCount: 0,
    errorRate: 0,
    avgExecutionTimeMs: 0,
    p95ExecutionTimeMs: 0,
    lastInvokedAt: null,
    lastError: null,
  }
}
