'use client'

import Link from 'next/link'
import { RotateCcw, Brain, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AcademyReviewPage() {
  return (
    <div className="space-y-5">
      <div
        className={cn(
          'rounded-2xl border border-white/10 bg-[#0A0A0B]/60 backdrop-blur-xl p-5',
          'flex flex-col gap-2'
        )}
      >
        <div className="flex items-center gap-2 text-emerald-300">
          <RotateCcw className="w-4 h-4" />
          <h1 className="text-sm font-semibold uppercase tracking-[0.12em]">Review Queue</h1>
        </div>
        <p className="text-sm text-white/70">
          Reinforce key concepts with spaced retrieval sessions and quick scenario checks.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0A0A0B]/60 backdrop-blur-xl p-6">
        <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
          <Brain className="w-3.5 h-3.5" />
          Retrieval + Spacing
        </div>
        <h2 className="mt-4 text-lg font-semibold text-white">Review sessions are being prepared</h2>
        <p className="mt-2 text-sm text-white/60 max-w-2xl">
          This area will surface due concepts at 24h, 72h, and 7d intervals based on your lesson performance.
          Until then, continue learning from the Library and we will auto-generate your queue.
        </p>
        <Link
          href="/members/academy/courses"
          className="inline-flex items-center gap-2 mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
        >
          Continue in Library
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  )
}
