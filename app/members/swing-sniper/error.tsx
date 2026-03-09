'use client'

import { useEffect } from 'react'

export default function SwingSniperError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Swing Sniper Error]', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="glass-card-heavy mx-auto max-w-md rounded-2xl border border-white/10 p-8 text-center">
        <h2 className="text-lg font-semibold text-white">Swing Sniper is temporarily unavailable</h2>
        <p className="mt-2 text-sm text-zinc-400">
          The route shell hit an unexpected error. Retry the page before continuing implementation testing.
        </p>
        {error.digest ? <p className="mt-2 font-mono text-xs text-zinc-500">Error ID: {error.digest}</p> : null}
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-lg bg-emerald-500/20 px-6 py-2.5 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-500/30"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
