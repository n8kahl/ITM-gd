'use client'

import { Skeleton } from '@/components/ui/skeleton-loader'

export default function AcademyModulesLoading() {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-6">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((section) => (
          <div key={section} className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((card) => (
                <div key={`${section}-${card}`} className="glass-card-heavy rounded-xl border border-white/10 p-3">
                  <Skeleton className="h-32 rounded-md" />
                  <Skeleton className="mt-3 h-4 w-3/4" />
                  <Skeleton className="mt-2 h-3 w-1/2" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
