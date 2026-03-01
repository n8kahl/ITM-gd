'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react'
import { PageHeader } from '@/components/members/page-header'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton-loader'
import { Textarea } from '@/components/ui/textarea'
import { ReplaySessionBrowser } from '@/components/spx-command-center/replay-session-browser'
import { ReplayChart } from '@/components/trade-day-replay/replay-chart'
import { SessionAnalysis } from '@/components/trade-day-replay/session-analysis'
import type { ReplayPayload } from '@/lib/trade-day-replay/types'

const DEFAULT_TIMEZONE = 'America/Chicago'
const FALLBACK_MAX_TRANSCRIPT_CHARS = 120_000
const BUILD_REQUEST_TIMEOUT_MS = 95_000
const TIMEZONE_OPTIONS = [
  'America/Chicago',
  'America/New_York',
  'America/Denver',
  'America/Los_Angeles',
  'UTC',
]

type HealthStatus = 'checking' | 'ready' | 'forbidden' | 'error'

interface TradeDayReplayHealthLimits {
  maxTranscriptChars: number
  maxParsedTrades: number
}

interface TradeDayReplayHealthResponse {
  ok: boolean
  limits?: Partial<TradeDayReplayHealthLimits>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toPositiveInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : null
}

function parseHealthResponse(payload: unknown): TradeDayReplayHealthResponse | null {
  if (!isRecord(payload) || typeof payload.ok !== 'boolean') {
    return null
  }

  if (!isRecord(payload.limits)) {
    return { ok: payload.ok }
  }

  const maxTranscriptChars = toPositiveInteger(payload.limits.maxTranscriptChars)
  const maxParsedTrades = toPositiveInteger(payload.limits.maxParsedTrades)

  return {
    ok: payload.ok,
    limits: {
      maxTranscriptChars: maxTranscriptChars ?? undefined,
      maxParsedTrades: maxParsedTrades ?? undefined,
    },
  }
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => null)

  if (payload && typeof payload === 'object') {
    const message = 'message' in payload && typeof payload.message === 'string'
      ? payload.message
      : null
    const error = 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : null

    if (message?.trim()) return message
    if (error?.trim()) return error
  }

  return fallback
}

