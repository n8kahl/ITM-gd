'use client'

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-white/7 ${className}`} />
}

export function ChartSkeleton() {
  return (
    <div className="h-full p-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 h-full">
        <div className="flex items-center justify-between mb-4">
          <SkeletonBlock className="h-4 w-28" />
          <SkeletonBlock className="h-4 w-20" />
        </div>
        <div className="grid grid-cols-5 gap-2 mb-4">
          {Array.from({ length: 5 }).map((_, idx) => (
            <SkeletonBlock key={`chart-tab-${idx}`} className="h-7 w-full" />
          ))}
        </div>
        <SkeletonBlock className="h-[calc(100%-5.5rem)] w-full" />
      </div>
    </div>
  )
}

export function OptionsSkeleton() {
  return (
    <div className="h-full p-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 h-full">
        <div className="flex items-center justify-between mb-4">
          <SkeletonBlock className="h-4 w-40" />
          <SkeletonBlock className="h-4 w-24" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <SkeletonBlock className="h-24 w-full" />
          <SkeletonBlock className="h-24 w-full" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, idx) => (
            <SkeletonBlock key={`options-row-${idx}`} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function BriefSkeleton() {
  return (
    <div className="h-full p-4 space-y-4">
      <SkeletonBlock className="h-20 w-full" />
      <SkeletonBlock className="h-36 w-full" />
      <SkeletonBlock className="h-28 w-full" />
      <SkeletonBlock className="h-32 w-full" />
      <SkeletonBlock className="h-32 w-full" />
    </div>
  )
}

export function ScannerSkeleton() {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <SkeletonBlock className="h-8 w-24" />
        <SkeletonBlock className="h-8 w-24" />
        <SkeletonBlock className="h-8 w-24" />
      </div>
      {Array.from({ length: 5 }).map((_, idx) => (
        <SkeletonBlock key={`scanner-card-${idx}`} className="h-28 w-full" />
      ))}
    </div>
  )
}
