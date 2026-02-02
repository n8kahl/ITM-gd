'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { deleteEntry } from '@/app/actions/journal'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Entry {
  id: string
  trade_date: string
  symbol: string
  direction: 'long' | 'short' | 'neutral' | null
  entry_price: number | null
  exit_price: number | null
  pnl: number | null
  pnl_percentage: number | null
  is_winner: boolean | null
  rating: number | null
  tags: string[]
}

interface EntriesTableProps {
  entries: Entry[]
  onEdit: (entry: Entry) => void
  onRefresh: () => void
}

export function EntriesTable({ entries, onEdit, onRefresh }: EntriesTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteId) return

    setIsDeleting(true)
    const result = await deleteEntry(deleteId)

    if (result.success) {
      toast.success('Entry deleted')
      onRefresh()
      setDeleteId(null)
    } else {
      toast.error(result.error || 'Failed to delete entry')
    }

    setIsDeleting(false)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-'
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value)
    return formatted
  }

  const formatPercentage = (value: number | null) => {
    if (value === null) return '-'
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
  }

  if (entries.length === 0) {
    return (
      <Card className="glass-card-heavy p-12 text-center">
        <div className="space-y-3">
          <div className="text-5xl">📊</div>
          <h3 className="text-xl font-semibold text-white">No trades yet</h3>
          <p className="text-muted-foreground">
            Start logging your trades to track your performance
          </p>
        </div>
      </Card>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-3 px-4 text-sm font-semibold text-white/60">Date</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-white/60">Symbol</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-white/60">Direction</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-white/60">Entry</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-white/60">Exit</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-white/60">P&L</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-white/60">P&L %</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-white/60">Rating</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-white/60">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-white/5 hover:bg-white/5 transition-colors"
              >
                <td className="py-3 px-4 text-sm text-white/80">
                  {formatDate(entry.trade_date)}
                </td>

                <td className="py-3 px-4">
                  <span className="font-bold text-emerald-500">
                    {entry.symbol}
                  </span>
                </td>

                <td className="py-3 px-4">
                  {entry.direction && (
                    <Badge
                      variant={entry.direction === 'long' ? 'default' : 'secondary'}
                      className={
                        entry.direction === 'long'
                          ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
                          : entry.direction === 'short'
                          ? 'bg-red-500/20 text-red-500 border-red-500/30'
                          : 'bg-gray-500/20 text-gray-500 border-gray-500/30'
                      }
                    >
                      {entry.direction === 'long' && <TrendingUp className="w-3 h-3 mr-1" />}
                      {entry.direction === 'short' && <TrendingDown className="w-3 h-3 mr-1" />}
                      {entry.direction.toUpperCase()}
                    </Badge>
                  )}
                </td>

                <td className="py-3 px-4 text-right text-sm text-white/80 font-mono">
                  {formatCurrency(entry.entry_price)}
                </td>

                <td className="py-3 px-4 text-right text-sm text-white/80 font-mono">
                  {formatCurrency(entry.exit_price)}
                </td>

                <td className="py-3 px-4 text-right font-mono">
                  <span
                    className={
                      entry.pnl && entry.pnl > 0
                        ? 'text-emerald-500'
                        : entry.pnl && entry.pnl < 0
                        ? 'text-red-500'
                        : 'text-white/60'
                    }
                  >
                    {formatCurrency(entry.pnl)}
                  </span>
                </td>

                <td className="py-3 px-4 text-right font-mono">
                  <span
                    className={
                      entry.pnl_percentage && entry.pnl_percentage > 0
                        ? 'text-emerald-500'
                        : entry.pnl_percentage && entry.pnl_percentage < 0
                        ? 'text-red-500'
                        : 'text-white/60'
                    }
                  >
                    {formatPercentage(entry.pnl_percentage)}
                  </span>
                </td>

                <td className="py-3 px-4 text-center">
                  {entry.rating && (
                    <span className="text-yellow-500 text-sm">
                      {'★'.repeat(entry.rating)}{'☆'.repeat(5 - entry.rating)}
                    </span>
                  )}
                </td>

                <td className="py-3 px-4">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(entry)}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId(entry.id)}
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="glass-card-heavy">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your trade entry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
