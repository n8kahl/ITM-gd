'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Upload,
  Sparkles,
  Loader2,
  Star,
  Bot,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { cn } from '@/lib/utils'
import type { JournalEntry, AITradeAnalysis } from '@/lib/types/journal'

// ============================================
// QUICK TAGS (from admin-managed tags)
// ============================================

const QUICK_TAGS = [
  'Breakout', 'Reversal', 'Support', 'Resistance', 'Momentum',
  'Scalp', 'Swing', 'VWAP Play', 'PDH Break', 'Opening Range',
]

// ============================================
// TYPES
// ============================================

interface TradeEntryFormData {
  trade_date: string
  symbol: string
  direction: 'long' | 'short'
  entry_price: string
  exit_price: string
  position_size: string
  pnl: string
  pnl_percentage: string
  screenshot_url: string
  setup_notes: string
  execution_notes: string
  lessons_learned: string
  tags: string[]
  rating: number
}

const EMPTY_FORM: TradeEntryFormData = {
  trade_date: new Date().toISOString().split('T')[0],
  symbol: '',
  direction: 'long',
  entry_price: '',
  exit_price: '',
  position_size: '',
  pnl: '',
  pnl_percentage: '',
  screenshot_url: '',
  setup_notes: '',
  execution_notes: '',
  lessons_learned: '',
  tags: [],
  rating: 0,
}

// ============================================
// NOTES TAB
// ============================================

type NotesTab = 'setup' | 'execution' | 'lessons'

const NOTES_TABS: { id: NotesTab; label: string; placeholder: string }[] = [
  { id: 'setup', label: 'Setup', placeholder: 'What was your thesis? What signals did you see?' },
  { id: 'execution', label: 'Execution', placeholder: 'How did you enter and manage the trade?' },
  { id: 'lessons', label: 'Lessons', placeholder: 'What did you learn? What would you do differently?' },
]

// ============================================
// COMPONENT
// ============================================

interface TradeEntrySheetProps {
  open: boolean
  onClose: () => void
  onSave: (data: Record<string, unknown>) => Promise<void>
  editEntry?: JournalEntry | null
}

