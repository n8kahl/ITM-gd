'use client'

import { useEffect } from 'react'

export default function AcademyProgressError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Academy Progress Error]', error)
  }, [error])

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4">
      <div className="glass-card-heavy mx-auto max-w-md rounded-2xl border border-white/10 p-8 text-center">
        <h2 className="text-lg font-semibold text-white">Progress data unavailable</h2>
        <p className="mt-2 text-sm text-zinc-400">Could not load your competency progress. Please try again.</p>
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
