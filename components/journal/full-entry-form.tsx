'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { Upload, Sparkles, Loader2, Star, CheckCircle, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DropzoneInputProps, DropzoneRootProps } from 'react-dropzone'
import type { UploadProgress } from '@/lib/uploads/supabaseStorage'
import type { AIFieldKey, AIFieldStatus, TradeEntryFormData } from './trade-entry-types'

interface FullEntryFormProps {
  form: TradeEntryFormData
  onFieldChange: (field: keyof TradeEntryFormData, value: string | string[] | number) => void
  aiFieldStatus: Partial<Record<AIFieldKey, AIFieldStatus>>
  onAcceptAiField: (field: AIFieldKey) => void
  onRejectAiField: (field: AIFieldKey) => void
  quickTags: string[]
  onToggleTag: (tag: string) => void
  screenshotPreview: string | null
  uploadStatus: UploadProgress | null
  getRootProps: <T extends DropzoneRootProps>(props?: T) => T
  getInputProps: <T extends DropzoneInputProps>(props?: T) => T
  isDragActive: boolean
  onRemoveScreenshot: () => void
  onAnalyze: () => void
  analyzing: boolean
  analyzeError: string | null
}

const NOTE_PLACEHOLDERS = [
  'What was your setup thesis?',
  'How did you manage the trade?',
  'What did you learn?',
]

function FieldStatusActions({
  field,
  status,
  onAccept,
  onReject,
}: {
  field: AIFieldKey
  status?: AIFieldStatus
  onAccept: (field: AIFieldKey) => void
  onReject: (field: AIFieldKey) => void
}) {
  if (status !== 'pending') return null

  return (
    <div className="inline-flex items-center gap-1 ml-1.5">
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-champagne/10 text-champagne border border-champagne/20">
        <Sparkles className="w-2.5 h-2.5" />
        AI
      </span>
      <button
        type="button"
        onClick={() => onAccept(field)}
        className="focus-champagne px-1.5 py-0.5 rounded-md text-[9px] text-emerald-300 hover:text-emerald-200 bg-emerald-900/20 border border-emerald-800/40"
        aria-label={`Accept AI suggestion for ${field.replace('_', ' ')}`}
      >
        Accept
      </button>
      <button
        type="button"
        onClick={() => onReject(field)}
        className="focus-champagne px-1.5 py-0.5 rounded-md text-[9px] text-red-300 hover:text-red-200 bg-red-900/20 border border-red-800/40"
        aria-label={`Reject AI suggestion for ${field.replace('_', ' ')}`}
      >
        Reject
      </button>
    </div>
  )
}

