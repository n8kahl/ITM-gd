'use client'

import { Skeleton, SkeletonText } from '@/components/ui/skeleton-loader'

function ModuleListSkeleton() {
  return (
    <div className="glass-card-heavy rounded-xl border border-white/10 p-4">
      <Skeleton className="mb-3 h-4 w-32" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-md border border-white/10 p-3">
            <Skeleton className="h-12 w-12 shrink-0 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LessonListSkeleton() {
  return (
    <div className="glass-card-heavy rounded-xl border border-white/10 p-4">
      <Skeleton className="mb-3 h-4 w-28" />
      <div className="space-y-2">
        <div className="rounded-md border border-white/10 p-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-2 h-28 w-full rounded-md" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-md border border-white/10 p-2">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="mt-1 h-3 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ContentSkeleton() {
  return (
    <div className="glass-card-heavy rounded-xl border border-white/10 p-4">
      <Skeleton className="mb-3 h-4 w-36" />
      <div className="space-y-4">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <SkeletonText lines={4} lastLineWidth="80%" />
      </div>
    </div>
  )
}

export default function ModulesLoading() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-6">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <ModuleListSkeleton />
        <LessonListSkeleton />
        <ContentSkeleton />
      </div>
    </div>
  )
}
