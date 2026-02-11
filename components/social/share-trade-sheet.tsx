'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { FeedVisibility } from '@/lib/types/social'
import { Share2, Loader2, Check, Globe, Users, Lock } from 'lucide-react'

interface ShareTradeSheetProps {
  journalEntryId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onShared?: () => void
}

interface ShareTemplate {
  id: string
  name: string
  description: string
}

const TEMPLATES: ShareTemplate[] = [
  { id: 'clean', name: 'Clean Card', description: 'Simple P&L and symbol only' },
  { id: 'detailed', name: 'Detailed', description: 'Full trade breakdown with entry/exit' },
  { id: 'minimal', name: 'Minimal', description: 'Just the result, no details' },
  { id: 'chart', name: 'With Chart', description: 'Include a mini chart snapshot' },
  { id: 'analysis', name: 'AI Analysis', description: 'Include AI grade and insights' },
]

const VISIBILITY_OPTIONS: Array<{
  value: FeedVisibility
  label: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}> = [
  {
    value: 'public',
    label: 'Public',
    icon: Globe,
    description: 'Visible to everyone',
  },
  {
    value: 'members',
    label: 'Members',
    icon: Users,
    description: 'Visible to ITM members only',
  },
  {
    value: 'private',
    label: 'Private',
    icon: Lock,
    description: 'Only visible to you',
  },
]

export function ShareTradeSheet({
  journalEntryId,
  open,
  onOpenChange,
  onShared,
}: ShareTradeSheetProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('clean')
  const [visibility, setVisibility] = useState<FeedVisibility>('public')
  const [sharing, setSharing] = useState(false)
  const [shared, setShared] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleShare = async () => {
    setSharing(true)
    setError(null)

    try {
      const response = await fetch('/api/social/share-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journal_entry_id: journalEntryId,
          template: selectedTemplate,
          visibility,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to share trade')
      }

      setShared(true)
      onShared?.()

      // Auto-close after success
      setTimeout(() => {
        onOpenChange(false)
        // Reset state after dialog fully closes
        setTimeout(() => {
          setShared(false)
          setSelectedTemplate('clean')
          setVisibility('public')
        }, 300)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSharing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card-heavy border-white/[0.08] bg-[#0a0a0b]/95 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Share2 className="h-5 w-5 text-emerald-400" />
            Share Trade
          </DialogTitle>
          <DialogDescription className="text-white/50">
            Choose how you want to share this trade with the community.
          </DialogDescription>
        </DialogHeader>

        {shared ? (
          /* Success State */
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
              <Check className="h-7 w-7 text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-white">Trade shared successfully!</p>
          </div>
        ) : (
          /* Form */
          <div className="space-y-5">
            {/* Template Selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-white/50">
                Template
              </label>
              <div className="grid gap-2">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedTemplate(template.id)}
                    className={cn(
                      'flex items-center justify-between rounded-lg border p-3 text-left transition-all',
                      selectedTemplate === template.id
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
                    )}
                  >
                    <div>
                      <span className="text-sm font-medium text-white">
                        {template.name}
                      </span>
                      <p className="text-xs text-white/40">{template.description}</p>
                    </div>
                    {selectedTemplate === template.id && (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                        Selected
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Visibility Selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-white/50">
                Visibility
              </label>
              <Select
                value={visibility}
                onValueChange={(val) => setVisibility(val as FeedVisibility)}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map((option) => {
                    const Icon = option.icon
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-white/50" />
                          <span>{option.label}</span>
                          <span className="text-white/30">- {option.description}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </div>
        )}

        {!shared && (
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={sharing}
              className="text-white/50"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleShare}
              disabled={sharing}
              className="bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {sharing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sharing...
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" />
                  Share Trade
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
