'use client'

import Link from 'next/link'
import { Bookmark, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AcademySavedPage() {
  return (
    <div className="space-y-5">
      <div
        className={cn(
          'rounded-2xl border border-white/10 bg-[#0A0A0B]/60 backdrop-blur-xl p-5',
          'flex flex-col gap-2'
        )}
      >
        <div className="flex items-center gap-2 text-emerald-300">
          <Bookmark className="w-4 h-4" />
          <h1 className="text-sm font-semibold uppercase tracking-[0.12em]">Saved</h1>
        </div>
        <p className="text-sm text-white/70">
          Your saved lessons, drills, and references will appear here for quick access.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0A0A0B]/60 backdrop-blur-xl p-6">
        <h2 className="text-lg font-semibold text-white">No saved training items yet</h2>
        <p className="mt-2 text-sm text-white/60">
          Save any lesson from the Library to build a personal watchlist of topics you want to revisit.
        </p>
        <Link
          href="/members/academy/courses"
          className="inline-flex items-center gap-2 mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
        >
          Explore Library
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  )
}
