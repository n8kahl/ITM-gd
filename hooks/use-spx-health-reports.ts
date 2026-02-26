'use client'

import { useCallback, useEffect, useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase-browser'

export type HealthReportType = 'daily_health' | 'optimizer_drift' | 'shadow_gate' | 'build_validation'
export type HealthReportStatus = 'pass' | 'warn' | 'fail' | 'info'

export interface HealthReport {
  id: number
  report_type: HealthReportType
  session_date: string | null
  status: HealthReportStatus
  summary: Record<string, unknown>
  full_report: Record<string, unknown>
  created_at: string
}

interface UseHealthReportsReturn {
  /** Latest report per type (up to 4) */
  latestByType: Record<string, HealthReport | null>
  /** Recent history (last 14 days) */
  recentReports: HealthReport[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const supabase = createBrowserSupabase()

export function useSpxHealthReports(): UseHealthReportsReturn {
  const [latestByType, setLatestByType] = useState<Record<string, HealthReport | null>>({
    daily_health: null,
    optimizer_drift: null,
    shadow_gate: null,
    build_validation: null,
  })
  const [recentReports, setRecentReports] = useState<HealthReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReports = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch latest report per type using a single query sorted by created_at desc
      const { data: recent, error: recentErr } = await supabase
        .from('spx_system_health_reports')
        .select('id,report_type,session_date,status,summary,full_report,created_at')
        .gte('created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(50)

      if (recentErr) {
        setError(recentErr.message)
        return
      }

      const rows = (recent ?? []) as HealthReport[]
      setRecentReports(rows)

      // Derive latest per type
      const byType: Record<string, HealthReport | null> = {
        daily_health: null,
        optimizer_drift: null,
        shadow_gate: null,
        build_validation: null,
      }
      for (const row of rows) {
        if (!byType[row.report_type]) {
          byType[row.report_type] = row
        }
      }
      setLatestByType(byType)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchReports()
  }, [fetchReports])

  return { latestByType, recentReports, isLoading, error, refresh: fetchReports }
}
