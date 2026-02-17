'use client'

import { useEffect } from 'react'

export default function ReviewError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Academy Review Error]', error)
  }, [error])

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4">
      <div className="glass-card-heavy mx-auto max-w-md rounded-2xl border border-white/10 p-8 text-center">
        <h2 className="text-lg font-semibold text-white">Review queue unavailable</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Could not load your review items. Please try again.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-zinc-500">Ref: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-lg bg-emerald-500/20 px-6 py-2.5 text-sm font-medium text-emerald-200 transition-colors hover:bg-emerald-500/30"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
