'use client'

import { Skeleton, SkeletonText } from '@/components/ui/skeleton-loader'

export default function AcademyLessonLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Skeleton className="h-4 w-40" />
      <div className="glass-card-heavy rounded-xl border border-white/10 p-5">
        <Skeleton className="h-6 w-56" />
        <SkeletonText lines={2} className="mt-3" lastLineWidth="60%" />
        <Skeleton className="mt-4 h-52 w-full rounded-lg" />
        <SkeletonText lines={5} className="mt-4" lastLineWidth="50%" />
      </div>
      <div className="glass-card-heavy rounded-xl border border-white/10 p-4">
        <Skeleton className="h-4 w-56" />
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Skeleton className="h-9 rounded-lg" />
          <Skeleton className="h-9 rounded-lg" />
          <Skeleton className="h-9 rounded-lg" />
        </div>
      </div>
    </div>
  )
}
