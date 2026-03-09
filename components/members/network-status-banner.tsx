'use client'

import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOnlineStatus } from '@/hooks/use-online-status'

function formatLastHealthy(lastHealthyAt: number | null): string | null {
  if (!lastHealthyAt) return null

  const secondsAgo = Math.round((Date.now() - lastHealthyAt) / 1000)
  if (secondsAgo < 60) {
    return `Last healthy ${secondsAgo}s ago`
  }

  const minutesAgo = Math.round(secondsAgo / 60)
  return `Last healthy ${minutesAgo}m ago`
}

export function NetworkStatusBanner() {
  const { status, isChecking, lastHealthyAt, retry } = useOnlineStatus()

  if (status === 'online') return null

  const isOffline = status === 'offline'
  const detail = isOffline
    ? 'No network connection. Cached areas remain available until reconnect.'
    : formatLastHealthy(lastHealthyAt) ?? 'Connection is unstable. Retrying in background.'

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--members-topbar-h)+0.35rem)] z-50 px-3 lg:top-4">
      <div
        className={cn(
          'pointer-events-auto mx-auto flex max-w-3xl items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs shadow-lg backdrop-blur-xl',
          isOffline
            ? 'border-amber-400/30 bg-amber-500/15 text-amber-100'
            : 'border-orange-400/35 bg-orange-500/15 text-orange-100',
        )}
      >
        <div className="min-w-0 flex items-center gap-2">
          {isOffline ? <WifiOff className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate">{detail}</span>
        </div>

        <button
          type="button"
          onClick={() => {
            void retry()
          }}
          disabled={isChecking}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/20 bg-black/20 px-2 py-1 text-[10px] font-semibold text-white/90 hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={cn('h-3 w-3', isChecking && 'animate-spin')} />
          {isChecking ? 'Checking' : 'Retry'}
        </button>
      </div>
    </div>
  )
}
