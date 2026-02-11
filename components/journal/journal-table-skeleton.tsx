import { Skeleton } from '@/components/ui/skeleton-loader'

interface JournalTableSkeletonProps {
  rows?: number
}

export function JournalTableSkeleton({ rows = 10 }: JournalTableSkeletonProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-3 py-3 text-left">
                <Skeleton className="h-4 w-16" animation="shimmer" />
              </th>
              <th className="px-3 py-3 text-left">
                <Skeleton className="h-4 w-20" animation="shimmer" />
              </th>
              <th className="px-3 py-3 text-left hidden md:table-cell">
                <Skeleton className="h-4 w-24" animation="shimmer" />
              </th>
              <th className="px-3 py-3 text-left hidden lg:table-cell">
                <Skeleton className="h-4 w-20" animation="shimmer" />
              </th>
              <th className="px-3 py-3 text-left">
                <Skeleton className="h-4 w-20" animation="shimmer" />
              </th>
              <th className="px-3 py-3 text-left hidden md:table-cell">
                <Skeleton className="h-4 w-20" animation="shimmer" />
              </th>
              <th className="px-3 py-3 text-left hidden xl:table-cell">
                <Skeleton className="h-4 w-16" animation="shimmer" />
              </th>
              <th className="px-3 py-3 text-left hidden 2xl:table-cell">
                <Skeleton className="h-4 w-24" animation="shimmer" />
              </th>
              <th className="px-3 py-3 text-left hidden xl:table-cell">
                <Skeleton className="h-4 w-16" animation="shimmer" />
              </th>
              <th className="px-3 py-3 text-left hidden 2xl:table-cell">
                <Skeleton className="h-4 w-16" animation="shimmer" />
              </th>
              <th className="px-3 py-3 text-right">
                <Skeleton className="ml-auto h-4 w-20" animation="shimmer" />
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, index) => (
              <tr key={index} className="border-b border-white/10">
                <td className="px-3 py-3">
                  <Skeleton className="h-4 w-12" animation="shimmer" />
                </td>
                <td className="px-3 py-3">
                  <Skeleton className="h-4 w-16" animation="shimmer" />
                </td>
                <td className="px-3 py-3 hidden md:table-cell">
                  <Skeleton className="h-4 w-20" animation="shimmer" />
                </td>
                <td className="px-3 py-3 hidden lg:table-cell">
                  <Skeleton className="h-4 w-16" animation="shimmer" />
                </td>
                <td className="px-3 py-3">
                  <Skeleton className="h-4 w-16" animation="shimmer" />
                </td>
                <td className="px-3 py-3 hidden md:table-cell">
                  <Skeleton className="h-4 w-16" animation="shimmer" />
                </td>
                <td className="px-3 py-3 hidden xl:table-cell">
                  <Skeleton className="h-4 w-12" animation="shimmer" />
                </td>
                <td className="px-3 py-3 hidden 2xl:table-cell">
                  <Skeleton className="h-4 w-20" animation="shimmer" />
                </td>
                <td className="px-3 py-3 hidden xl:table-cell">
                  <Skeleton className="h-4 w-12" animation="shimmer" />
                </td>
                <td className="px-3 py-3 hidden 2xl:table-cell">
                  <Skeleton className="h-4 w-12" animation="shimmer" />
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Skeleton className="h-6 w-12" animation="shimmer" />
                    <Skeleton className="h-6 w-12" animation="shimmer" />
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
