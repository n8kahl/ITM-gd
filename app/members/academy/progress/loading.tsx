'use client'

import { Skeleton } from '@/components/ui/skeleton-loader'

export default function AcademyProgressLoading() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-6">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-3 h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card-heavy rounded-xl border border-white/10 p-4">
            <Skeleton className="mb-3 h-4 w-28" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="mt-2 h-4 w-40" />
          </div>
        ))}
      </div>
      <div className="glass-card-heavy rounded-xl border border-white/10 p-4">
        <Skeleton className="mb-3 h-4 w-40" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-md border border-white/10 p-3">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