export function FullEntryForm({
  form,
  onFieldChange,
  aiFieldStatus,
  onAcceptAiField,
  onRejectAiField,
  quickTags,
  onToggleTag,
  screenshotPreview,
  uploadStatus,
  getRootProps,
  getInputProps,
  isDragActive,
  onRemoveScreenshot,
  onAnalyze,
  analyzing,
  analyzeError,
}: FullEntryFormProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % NOTE_PLACEHOLDERS.length)
    }, 2600)
    return () => window.clearInterval(interval)
  }, [])

  const notesPlaceholder = useMemo(() => {
    return `${NOTE_PLACEHOLDERS[placeholderIndex]} Use Shift+Enter for new sections.`
  }, [placeholderIndex])

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
            Position Size
          </label>
          <input
            type="number"
            value={form.position_size}
            onChange={(e) => onFieldChange('position_size', e.target.value)}
            placeholder="0"
            className="w-full h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm font-mono text-ivory focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
            P&L Override ($)
            <FieldStatusActions
              field="pnl"
              status={aiFieldStatus.pnl}
              onAccept={onAcceptAiField}
              onReject={onRejectAiField}
            />
          </label>
          <input
            type="number"
            step="0.01"
            value={form.pnl}
            onChange={(e) => onFieldChange('pnl', e.target.value)}
            placeholder="0.00"
            className={cn(
              'w-full h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm font-mono text-ivory focus:outline-none focus:ring-1 focus:ring-emerald-500/30',
              aiFieldStatus.pnl === 'pending' && 'border-champagne/30 bg-champagne/5',
            )}
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
            P&L Override (%)
            <FieldStatusActions
              field="pnl_percentage"
              status={aiFieldStatus.pnl_percentage}
              onAccept={onAcceptAiField}
              onReject={onRejectAiField}
            />
          </label>
          <input
            type="number"
            step="0.01"
            value={form.pnl_percentage}
            onChange={(e) => onFieldChange('pnl_percentage', e.target.value)}
            placeholder="0.00"
            className={cn(
              'w-full h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm font-mono text-ivory focus:outline-none focus:ring-1 focus:ring-emerald-500/30',
              aiFieldStatus.pnl_percentage === 'pending' && 'border-champagne/30 bg-champagne/5',
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
            Stop Loss
          </label>
          <input
            type="number"
            step="0.01"
            value={form.stop_loss}
            onChange={(e) => onFieldChange('stop_loss', e.target.value)}
            placeholder="0.00"
            className="w-full h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm font-mono text-ivory focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
            Initial Target
          </label>
          <input
            type="number"
            step="0.01"
            value={form.initial_target}
            onChange={(e) => onFieldChange('initial_target', e.target.value)}
            placeholder="0.00"
            className="w-full h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm font-mono text-ivory focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
            Strategy / Playbook
          </label>
          <input
            type="text"
            value={form.strategy}
            onChange={(e) => onFieldChange('strategy', e.target.value)}
            placeholder="ORB, Break & Retest..."
            className="w-full h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-ivory focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </div>
      </div>

      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Options Details</p>
          <p className="text-[11px] text-muted-foreground mt-1">Optional for stock trades. DTE auto-updates when expiration is set.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Contract</label>
            <select
              value={form.contract_type}
              onChange={(e) => onFieldChange('contract_type', e.target.value as TradeEntryFormData['contract_type'])}
              className="w-full h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-ivory focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            >
              <option value="stock">Stock</option>
              <option value="call">Call</option>
              <option value="put">Put</option>
              <option value="spread">Spread</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Strike</label>
            <input
              type="number"
              step="0.01"
              value={form.strike_price}
              onChange={(e) => onFieldChange('strike_price', e.target.value)}
              placeholder="0.00"
              className="w-full h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm font-mono text-ivory focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Expiration</label>
            <input
              type="date"
              value={form.expiration_date}
              onChange={(e) => onFieldChange('expiration_date', e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-ivory focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">DTE @ Entry</label>
            <input
              type="number"
              value={form.dte_at_entry}
              onChange={(e) => onFieldChange('dte_at_entry', e.target.value)}
              placeholder="Auto"
              className="w-full h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm font-mono text-ivory focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Psychology & Discipline</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Mood Before</label>
            <select
              value={form.mood_before}
              onChange={(e) => onFieldChange('mood_before', e.target.value as TradeEntryFormData['mood_before'])}
              className="w-full h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-ivory focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            >
              <option value="">Not set</option>
              <option value="confident">Confident</option>
              <option value="neutral">Neutral</option>
              <option value="anxious">Anxious</option>
              <option value="frustrated">Frustrated</option>
              <option value="excited">Excited</option>
              <option value="fearful">Fearful</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Mood After</label>
            <select
              value={form.mood_after}
              onChange={(e) => onFieldChange('mood_after', e.target.value as TradeEntryFormData['mood_after'])}
              className="w-full h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-ivory focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            >
              <option value="">Not set</option>
              <option value="confident">Confident</option>
              <option value="neutral">Neutral</option>
              <option value="anxious">Anxious</option>
              <option value="frustrated">Frustrated</option>
              <option value="excited">Excited</option>
              <option value="fearful">Fearful</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Discipline Score (1-5)</label>
            <input
              type="number"
              min={1}
              max={5}
              value={form.discipline_score}
              onChange={(e) => onFieldChange('discipline_score', e.target.value)}
              placeholder="3"
              className="w-full h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm font-mono text-ivory focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Followed Plan?</label>
            <select
              value={form.followed_plan}
              onChange={(e) => onFieldChange('followed_plan', e.target.value as TradeEntryFormData['followed_plan'])}
              className="w-full h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-ivory focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            >
              <option value="">Not set</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>
        <textarea
          value={form.deviation_notes}
          onChange={(e) => onFieldChange('deviation_notes', e.target.value)}
          rows={3}
          placeholder="If you deviated from plan, what happened and what would you change?"
          className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-ivory placeholder:text-muted-foreground/40 resize-y focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
        />
      </section>

      <section>
        <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
          Screenshot
        </label>
        {screenshotPreview ? (
          <div className="relative rounded-xl overflow-hidden border border-white/[0.08] bg-black/40 min-h-[220px]">
            <Image
              src={screenshotPreview}
              alt="Trade screenshot"
              fill
              unoptimized
              className="object-contain"
            />
            <button
              type="button"
              onClick={onRemoveScreenshot}
              className="focus-champagne absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label="Remove screenshot"
            >
              <X className="w-4 h-4" />
            </button>

            {uploadStatus && uploadStatus.status !== 'complete' && uploadStatus.status !== 'error' && (
              <div className="absolute inset-x-0 bottom-0 bg-black/70 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span className="text-[11px] text-ivory/80">
                    {uploadStatus.status === 'validating' ? 'Validating...' : 'Uploading...'}
                  </span>
                </div>
                {uploadStatus.status === 'uploading' && (
                  <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${uploadStatus.percent ?? 0}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {uploadStatus?.status === 'complete' && (
              <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-900/80 text-emerald-300">
                <CheckCircle className="w-3 h-3" />
                <span className="text-[10px] font-medium">Uploaded</span>
              </div>
            )}
          </div>
        ) : (
          <div
            {...getRootProps()}
            className={cn(
              'rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors',
              isDragActive ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/[0.08] hover:border-white/[0.15] bg-white/[0.02]',
            )}
          >
            <input {...getInputProps()} />
            <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Drop screenshot or click to upload</p>
            <p className="text-[10px] text-muted-foreground/50 mt-1">PNG, JPG, WebP (max 5MB)</p>
          </div>
        )}

        {uploadStatus?.status === 'error' && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/30 border border-red-900/30">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            <span className="text-[11px] text-red-300">{uploadStatus.error}</span>
          </div>
        )}

        {(screenshotPreview || form.screenshot_url) && (
          <button
            type="button"
            onClick={onAnalyze}
            disabled={analyzing || (uploadStatus != null && uploadStatus.status !== 'complete' && uploadStatus.status !== 'error')}
            className="focus-champagne mt-2 w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            aria-live="polite"
          >
            {analyzing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing your trade...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> Analyze with AI</>
            )}
          </button>
        )}

        {analyzeError && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-950/30 border border-red-900/30">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            <span className="text-[11px] text-red-300">{analyzeError}</span>
          </div>
        )}
      </section>

      <section>
        <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
          Notes
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => onFieldChange('notes', e.target.value)}
          placeholder={notesPlaceholder}
          rows={5}
          className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-ivory placeholder:text-muted-foreground/40 resize-y focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
        />
      </section>

      <section>
        <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
          Quick Tags
        </label>
        <div className="flex flex-wrap gap-1.5">
          {quickTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onToggleTag(tag)}
              className={cn(
                'px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border',
                form.tags.includes(tag)
                  ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/30'
                  : 'bg-white/[0.03] text-muted-foreground border-white/[0.06] hover:text-ivory',
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </section>

      <section>
        <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
          Rating
        </label>
        <div className="flex gap-1">
          {Array.from({ length: 5 }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onFieldChange('rating', i + 1)}
              className="p-0.5 transition-transform hover:scale-110"
            >
              <Star
                className={cn(
                  'w-6 h-6 transition-colors',
                  i < form.rating ? 'fill-emerald-400 text-emerald-400' : 'text-white/10 hover:text-white/20',
                )}
              />
            </button>
          ))}
          {form.rating > 0 && (
            <button
              type="button"
              onClick={() => onFieldChange('rating', 0)}
              className="ml-2 text-[10px] text-muted-foreground hover:text-ivory"
            >
              Clear
            </button>
          )}
        </div>
      </section>
    </section>
  )
}