export function TradeEntrySheet({ open, onClose, onSave, editEntry }: TradeEntrySheetProps) {
  const [form, setForm] = useState<TradeEntryFormData>(EMPTY_FORM)
  const [notesTab, setNotesTab] = useState<NotesTab>('setup')
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<AITradeAnalysis | null>(null)
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set())
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)

  // Populate form when editing
  useEffect(() => {
    if (editEntry) {
      setForm({
        trade_date: editEntry.trade_date?.split('T')[0] || new Date().toISOString().split('T')[0],
        symbol: editEntry.symbol || '',
        direction: editEntry.direction === 'short' ? 'short' : 'long',
        entry_price: editEntry.entry_price?.toString() || '',
        exit_price: editEntry.exit_price?.toString() || '',
        position_size: editEntry.position_size?.toString() || '',
        pnl: editEntry.pnl?.toString() || '',
        pnl_percentage: editEntry.pnl_percentage?.toString() || '',
        screenshot_url: editEntry.screenshot_url || '',
        setup_notes: editEntry.setup_notes || '',
        execution_notes: editEntry.execution_notes || '',
        lessons_learned: editEntry.lessons_learned || '',
        tags: editEntry.tags || [],
        rating: editEntry.rating || 0,
      })
      if (editEntry.ai_analysis) setAiAnalysis(editEntry.ai_analysis)
      if (editEntry.screenshot_url) setScreenshotPreview(editEntry.screenshot_url)
    } else {
      setForm(EMPTY_FORM)
      setAiAnalysis(null)
      setScreenshotFile(null)
      setScreenshotPreview(null)
      setAutoFilledFields(new Set())
    }
  }, [editEntry, open])

  // Dropzone for screenshot
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxSize: 5 * 1024 * 1024,
    maxFiles: 1,
    onDrop: (accepted) => {
      if (accepted.length > 0) {
        const file = accepted[0]
        setScreenshotFile(file)
        setScreenshotPreview(URL.createObjectURL(file))
      }
    },
  })

  const updateField = useCallback((field: keyof TradeEntryFormData, value: string | string[] | number) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

  // AI Analysis
  const handleAnalyze = useCallback(async () => {
    const imageUrl = screenshotPreview || form.screenshot_url
    if (!imageUrl) return
    setAnalyzing(true)
    try {
      const res = await fetch('/api/members/journal/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      })
      const data = await res.json()
      if (data.symbol || data.entry_price || data.pnl) {
        const filled = new Set<string>()
        if (data.symbol && !form.symbol) { updateField('symbol', data.symbol); filled.add('symbol') }
        if (data.direction) { updateField('direction', data.direction); filled.add('direction') }
        if (data.entry_price != null) { updateField('entry_price', String(data.entry_price)); filled.add('entry_price') }
        if (data.exit_price != null) { updateField('exit_price', String(data.exit_price)); filled.add('exit_price') }
        if (data.pnl != null) { updateField('pnl', String(data.pnl)); filled.add('pnl') }
        if (data.pnl_percentage != null) { updateField('pnl_percentage', String(data.pnl_percentage)); filled.add('pnl_percentage') }
        setAutoFilledFields(filled)

        if (data.analysis_summary) {
          setAiAnalysis({
            summary: data.analysis_summary,
            grade: data.grade || 'B',
          })
        }
      }
    } catch {
      // Silent fail
    } finally {
      setAnalyzing(false)
    }
  }, [screenshotPreview, form.screenshot_url, form.symbol, updateField])

  // Save
  const handleSave = useCallback(async () => {
    if (!form.symbol.trim()) return
    setSaving(true)
    try {
      const pnlNum = parseFloat(form.pnl) || 0
      const payload: Record<string, unknown> = {
        trade_date: form.trade_date,
        symbol: form.symbol.toUpperCase(),
        trade_type: form.direction,
        entry_price: parseFloat(form.entry_price) || null,
        exit_price: parseFloat(form.exit_price) || null,
        position_size: parseFloat(form.position_size) || null,
        profit_loss: pnlNum,
        profit_loss_percent: parseFloat(form.pnl_percentage) || null,
        screenshot_url: form.screenshot_url || null,
        setup_notes: form.setup_notes || null,
        execution_notes: form.execution_notes || null,
        lessons_learned: form.lessons_learned || null,
        tags: form.tags,
        rating: form.rating || null,
        is_winner: pnlNum > 0 ? true : pnlNum < 0 ? false : null,
      }
      if (editEntry) {
        payload.id = editEntry.id
      }
      if (aiAnalysis) {
        payload.ai_analysis = aiAnalysis
      }
      await onSave(payload)
      onClose()
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false)
    }
  }, [form, editEntry, aiAnalysis, onSave, onClose])

  // Toggle tag
  const toggleTag = useCallback((tag: string) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag],
    }))
  }, [])

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 35 }}
            className="relative w-full max-w-[600px] h-full bg-[#0A0A0B] border-l border-white/[0.08] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h2 className="text-base font-medium text-ivory">
                {editEntry ? 'Edit Trade' : 'Log Trade'}
              </h2>
              <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-ivory hover:bg-white/5 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Trade Details */}
              <section className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Date</label>
                    <input
                      type="date"
                      value={form.trade_date}
                      onChange={(e) => updateField('trade_date', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-ivory focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Symbol</label>
                    <input
                      type="text"
                      value={form.symbol}
                      onChange={(e) => updateField('symbol', e.target.value.toUpperCase())}
                      placeholder="SPY"
                      className={cn(
                        'w-full px-3 py-2 rounded-lg bg-white/[0.05] border text-sm text-ivory focus:outline-none focus:ring-1 focus:ring-emerald-500/30',
                        autoFilledFields.has('symbol') ? 'border-champagne/30 bg-champagne/5' : 'border-white/[0.08]'
                      )}
                    />
                  </div>
                </div>

                {/* Direction Toggle */}
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Direction</label>
                  <div className="flex gap-2">
                    {(['long', 'short'] as const).map(dir => (
                      <button
                        key={dir}
                        onClick={() => updateField('direction', dir)}
                        className={cn(
                          'flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize',
                          form.direction === dir
                            ? dir === 'long' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                            : 'bg-white/[0.04] text-muted-foreground hover:text-ivory border border-white/[0.08]'
                        )}
                      >
                        {dir}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* Screenshot Upload */}
              <section>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Screenshot</label>
                {screenshotPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-white/[0.08]">
                    <img src={screenshotPreview} alt="Trade screenshot" className="w-full max-h-[200px] object-contain bg-black/40" />
                    <button
                      onClick={() => { setScreenshotFile(null); setScreenshotPreview(null) }}
                      className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    {...getRootProps()}
                    className={cn(
                      'rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors',
                      isDragActive ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/[0.08] hover:border-white/[0.15] bg-white/[0.02]'
                    )}
                  >
                    <input {...getInputProps()} />
                    <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Drop screenshot or click to upload</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1">PNG, JPG, WebP (max 5MB)</p>
                  </div>
                )}

                {/* URL input fallback */}
                {!screenshotPreview && (
                  <input
                    type="url"
                    value={form.screenshot_url}
                    onChange={(e) => updateField('screenshot_url', e.target.value)}
                    placeholder="Or paste image URL..."
                    className="w-full mt-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-ivory placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                  />
                )}

                {/* AI Analyze Button */}
                {(screenshotPreview || form.screenshot_url) && (
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                  >
                    {analyzing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing your trade...</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> Analyze with AI</>
                    )}
                  </button>
                )}
              </section>

              {/* Price & P&L */}
              <section className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Entry Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.entry_price}
                      onChange={(e) => updateField('entry_price', e.target.value)}
                      placeholder="0.00"
                      className={cn(
                        'w-full px-3 py-2 rounded-lg bg-white/[0.05] border text-sm text-ivory font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500/30',
                        autoFilledFields.has('entry_price') ? 'border-champagne/30 bg-champagne/5' : 'border-white/[0.08]'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Exit Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.exit_price}
                      onChange={(e) => updateField('exit_price', e.target.value)}
                      placeholder="0.00"
                      className={cn(
                        'w-full px-3 py-2 rounded-lg bg-white/[0.05] border text-sm text-ivory font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500/30',
                        autoFilledFields.has('exit_price') ? 'border-champagne/30 bg-champagne/5' : 'border-white/[0.08]'
                      )}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">Size</label>
                    <input
                      type="number"
                      value={form.position_size}
                      onChange={(e) => updateField('position_size', e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-ivory font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">P&L ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.pnl}
                      onChange={(e) => updateField('pnl', e.target.value)}
                      placeholder="0.00"
                      className={cn(
                        'w-full px-3 py-2 rounded-lg bg-white/[0.05] border text-sm text-ivory font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500/30',
                        autoFilledFields.has('pnl') ? 'border-champagne/30 bg-champagne/5' : 'border-white/[0.08]'
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">P&L (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.pnl_percentage}
                      onChange={(e) => updateField('pnl_percentage', e.target.value)}
                      placeholder="0.00"
                      className={cn(
                        'w-full px-3 py-2 rounded-lg bg-white/[0.05] border text-sm text-ivory font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500/30',
                        autoFilledFields.has('pnl_percentage') ? 'border-champagne/30 bg-champagne/5' : 'border-white/[0.08]'
                      )}
                    />
                  </div>
                </div>
              </section>

              {/* Notes (tabbed) */}
              <section>
                <div className="flex items-center gap-1 bg-white/[0.02] rounded-lg p-0.5 mb-3">
                  {NOTES_TABS.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setNotesTab(tab.id)}
                      className={cn(
                        'flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                        notesTab === tab.id ? 'bg-white/[0.06] text-ivory' : 'text-muted-foreground hover:text-ivory'
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={
                    notesTab === 'setup' ? form.setup_notes
                    : notesTab === 'execution' ? form.execution_notes
                    : form.lessons_learned
                  }
                  onChange={(e) => {
                    const field = notesTab === 'setup' ? 'setup_notes' : notesTab === 'execution' ? 'execution_notes' : 'lessons_learned'
                    updateField(field, e.target.value)
                  }}
                  placeholder={NOTES_TABS.find(t => t.id === notesTab)?.placeholder}
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-ivory placeholder:text-muted-foreground/40 resize-y focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                />
              </section>

              {/* Tags */}
              <section>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_TAGS.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border',
                        form.tags.includes(tag)
                          ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/30'
                          : 'bg-white/[0.03] text-muted-foreground border-white/[0.06] hover:text-ivory'
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </section>

              {/* Rating */}
              <section>
                <label className="block text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Rating</label>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => updateField('rating', i + 1)}
                      className="p-0.5 transition-transform hover:scale-110"
                    >
                      <Star className={cn(
                        'w-6 h-6 transition-colors',
                        i < form.rating ? 'fill-emerald-400 text-emerald-400' : 'text-white/10 hover:text-white/20'
                      )} />
                    </button>
                  ))}
                  {form.rating > 0 && (
                    <button onClick={() => updateField('rating', 0)} className="ml-2 text-[10px] text-muted-foreground hover:text-ivory">
                      Clear
                    </button>
                  )}
                </div>
              </section>

              {/* AI Analysis Result */}
              {aiAnalysis && (
                <section className="glass-card rounded-xl p-4 border-champagne/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Bot className="w-4 h-4 text-champagne" />
                    <h4 className="text-sm font-medium text-ivory">AI Analysis</h4>
                    {aiAnalysis.grade && (
                      <span className={cn(
                        'ml-auto inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold',
                        aiAnalysis.grade.startsWith('A') ? 'bg-emerald-900/30 text-emerald-400' :
                        aiAnalysis.grade.startsWith('B') ? 'bg-champagne/10 text-champagne' :
                        'bg-amber-900/30 text-amber-400'
                      )}>
                        {aiAnalysis.grade}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ivory/80 leading-relaxed">{aiAnalysis.summary}</p>
                  {aiAnalysis.entry_analysis && (
                    <div className="mt-3 space-y-2">
                      {aiAnalysis.entry_analysis.observations.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Strengths</p>
                          {aiAnalysis.entry_analysis.observations.map((obs, i) => (
                            <p key={i} className="text-[11px] text-ivory/70 flex items-start gap-1.5">
                              <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                              {obs}
                            </p>
                          ))}
                        </div>
                      )}
                      {aiAnalysis.entry_analysis.improvements.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Improvements</p>
                          {aiAnalysis.entry_analysis.improvements.map((imp, i) => (
                            <p key={i} className="text-[11px] text-ivory/70 flex items-start gap-1.5">
                              <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                              {imp}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {aiAnalysis.coaching_notes && (
                    <p className="mt-2 text-[11px] text-muted-foreground italic">{aiAnalysis.coaching_notes}</p>
                  )}
                </section>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/[0.06] flex items-center gap-3">
              {editEntry && (
                <button
                  className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-ivory border border-white/[0.08] hover:bg-white/[0.04] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.symbol.trim()}
                  className="px-5 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editEntry ? 'Save Changes' : 'Save Trade'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
