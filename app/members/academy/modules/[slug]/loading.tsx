'use client'

import { Skeleton, SkeletonText } from '@/components/ui/skeleton-loader'

export default function AcademyModuleDetailLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-40" />
      <div className="glass-card-heavy rounded-xl border border-white/10 p-5">
        <Skeleton className="h-6 w-64" />
        <SkeletonText lines={2} className="mt-3" lastLineWidth="50%" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="glass-card-heavy rounded-xl border border-white/10 p-4">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}
