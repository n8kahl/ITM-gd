'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sparkles, Loader2, Save, X } from 'lucide-react'
import { createEntry, updateEntry, type JournalEntryInput } from '@/app/actions/journal'
import { toast } from 'sonner'

interface EntryModalProps {
  isOpen: boolean
  onClose: () => void
  entry?: any // Existing entry for editing (optional)
  onSuccess?: () => void
}

export function EntryModal({ isOpen, onClose, entry, onSuccess }: EntryModalProps) {
  const isEditing = !!entry

  // Form state
  const [formData, setFormData] = useState<JournalEntryInput>({
    trade_date: entry?.trade_date?.split('T')[0] || new Date().toISOString().split('T')[0],
    symbol: entry?.symbol || '',
    direction: entry?.direction || null,
    entry_price: entry?.entry_price || null,
    exit_price: entry?.exit_price || null,
    position_size: entry?.position_size || null,
    pnl: entry?.pnl || null,
    pnl_percentage: entry?.pnl_percentage || null,
    screenshot_url: entry?.screenshot_url || '',
    setup_notes: entry?.setup_notes || '',
    execution_notes: entry?.execution_notes || '',
    lessons_learned: entry?.lessons_learned || '',
    tags: entry?.tags || [],
    rating: entry?.rating || null,
    is_winner: entry?.is_winner ?? null,
  })

  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleChange = (field: keyof JournalEntryInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleAnalyze = async () => {
    if (!formData.screenshot_url) {
      toast.error('Please enter a screenshot URL first')
      return
    }

    setIsAnalyzing(true)

    try {
      const response = await fetch('/api/members/journal/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: formData.screenshot_url }),
      })

      const data = await response.json()

      if (data.error) {
        toast.error(data.error)
        return
      }

      // Auto-fill form with AI analysis results
      setFormData(prev => ({
        ...prev,
        symbol: data.symbol || prev.symbol,
        direction: data.direction || prev.direction,
        entry_price: data.entry_price ?? prev.entry_price,
        exit_price: data.exit_price ?? prev.exit_price,
        pnl: data.pnl ?? prev.pnl,
        pnl_percentage: data.pnl_percentage ?? prev.pnl_percentage,
        ai_analysis: data,
      }))

      // Auto-determine if winner based on P&L
      if (data.pnl !== null) {
        handleChange('is_winner', data.pnl > 0)
      }

      toast.success('Trade analyzed successfully!')
    } catch (error) {
      console.error('Analysis error:', error)
      toast.error('Failed to analyze trade')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSave = async () => {
    // Validation
    if (!formData.symbol) {
      toast.error('Symbol is required')
      return
    }

    setIsSaving(true)

    try {
      const result = isEditing
        ? await updateEntry(entry.id, formData)
        : await createEntry(formData)

      if (result.success) {
        toast.success(isEditing ? 'Entry updated!' : 'Entry created!')
        onSuccess?.()
        onClose()
      } else {
        toast.error(result.error || 'Failed to save entry')
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save entry')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass-card-heavy">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-emerald-500">
            {isEditing ? 'Edit Trade' : 'New Trade Entry'}
          </DialogTitle>
          <DialogDescription>
            Log your trade details and get AI-powered analysis
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Screenshot URL + AI Analysis */}
          <div className="space-y-2">
            <Label htmlFor="screenshot">Screenshot URL</Label>
            <div className="flex gap-2">
              <Input
                id="screenshot"
                placeholder="https://example.com/trade-screenshot.png"
                value={formData.screenshot_url || ''}
                onChange={(e) => handleChange('screenshot_url', e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !formData.screenshot_url}
                variant="outline"
                className="gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Analyze with AI
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste your trade screenshot URL and click Analyze to auto-fill trade data
            </p>
          </div>

          {/* Trade Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Trade Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.trade_date || ''}
                onChange={(e) => handleChange('trade_date', e.target.value)}
              />
            </div>

            {/* Symbol */}
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol *</Label>
              <Input
                id="symbol"
                placeholder="SPY, AAPL, TSLA..."
                value={formData.symbol || ''}
                onChange={(e) => handleChange('symbol', e.target.value.toUpperCase())}
              />
            </div>
          </div>

          {/* Direction & Rating */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="direction">Direction</Label>
              <Select
                value={formData.direction || ''}
                onValueChange={(value) => handleChange('direction', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rating">Rating (1-5)</Label>
              <Input
                id="rating"
                type="number"
                min="1"
                max="5"
                placeholder="Rate your execution"
                value={formData.rating || ''}
                onChange={(e) => handleChange('rating', e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entry">Entry Price</Label>
              <Input
                id="entry"
                type="number"
                step="0.01"
                placeholder="450.50"
                value={formData.entry_price || ''}
                onChange={(e) => handleChange('entry_price', e.target.value ? parseFloat(e.target.value) : null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="exit">Exit Price</Label>
              <Input
                id="exit"
                type="number"
                step="0.01"
                placeholder="455.25"
                value={formData.exit_price || ''}
                onChange={(e) => handleChange('exit_price', e.target.value ? parseFloat(e.target.value) : null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="size">Position Size</Label>
              <Input
                id="size"
                type="number"
                step="0.01"
                placeholder="10"
                value={formData.position_size || ''}
                onChange={(e) => handleChange('position_size', e.target.value ? parseFloat(e.target.value) : null)}
              />
            </div>
          </div>

          {/* P&L */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pnl">P&L ($)</Label>
              <Input
                id="pnl"
                type="number"
                step="0.01"
                placeholder="475.00"
                value={formData.pnl || ''}
                onChange={(e) => {
                  const pnl = e.target.value ? parseFloat(e.target.value) : null
                  handleChange('pnl', pnl)
                  // Auto-set is_winner
                  if (pnl !== null) {
                    handleChange('is_winner', pnl > 0)
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pnl_pct">P&L (%)</Label>
              <Input
                id="pnl_pct"
                type="number"
                step="0.01"
                placeholder="4.75"
                value={formData.pnl_percentage || ''}
                onChange={(e) => handleChange('pnl_percentage', e.target.value ? parseFloat(e.target.value) : null)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="setup">Setup Notes</Label>
            <Textarea
              id="setup"
              placeholder="Why did you take this trade? What was the setup?"
              value={formData.setup_notes || ''}
              onChange={(e) => handleChange('setup_notes', e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="execution">Execution Notes</Label>
            <Textarea
              id="execution"
              placeholder="How did you execute the trade? Entry/exit timing?"
              value={formData.execution_notes || ''}
              onChange={(e) => handleChange('execution_notes', e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lessons">Lessons Learned</Label>
            <Textarea
              id="lessons"
              placeholder="What did you learn from this trade?"
              value={formData.lessons_learned || ''}
              onChange={(e) => handleChange('lessons_learned', e.target.value)}
              rows={2}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              placeholder="breakout, momentum, day-trade"
              value={formData.tags?.join(', ') || ''}
              onChange={(e) => handleChange('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !formData.symbol}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isEditing ? 'Update' : 'Save'} Entry
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
