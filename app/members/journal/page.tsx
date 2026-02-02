'use client'

import { useEffect, useState } from 'react'
import { Plus, BookOpen } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EntryModal } from '@/components/journal/entry-modal'
import { EntriesTable } from '@/components/journal/entries-table'
import { getEntries } from '@/app/actions/journal'

export default function JournalPage() {
  const [entries, setEntries] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<any>(null)

  const loadEntries = async () => {
    setIsLoading(true)
    const result = await getEntries({ limit: 100, orderBy: 'trade_date', orderDirection: 'desc' })

    if (result.success && result.data) {
      setEntries(result.data)
    }

    setIsLoading(false)
  }

  useEffect(() => {
    loadEntries()
  }, [])

  const handleNewEntry = () => {
    setEditingEntry(null)
    setIsModalOpen(true)
  }

  const handleEdit = (entry: any) => {
    setEditingEntry(entry)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setEditingEntry(null)
  }

  const handleSuccess = () => {
    loadEntries()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/60">Loading your journal...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-emerald-500" />
            Trading Journal
          </h1>
          <p className="text-white/60 mt-2">
            Track your trades and analyze your performance with AI
          </p>
        </div>

        <Button
          onClick={handleNewEntry}
          size="lg"
          className="bg-emerald-500 hover:bg-emerald-600 gap-2"
        >
          <Plus className="w-5 h-5" />
          New Entry
        </Button>
      </div>

      {/* Entries Table */}
      <Card className="glass-card-heavy border-emerald-500/20">
        <CardHeader>
          <CardTitle>Trade History</CardTitle>
          <CardDescription>
            {entries.length} {entries.length === 1 ? 'trade' : 'trades'} logged
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EntriesTable
            entries={entries}
            onEdit={handleEdit}
            onRefresh={loadEntries}
          />
        </CardContent>
      </Card>

      {/* Entry Modal */}
      <EntryModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        entry={editingEntry}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
