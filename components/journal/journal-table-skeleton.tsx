import { Skeleton } from '@/components/ui/skeleton-loader'

interface JournalTableSkeletonProps {
  rows?: number
}

export function JournalTableSkeleton({ rows = 10 }: JournalTableSkeletonProps) {
  const columnWidths = ['w-12', 'w-14', 'w-16', 'w-12', 'w-12', 'w-14', 'w-12', 'w-8', 'w-14', 'w-16', 'w-10']

  return (
    <div className="glass-card-heavy rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-white/[0.02] border-b border-white/[0.03]">
              {columnWidths.map((widthClass, idx) => (
                <th key={`head-${idx}`} className="px-4 py-3 text-left">
                  <Skeleton className={`h-2 ${widthClass}`} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, index) => (
              <tr key={index} className="border-b border-white/[0.03]">
                <td className="px-4 py-2.5">
                  <Skeleton className="h-3 w-11" />
                </td>
                <td className="px-4 py-2.5">
                  <Skeleton className="h-3 w-14" />
                </td>
                <td className="px-4 py-2.5">
                  <Skeleton className="h-5 w-16 rounded-full" />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Skeleton className="h-3 w-12 ml-auto" />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Skeleton className="h-3 w-12 ml-auto" />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Skeleton className="h-3 w-14 ml-auto" />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Skeleton className="h-3 w-12 ml-auto" />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <Skeleton className="h-7 w-7 rounded-full mx-auto" />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <Skeleton className="h-3 w-14 mx-auto" />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1">
                    <Skeleton className="h-4 w-10 rounded-full" />
                    <Skeleton className="h-4 w-8 rounded-full" />
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <Skeleton className="h-6 w-6 rounded-md" />
                    <Skeleton className="h-6 w-6 rounded-md" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
