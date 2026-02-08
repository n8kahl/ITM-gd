'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

// ============================================
// TYPES
// ============================================

export interface DataTableColumn<T> {
  key: string
  header: string
  sortable?: boolean
  className?: string
  headerClassName?: string
  render?: (value: any, row: T, index: number) => React.ReactNode
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  keyField?: string
  pageSize?: number
  emptyMessage?: string
  onRowClick?: (row: T) => void
  className?: string
  stickyHeader?: boolean
}

// ============================================
// COMPONENT
// ============================================

/**
 * V3 Redesign: Sortable, paginated glass-card data table.
 * Follows the spec: Glass Card container, sticky header,
 * alternating rows, Geist Mono for numbers.
 */
export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField = 'id',
  pageSize = 25,
  emptyMessage = 'No data available',
  onRowClick,
  className,
  stickyHeader = true,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(0)

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortKey) return data

    return [...data].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]

      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }

      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      return sortDirection === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr)
    })
  }, [data, sortKey, sortDirection])

  // Paginate
  const totalPages = Math.ceil(sortedData.length / pageSize)
  const paginatedData = sortedData.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  )

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
    setCurrentPage(0)
  }

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortKey !== columnKey) return <ChevronsUpDown className="w-3 h-3 text-muted-foreground/40" />
    return sortDirection === 'asc'
      ? <ChevronUp className="w-3 h-3 text-emerald-400" />
      : <ChevronDown className="w-3 h-3 text-emerald-400" />
  }

  return (
    <div className={cn(
      // Glass Card
      'rounded-2xl overflow-hidden',
      'bg-white/[0.02] backdrop-blur-[60px] saturate-[1.2]',
      'border border-white/[0.08]',
      'shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]',
      className
    )}>
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* Header */}
          <thead>
            <tr className={cn(
              'bg-white/5',
              stickyHeader && 'sticky top-0 z-10'
            )}>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left',
                    'text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground',
                    col.sortable && 'cursor-pointer select-none hover:text-ivory transition-colors',
                    col.headerClassName
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && <SortIcon columnKey={col.key} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => (
                <tr
                  key={row[keyField] || index}
                  className={cn(
                    'border-b border-white/5 transition-colors',
                    'hover:bg-white/[0.03]',
                    index % 2 === 0 && 'bg-white/[0.01]',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className={cn('px-4 py-3 text-sm', col.className)}
                    >
                      {col.render
                        ? col.render(row[col.key], row, index)
                        : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            Showing {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, sortedData.length)} of {sortedData.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="px-2 py-1 rounded text-xs text-muted-foreground hover:text-ivory hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const page = totalPages <= 5
                ? i
                : Math.max(0, Math.min(currentPage - 2, totalPages - 5)) + i
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={cn(
                    'w-7 h-7 rounded text-xs font-mono transition-colors',
                    page === currentPage
                      ? 'bg-emerald-900/30 text-emerald-400'
                      : 'text-muted-foreground hover:text-ivory hover:bg-white/5'
                  )}
                >
                  {page + 1}
                </button>
              )
            })}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="px-2 py-1 rounded text-xs text-muted-foreground hover:text-ivory hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