export function TradeDayReplayShell() {
  const [transcript, setTranscript] = useState('')
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE)

  const [healthStatus, setHealthStatus] = useState<HealthStatus>('checking')
  const [healthError, setHealthError] = useState<string | null>(null)
  const [maxTranscriptChars, setMaxTranscriptChars] = useState(FALLBACK_MAX_TRANSCRIPT_CHARS)

  const [isBuilding, setIsBuilding] = useState(false)
  const [buildError, setBuildError] = useState<string | null>(null)
  const [payload, setPayload] = useState<ReplayPayload | null>(null)
  const transcriptLength = transcript.length
  const isTranscriptOverLimit = transcriptLength > maxTranscriptChars

  const replaySummary = useMemo(() => {
    if (!payload) return null

    return {
      tradeCount: payload.trades.length,
      barCount: payload.bars.length,
      stats: payload.stats,
    }
  }, [payload])

  const runHealthPreflight = useCallback(async () => {
    setHealthStatus('checking')
    setHealthError(null)

    try {
      const response = await fetch('/api/trade-day-replay/health', {
        method: 'GET',
        cache: 'no-store',
      })

      if (response.status === 403) {
        setHealthStatus('forbidden')
        return
      }

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, `Health check failed (${response.status})`))
      }

      const healthPayload = parseHealthResponse(await response.json().catch(() => null))
      if (healthPayload?.ok !== true) {
        throw new Error('Trade Day Replay health response was invalid.')
      }
      const nextMaxTranscriptChars = healthPayload?.limits?.maxTranscriptChars ?? FALLBACK_MAX_TRANSCRIPT_CHARS
      setMaxTranscriptChars(nextMaxTranscriptChars)
      setHealthStatus('ready')
    } catch (error) {
      setHealthStatus('error')
      setHealthError(toErrorMessage(error, 'Failed to reach the Trade Day Replay backend health endpoint.'))
    }
  }, [])

  useEffect(() => {
    void runHealthPreflight()
  }, [runHealthPreflight])

  const handleBuildReplay = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (healthStatus !== 'ready') {
      return
    }

    if (isTranscriptOverLimit) {
      return
    }

    const trimmedTranscript = transcript.trim()
    if (!trimmedTranscript) {
      setBuildError('Paste a transcript before building replay.')
      return
    }

    setBuildError(null)
    setPayload(null)
    setIsBuilding(true)
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let didTimeout = false

    try {
      const controller = new AbortController()
      timeoutId = setTimeout(() => {
        didTimeout = true
        controller.abort()
      }, BUILD_REQUEST_TIMEOUT_MS)

      const response = await fetch('/api/trade-day-replay/build', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          transcript: trimmedTranscript,
          inputTimezone: timezone,
        }),
      })

      if (response.status === 403) {
        setHealthStatus('forbidden')
        setBuildError(null)
        return
      }

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response, `Replay build failed (${response.status})`))
      }

      const nextPayload = await response.json() as ReplayPayload
      setPayload(nextPayload)
    } catch (error) {
      if (didTimeout && error instanceof DOMException && error.name === 'AbortError') {
        setBuildError('Replay build timed out. Try a shorter transcript or split the day into smaller chunks.')
        return
      }
      setBuildError(toErrorMessage(error, 'Failed to build trade day replay payload.'))
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      setIsBuilding(false)
    }
  }, [healthStatus, isTranscriptOverLimit, timezone, transcript])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Trade Day Replay"
        subtitle="Pick a recorded replay session by day, or paste a transcript to build a replay payload with intraday controls and marker overlays."
        breadcrumbs={[
          { label: 'Dashboard', href: '/members' },
          { label: 'Trade Day Replay' },
        ]}
      />

      <section className="rounded-xl border border-white/10 bg-white/5 p-4 lg:p-6">
        <div className="mb-3 space-y-1">
          <h2 className="text-sm font-semibold text-ivory">Replay Sessions</h2>
          <p className="text-xs text-white/60">
            Choose a day chip, select a session, and replay it directly from this tab.
          </p>
        </div>
        <ReplaySessionBrowser />
      </section>

      {(healthStatus === 'checking' || isBuilding) ? <Skeleton variant="screen" /> : null}

      {healthStatus === 'forbidden' ? (
        <section className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-300">
            <ShieldAlert className="h-4 w-4" />
            Backend admin access not configured
          </h2>
          <p className="mt-2 text-sm text-amber-200/90">
            Your account can view this page, but the backend admin check returned 403. Ask an administrator to set `profiles.role = admin`.
          </p>
        </section>
      ) : null}

      {healthStatus === 'error' ? (
        <section className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-red-300">
            <AlertTriangle className="h-4 w-4" />
            Trade Day Replay preflight failed
          </h2>
          <p className="mt-2 text-sm text-red-200/90">
            {healthError || 'Unable to verify backend readiness.'}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => void runHealthPreflight()}
          >
            <RefreshCw className="h-4 w-4" />
            Retry Health Check
          </Button>
        </section>
      ) : null}

      {healthStatus === 'ready' ? (
        <section className="rounded-xl border border-white/10 bg-white/5 p-4 lg:p-6">
          <form className="space-y-4" onSubmit={handleBuildReplay}>
            <div className="space-y-2">
              <Label htmlFor="trade-day-replay-transcript">Transcript</Label>
              <Textarea
                id="trade-day-replay-transcript"
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                placeholder="Paste Discord transcript messages..."
                className="min-h-[220px]"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <p className={isTranscriptOverLimit ? 'text-red-300' : 'text-white/60'}>
                  {transcriptLength}/{maxTranscriptChars} characters
                </p>
                {isTranscriptOverLimit ? (
                  <p className="text-red-300">
                    Transcript exceeds the {maxTranscriptChars} character limit.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[240px_1fr] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="trade-day-replay-timezone">Input Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger id="trade-day-replay-timezone">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-start md:justify-end">
                <Button
                  type="submit"
                  disabled={isBuilding || transcript.trim().length === 0 || isTranscriptOverLimit}
                >
                  {isBuilding ? 'Building Replay...' : 'Build Replay'}
                </Button>
              </div>
            </div>
          </form>

          {buildError ? (
            <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {buildError}
            </div>
          ) : null}

          {payload ? (
            <>
              <ReplayChart bars={payload.bars} trades={payload.trades} priorDayBar={payload.priorDayBar} />
              <SessionAnalysis payload={payload} />
            </>
          ) : null}

          {replaySummary ? (
            <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
              <h3 className="text-sm font-semibold text-ivory">Replay Summary (JSON)</h3>
              <pre className="mt-3 overflow-x-auto rounded-md border border-white/10 bg-black/30 p-3 text-xs text-emerald-100">
                {JSON.stringify(replaySummary, null, 2)}
              </pre>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
