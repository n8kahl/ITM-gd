import { Skeleton } from '@/components/ui/skeleton-loader'

interface JournalCardSkeletonProps {
  cards?: number
}

export function JournalCardSkeleton({ cards = 6 }: JournalCardSkeletonProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: cards }).map((_, index) => (
        <article key={index} className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-5 w-16" animation="shimmer" />
            <Skeleton className="h-5 w-12 rounded-full" animation="shimmer" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-24" animation="shimmer" />
            <Skeleton className="h-4 w-20" animation="shimmer" />
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-white/10 pt-3">
            <Skeleton className="h-9 w-16" animation="shimmer" />
            <Skeleton className="h-9 w-20" animation="shimmer" />
            <Skeleton className="h-9 w-16" animation="shimmer" />
          </div>
        </article>
      ))}
    </div>
  )
}
