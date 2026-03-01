'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Loader2, Upload, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CoachFeedbackContent } from '@/components/journal/coach-feedback-content'
import type {
  CoachMemberStats,
  CoachResponsePayload,
  CoachReviewActivityEntry,
  CoachTradeNote,
} from '@/lib/types/coach-review'

interface MemberNotesReference {
  strategy: string | null
  setupType: string | null
  setupNotes: string | null
  executionNotes: string | null
  lessonsLearned: string | null
  deviationNotes: string | null
}

interface CoachWorkspaceProps {
  entryId: string
  note: CoachTradeNote | null
  activityLog: CoachReviewActivityEntry[]
  memberName?: string
  memberSymbol?: string
  memberStats?: CoachMemberStats | null
  memberNotes?: MemberNotesReference | null
  generating?: boolean
  saving?: boolean
  publishing?: boolean
  dismissing?: boolean
  uploading?: boolean
  onGenerateAI?: (coachPreliminaryNotes: string) => Promise<void> | void
  onSaveDraft?: (payload: { coach_response: CoachResponsePayload; internal_notes: string | null }) => Promise<void> | void
  onPublish?: () => Promise<void> | void
  onDismiss?: () => Promise<void> | void
  onUploadScreenshot?: (file: File) => Promise<void> | void
  onRemoveScreenshot?: (path: string) => Promise<void> | void
}

function createEmptyDraft(): CoachResponsePayload {
  return {
    what_went_well: [''],
    areas_to_improve: [{ point: '', instruction: '' }],
    specific_drills: [{ title: '', description: '' }],
    overall_assessment: '',
    grade: 'C',
    grade_reasoning: '',
    confidence: 'medium',
  }
}

function normalizeDraft(note: CoachTradeNote | null): CoachResponsePayload {
  if (note?.coach_response) return note.coach_response
  if (note?.ai_draft) return note.ai_draft
  return createEmptyDraft()
}

function trimDraft(draft: CoachResponsePayload): CoachResponsePayload {
  return {
    what_went_well: draft.what_went_well.map((item) => item.trim()).filter((item) => item.length > 0),
    areas_to_improve: draft.areas_to_improve
      .map((item) => ({ point: item.point.trim(), instruction: item.instruction.trim() }))
      .filter((item) => item.point.length > 0 && item.instruction.length > 0),
    specific_drills: draft.specific_drills
      .map((item) => ({ title: item.title.trim(), description: item.description.trim() }))
      .filter((item) => item.title.length > 0 && item.description.length > 0),
    overall_assessment: draft.overall_assessment.trim(),
    grade: draft.grade,
    grade_reasoning: draft.grade_reasoning.trim(),
    confidence: draft.confidence,
  }
}

function hasMinimumDraftContent(draft: CoachResponsePayload): boolean {
  const trimmed = trimDraft(draft)
  return (
    trimmed.what_went_well.length > 0
    && trimmed.areas_to_improve.length > 0
    && trimmed.specific_drills.length > 0
    && trimmed.overall_assessment.length > 0
    && trimmed.grade_reasoning.length > 0
  )
}

function formatActivityTimestamp(value: unknown): string {
  if (typeof value !== 'string') return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatRelativeTimestamp(value: unknown): string {
  if (typeof value !== 'string') return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  const deltaMs = Date.now() - parsed.getTime()
  if (deltaMs < 60_000) return 'just now'
  const totalMinutes = Math.floor(deltaMs / 60_000)
  if (totalMinutes < 60) return `${totalMinutes}m ago`
  const totalHours = Math.floor(totalMinutes / 60)
  if (totalHours < 24) return `${totalHours}h ago`
  const totalDays = Math.floor(totalHours / 24)
  return `${totalDays}d ago`
}

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function formatSaveTimestamp(value: Date | null): string {
  if (!value) return ''
  const ageMs = Date.now() - value.getTime()
  if (ageMs < 60_000) return 'just now'
  return value.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatStatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${value.toFixed(1)}%`
}

function formatStatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  const sign = value >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function formatStreak(value: CoachMemberStats['recent_streak'] | null | undefined): string {
  if (!value) return '—'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function winRateTone(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'text-ivory'
  if (value > 55) return 'text-emerald-300'
  if (value >= 45) return 'text-amber-300'
  return 'text-red-300'
}

function hasPreviewableDraftContent(draft: CoachResponsePayload): boolean {
  const trimmed = trimDraft(draft)
  return (
    trimmed.what_went_well.length > 0
    || trimmed.areas_to_improve.length > 0
    || trimmed.specific_drills.length > 0
    || trimmed.overall_assessment.length > 0
    || trimmed.grade_reasoning.length > 0
  )
}

function activityLabel(action: unknown): string {
  if (typeof action !== 'string') return 'Unknown action'
  switch (action) {
    case 'requested':
      return 'Review requested'
    case 'claimed':
      return 'Review claimed'
    case 'ai_generated':
      return 'AI analysis generated'
    case 'draft_saved':
      return 'Draft saved'
    case 'edited':
      return 'Draft edited'
    case 'published':
      return 'Published to member'
    case 'dismissed':
      return 'Review dismissed'
    case 'screenshot_added':
      return 'Screenshot added'
    case 'screenshot_removed':
      return 'Screenshot removed'
    default:
      return action.replaceAll('_', ' ')
  }
}

function activityBadgeClass(action: unknown): string {
  switch (action) {
    case 'requested':
      return 'border-amber-400/30 bg-amber-500/10 text-amber-200'
    case 'claimed':
    case 'ai_generated':
    case 'draft_saved':
    case 'edited':
      return 'border-sky-400/30 bg-sky-500/10 text-sky-200'
    case 'published':
      return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
    case 'dismissed':
      return 'border-red-400/30 bg-red-500/10 text-red-200'
    default:
      return 'border-white/10 bg-white/5 text-ivory/80'
  }
}

const gradeOptions: Array<{ value: CoachResponsePayload['grade']; label: string; className: string }> = [
  { value: 'A', label: 'A', className: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200' },
  { value: 'B', label: 'B', className: 'border-sky-400/40 bg-sky-500/10 text-sky-200' },
  { value: 'C', label: 'C', className: 'border-amber-400/40 bg-amber-500/10 text-amber-200' },
  { value: 'D', label: 'D', className: 'border-orange-400/40 bg-orange-500/10 text-orange-200' },
  { value: 'F', label: 'F', className: 'border-red-400/40 bg-red-500/10 text-red-200' },
]

const confidenceOptions: Array<{ value: CoachResponsePayload['confidence']; label: string }> = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

function responseFingerprint(payload: CoachResponsePayload | null | undefined): string {
  if (!payload) return ''
  return [
    payload.what_went_well.join('|'),
    payload.areas_to_improve.map((item) => `${item.point}:${item.instruction}`).join('|'),
    payload.specific_drills.map((item) => `${item.title}:${item.description}`).join('|'),
    payload.overall_assessment,
    payload.grade,
    payload.grade_reasoning,
    payload.confidence,
  ].join('~')
}

export function CoachWorkspace({
  entryId,
  note,
  activityLog,
  memberName,
  memberSymbol,
  memberStats,
  memberNotes,
  generating = false,
  saving = false,
  publishing = false,
  dismissing = false,
  uploading = false,
  onGenerateAI,
  onSaveDraft,
  onPublish,
  onDismiss,
  onUploadScreenshot,
  onRemoveScreenshot,
}: CoachWorkspaceProps) {
  const [draft, setDraft] = useState<CoachResponsePayload>(() => normalizeDraft(note))
  const [internalNotes, setInternalNotes] = useState<string>(note?.internal_notes ?? '')
  const [preliminaryNotes, setPreliminaryNotes] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(() => parseIsoDate(note?.updated_at))
  const [previewOpen, setPreviewOpen] = useState(false)
  const [screenshotZoomUrl, setScreenshotZoomUrl] = useState<string | null>(null)
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const noteSyncKey = note
    ? [
        note.updated_at ?? '',
        note.internal_notes ?? '',
        note.is_published ? '1' : '0',
        responseFingerprint(note.coach_response),
        responseFingerprint(note.ai_draft),
        Array.isArray(note.screenshots) ? note.screenshots.join('|') : '',
      ].join('::')
    : 'none'
  const syncedNoteVersionRef = useRef<string>(noteSyncKey)

  const rawPaths = Array.isArray(note?.screenshots) ? note.screenshots : []
  const signedUrls = Array.isArray(note?.screenshot_urls) ? note.screenshot_urls : []
  const screenshots = rawPaths.map((path, index) => ({
    path,
    url: signedUrls[index] ?? null,
  }))

  const canSave = hasMinimumDraftContent(draft)
  const hasGeneratedDraft = Boolean(note?.ai_draft || note?.market_data_snapshot)
  const canPreviewMemberView = hasPreviewableDraftContent(draft)
  const previewFeedback = trimDraft(draft)
  const previewScreenshotUrls = Array.isArray(note?.screenshot_urls)
    ? note.screenshot_urls.filter((url): url is string => typeof url === 'string' && url.length > 0)
    : []

  const markDirty = useCallback(() => {
    setIsDirty(true)
  }, [])

  useEffect(() => {
    if (isDirty) return
    if (syncedNoteVersionRef.current === noteSyncKey) return
    setDraft(normalizeDraft(note))
    setInternalNotes(note?.internal_notes ?? '')
    setLastSavedAt(parseIsoDate(note?.updated_at))
    syncedNoteVersionRef.current = noteSyncKey
  }, [isDirty, note, noteSyncKey])

  useEffect(() => {
    if (!isDirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
    }
  }, [isDirty])

  const mutateWell = (index: number, value: string) => {
    markDirty()
    setDraft((prev) => ({
      ...prev,
      what_went_well: prev.what_went_well.map((item, rowIndex) => (rowIndex === index ? value : item)),
    }))
  }

  const mutateImprove = (index: number, key: 'point' | 'instruction', value: string) => {
    markDirty()
    setDraft((prev) => ({
      ...prev,
      areas_to_improve: prev.areas_to_improve.map((item, rowIndex) => (
        rowIndex === index ? { ...item, [key]: value } : item
      )),
    }))
  }

  const mutateDrill = (index: number, key: 'title' | 'description', value: string) => {
    markDirty()
    setDraft((prev) => ({
      ...prev,
      specific_drills: prev.specific_drills.map((item, rowIndex) => (
        rowIndex === index ? { ...item, [key]: value } : item
      )),
    }))
  }

  const persistDraft = useCallback(async (mode: 'manual' | 'auto') => {
    if (!onSaveDraft || !canSave) return
    setError(null)
    if (mode === 'auto') setAutoSaving(true)

    try {
      await onSaveDraft({
        coach_response: trimDraft(draft),
        internal_notes: internalNotes.trim().length > 0 ? internalNotes.trim() : null,
      })
      setIsDirty(false)
      setLastSavedAt(new Date())
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save draft')
    } finally {
      if (mode === 'auto') setAutoSaving(false)
    }
  }, [canSave, draft, internalNotes, onSaveDraft])

  const handleSave = async () => {
    await persistDraft('manual')
  }

  const handleGenerate = async () => {
    if (!onGenerateAI) return
    setError(null)
    try {
      await onGenerateAI(preliminaryNotes.trim())
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Failed to generate AI analysis')
    }
  }

  useEffect(() => {
    if (!isDirty || !canSave || !onSaveDraft) return
    if (saving || publishing || dismissing || generating || uploading || autoSaving) return

    const timer = window.setTimeout(() => {
      void persistDraft('auto')
    }, 10_000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    autoSaving,
    canSave,
    dismissing,
    generating,
    isDirty,
    onSaveDraft,
    persistDraft,
    publishing,
    saving,
    uploading,
  ])

  const handlePublish = async () => {
    if (!onPublish) return

    setError(null)
    try {
      await onPublish()
      setPublishDialogOpen(false)
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Failed to publish feedback')
    }
  }

  const handleDismiss = async () => {
    if (!onDismiss) return

    setError(null)
    try {
      await onDismiss()
      setDismissDialogOpen(false)
    } catch (dismissError) {
      setError(dismissError instanceof Error ? dismissError.message : 'Failed to dismiss request')
    }
  }

  const handleChooseScreenshot = () => {
    fileInputRef.current?.click()
  }

  const handleUploadScreenshot = async (file: File | null) => {
    if (!file || !onUploadScreenshot) return
    setError(null)

    try {
      await onUploadScreenshot(file)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload screenshot')
    }
  }

  const handleRemoveScreenshot = async (path: string) => {
    if (!onRemoveScreenshot) return
    setError(null)

    try {
      await onRemoveScreenshot(path)
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Failed to remove screenshot')
    }
  }

  const saveStatusLabel = (saving || autoSaving)
    ? 'Saving draft...'
    : isDirty
      ? 'Unsaved changes'
      : lastSavedAt
        ? `Draft saved ${formatSaveTimestamp(lastSavedAt)}`
        : 'No draft saved yet'
  const saveStatusClassName = (saving || autoSaving)
    ? 'text-sky-200'
    : isDirty
      ? 'text-amber-200'
      : lastSavedAt
        ? 'text-emerald-200'
        : 'text-muted-foreground'
  const memberNoteItems: Array<{ label: string; value: string | null | undefined }> = [
    { label: 'Strategy', value: memberNotes?.strategy },
    { label: 'Setup Type', value: memberNotes?.setupType },
    { label: 'Setup Notes', value: memberNotes?.setupNotes },
    { label: 'Execution Notes', value: memberNotes?.executionNotes },
    { label: 'Lessons Learned', value: memberNotes?.lessonsLearned },
    { label: 'Deviation Notes', value: memberNotes?.deviationNotes },
  ]
  const hasMemberNotes = memberNoteItems.some((item) => Boolean(item.value && item.value.trim().length > 0))

  return (
    <div className="glass-card-heavy space-y-4 rounded-xl border border-white/5 p-5">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null
          void handleUploadScreenshot(file)
          event.currentTarget.value = ''
        }}
      />

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ivory">Coach Workspace</h2>
        <p className={`text-xs ${saveStatusClassName}`}>
          {saveStatusLabel}
        </p>
      </div>

      {memberStats ? (
        <section className="rounded-lg border border-white/5 bg-white/5 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Trader Profile</p>
            <p className="text-[11px] text-muted-foreground">{memberName ?? 'Member'}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-white/5 bg-black/20 p-2.5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Win Rate</p>
              <p className={`mt-1 text-sm font-semibold ${winRateTone(memberStats.win_rate)}`}>
                {formatStatPercent(memberStats.win_rate)}
              </p>
            </div>
            <div className="rounded-md border border-white/5 bg-black/20 p-2.5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Trades</p>
              <p className="mt-1 text-sm font-semibold text-ivory">
                {memberStats.total_trades.toLocaleString('en-US')}
              </p>
            </div>
            <div className="rounded-md border border-white/5 bg-black/20 p-2.5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Avg P&L</p>
              <p className={`mt-1 text-sm font-semibold ${memberStats.avg_pnl >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                {formatStatCurrency(memberStats.avg_pnl)}
              </p>
            </div>
            <div className="rounded-md border border-white/5 bg-black/20 p-2.5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {memberSymbol ? `${memberSymbol.toUpperCase()} Win Rate` : 'Symbol Win Rate'}
              </p>
              <p className={`mt-1 text-sm font-semibold ${winRateTone(memberStats.symbol_stats?.win_rate)}`}>
                {formatStatPercent(memberStats.symbol_stats?.win_rate)}
              </p>
            </div>
            <div className="rounded-md border border-white/5 bg-black/20 p-2.5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Recent Streak</p>
              <p className="mt-1 text-sm font-semibold text-ivory">{formatStreak(memberStats.recent_streak)}</p>
            </div>
            <div className="rounded-md border border-white/5 bg-black/20 p-2.5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Avg Discipline</p>
              <p className="mt-1 text-sm font-semibold text-ivory">
                {memberStats.avg_discipline_score == null ? '—' : `${memberStats.avg_discipline_score.toFixed(1)}/5`}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <details className="rounded-lg border border-white/5 bg-white/5 p-3">
        <summary className="cursor-pointer text-xs uppercase tracking-wider text-muted-foreground">
          Member Notes Reference
        </summary>
        <div className="mt-3 space-y-2">
          {hasMemberNotes ? memberNoteItems.map((item) => (
            item.value && item.value.trim().length > 0 ? (
              <div key={item.label}>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ivory/90">{item.value}</p>
              </div>
            ) : null
          )) : (
            <p className="text-xs text-muted-foreground">No member notes were provided for this trade.</p>
          )}
        </div>
      </details>

      <div className="rounded-lg border border-white/5 bg-white/5 p-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">AI Generation</p>
        <p className="mt-1 text-xs text-muted-foreground">Notes below will guide the AI analysis.</p>
        <textarea
          className="mt-2 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory outline-none focus:border-emerald-400/50"
          value={preliminaryNotes}
          onChange={(event) => setPreliminaryNotes(event.target.value)}
          rows={3}
          placeholder="Optional notes to shape the AI analysis..."
        />
        <Button
          type="button"
          size="sm"
          onClick={() => { void handleGenerate() }}
          disabled={generating || !onGenerateAI}
          className="mt-3 h-9 px-3"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {generating ? 'Generating...' : hasGeneratedDraft ? 'Regenerate AI Analysis' : 'Generate AI Analysis'}
        </Button>
      </div>

      <div className="rounded-lg border border-white/5 bg-white/5 p-3">
        <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Internal Notes (Private)</p>
        <textarea
          value={internalNotes}
          onChange={(event) => {
            markDirty()
            setInternalNotes(event.target.value)
          }}
          rows={4}
          placeholder="Private coach notes. Never shown to members."
          className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory outline-none focus:border-emerald-400/50"
        />
      </div>

      <section className="space-y-3 rounded-lg border border-white/5 bg-white/5 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">What Went Well</p>
          <Button
            type="button"
            variant="luxury-outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              markDirty()
              setDraft((prev) => ({ ...prev, what_went_well: [...prev.what_went_well, ''] }))
            }}
            disabled={draft.what_went_well.length >= 5}
          >
            Add
          </Button>
        </div>
        {draft.what_went_well.map((item, index) => (
          <div key={`well-${index}`} className="flex items-start gap-2">
            <textarea
              value={item}
              rows={3}
              onChange={(event) => mutateWell(index, event.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory outline-none focus:border-emerald-400/50"
            />
            <Button
              type="button"
              variant="luxury-outline"
              size="sm"
              className="h-8 px-2"
              onClick={() => {
                markDirty()
                setDraft((prev) => ({
                  ...prev,
                  what_went_well: prev.what_went_well.filter((_, rowIndex) => rowIndex !== index),
                }))
              }}
              aria-label={`Remove What Went Well item ${index + 1}`}
              disabled={draft.what_went_well.length <= 1}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-lg border border-white/5 bg-white/5 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Areas to Improve</p>
          <Button
            type="button"
            variant="luxury-outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              markDirty()
              setDraft((prev) => ({
                ...prev,
                areas_to_improve: [...prev.areas_to_improve, { point: '', instruction: '' }],
              }))
            }}
            disabled={draft.areas_to_improve.length >= 5}
          >
            Add
          </Button>
        </div>
        {draft.areas_to_improve.map((item, index) => (
          <div key={`improve-${index}`} className="space-y-2 rounded-md border border-white/10 bg-black/20 p-2.5">
            <textarea
              value={item.point}
              rows={3}
              placeholder="Observation"
              onChange={(event) => mutateImprove(index, 'point', event.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory outline-none focus:border-emerald-400/50"
            />
            <textarea
              value={item.instruction}
              rows={3}
              placeholder="Specific action"
              onChange={(event) => mutateImprove(index, 'instruction', event.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory outline-none focus:border-emerald-400/50"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                variant="luxury-outline"
                size="sm"
                className="h-7 px-2"
                onClick={() => {
                  markDirty()
                  setDraft((prev) => ({
                    ...prev,
                    areas_to_improve: prev.areas_to_improve.filter((_, rowIndex) => rowIndex !== index),
                  }))
                }}
                aria-label={`Remove Areas to Improve item ${index + 1}`}
                disabled={draft.areas_to_improve.length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-lg border border-white/5 bg-white/5 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Specific Drills</p>
          <Button
            type="button"
            variant="luxury-outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              markDirty()
              setDraft((prev) => ({
                ...prev,
                specific_drills: [...prev.specific_drills, { title: '', description: '' }],
              }))
            }}
            disabled={draft.specific_drills.length >= 3}
          >
            Add
          </Button>
        </div>
        {draft.specific_drills.map((item, index) => (
          <div key={`drill-${index}`} className="space-y-2 rounded-md border border-white/10 bg-black/20 p-2.5">
            <input
              value={item.title}
              placeholder="Drill title"
              onChange={(event) => mutateDrill(index, 'title', event.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory outline-none focus:border-emerald-400/50"
            />
            <textarea
              value={item.description}
              rows={3}
              placeholder="Drill description"
              onChange={(event) => mutateDrill(index, 'description', event.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory outline-none focus:border-emerald-400/50"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                variant="luxury-outline"
                size="sm"
                className="h-7 px-2"
                onClick={() => {
                  markDirty()
                  setDraft((prev) => ({
                    ...prev,
                    specific_drills: prev.specific_drills.filter((_, rowIndex) => rowIndex !== index),
                  }))
                }}
                aria-label={`Remove Specific Drill item ${index + 1}`}
                disabled={draft.specific_drills.length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-lg border border-white/5 bg-white/5 p-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Assessment & Grade</p>
        <textarea
          value={draft.overall_assessment}
          rows={6}
          placeholder="Overall assessment"
          onChange={(event) => {
            markDirty()
            setDraft((prev) => ({ ...prev, overall_assessment: event.target.value }))
          }}
          className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory outline-none focus:border-emerald-400/50"
        />
        <div className="space-y-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Grade</p>
            <div className="mt-1 grid grid-cols-5 gap-1.5" role="group" aria-label="Grade">
              {gradeOptions.map((option) => {
                const isActive = draft.grade === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      markDirty()
                      setDraft((prev) => ({ ...prev, grade: option.value }))
                    }}
                    className={`h-9 rounded-md border text-sm font-semibold transition ${
                      isActive
                        ? option.className
                        : 'border-white/10 bg-black/30 text-muted-foreground hover:text-ivory'
                    }`}
                    aria-pressed={isActive}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Confidence</p>
            <div className="mt-1 grid grid-cols-3 gap-1.5" role="group" aria-label="Confidence Level">
              {confidenceOptions.map((option) => {
                const isActive = draft.confidence === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      markDirty()
                      setDraft((prev) => ({ ...prev, confidence: option.value }))
                    }}
                    className={`h-9 rounded-md border text-sm transition ${
                      isActive
                        ? 'border-sky-400/40 bg-sky-500/10 text-sky-200'
                        : 'border-white/10 bg-black/30 text-muted-foreground hover:text-ivory'
                    }`}
                    aria-pressed={isActive}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <textarea
          value={draft.grade_reasoning}
          rows={3}
          placeholder="Grade reasoning"
          onChange={(event) => {
            markDirty()
            setDraft((prev) => ({ ...prev, grade_reasoning: event.target.value }))
          }}
          className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory outline-none focus:border-emerald-400/50"
        />
      </section>

      <section className="space-y-3 rounded-lg border border-white/5 bg-white/5 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Coach Screenshots</p>
          <Button
            type="button"
            variant="luxury-outline"
            size="sm"
            className="h-8 px-3"
            onClick={handleChooseScreenshot}
            disabled={uploading || !onUploadScreenshot}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload
          </Button>
        </div>
        {screenshots.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {screenshots.map((screenshot) => (
              <div key={screenshot.path} className="space-y-2 rounded-md border border-white/10 bg-black/20 p-2">
                {screenshot.url ? (
                  <button
                    type="button"
                    className="relative h-40 w-full overflow-hidden rounded-md border border-white/10 bg-black/40"
                    onClick={() => setScreenshotZoomUrl(screenshot.url)}
                  >
                    <Image
                      src={screenshot.url}
                      alt={`Coach screenshot ${entryId}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </button>
                ) : (
                  <div className="relative h-40 overflow-hidden rounded-md border border-white/10 bg-black/40">
                    <div className="flex h-full items-center justify-center px-2 text-center text-[11px] text-muted-foreground">
                      Signed URL unavailable
                    </div>
                  </div>
                )}
                <Button
                  type="button"
                  variant="luxury-outline"
                  size="sm"
                  className="h-7 w-full px-2 text-red-300"
                  onClick={() => { void handleRemoveScreenshot(screenshot.path) }}
                  disabled={!onRemoveScreenshot}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No screenshots attached yet.</p>
        )}
      </section>

      {error ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-200">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
        <Button
          type="button"
          variant="luxury-outline"
          size="sm"
          className="h-9 px-3"
          onClick={() => setPreviewOpen(true)}
          disabled={!canPreviewMemberView}
        >
          Preview Member View
        </Button>
        <Button
          type="button"
          variant="luxury-outline"
          size="sm"
          className="h-9 px-3"
          onClick={() => { void handleSave() }}
          disabled={saving || autoSaving || !onSaveDraft || !canSave}
        >
          {(saving || autoSaving) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save Draft
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-9 px-3"
          onClick={() => setPublishDialogOpen(true)}
          disabled={publishing || saving || autoSaving || isDirty || !onPublish}
        >
          {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Publish to Member
        </Button>
        <Button
          type="button"
          variant="luxury-outline"
          size="sm"
          className="h-9 px-3 text-red-300"
          onClick={() => setDismissDialogOpen(true)}
          disabled={dismissing || !onDismiss}
        >
          {dismissing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Dismiss
        </Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden border-white/15 bg-black/95 text-ivory">
          <DialogHeader>
            <DialogTitle className="text-ivory">Preview Member View</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This preview reflects the current draft formatting seen by members after publish.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto pr-1">
            <CoachFeedbackContent
              feedback={previewFeedback}
              coachScreenshots={previewScreenshotUrls}
              showPublishedAt={false}
              className="space-y-4 rounded-lg border border-white/10 bg-white/5 p-4"
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(screenshotZoomUrl)} onOpenChange={(open) => { if (!open) setScreenshotZoomUrl(null) }}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden border-white/15 bg-black/95 p-4">
          {screenshotZoomUrl ? (
            <div className="relative h-[78vh] w-full overflow-hidden rounded-lg border border-white/10 bg-black">
              <Image
                src={screenshotZoomUrl}
                alt={`Coach screenshot ${entryId} full size`}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent className="border-white/15 bg-black/95 text-ivory">
          <AlertDialogHeader>
            <AlertDialogTitle>Publish Coach Feedback?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-muted-foreground">
              <span className="block">
                This will publish feedback to {memberName ?? 'the member'} and mark this review as completed.
              </span>
              <span className="block text-ivory/80">
                Grade {draft.grade} · {previewFeedback.areas_to_improve.length} improvement point
                {previewFeedback.areas_to_improve.length === 1 ? '' : 's'} · {previewFeedback.specific_drills.length} drill
                {previewFeedback.specific_drills.length === 1 ? '' : 's'}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-white/5 text-ivory hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-500 text-black hover:bg-emerald-400"
              onClick={(event) => {
                event.preventDefault()
                void handlePublish()
              }}
              disabled={publishing || saving || autoSaving || isDirty || !onPublish}
            >
              {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dismissDialogOpen} onOpenChange={setDismissDialogOpen}>
        <AlertDialogContent className="border-white/15 bg-black/95 text-ivory">
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss Review Request?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-muted-foreground">
              <span className="block">
                This closes the review request for {memberName ?? 'this member'} without publishing feedback.
              </span>
              <span className="block text-red-200/90">
                You can continue editing drafts later, but this request will be removed from the active queue.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-white/5 text-ivory hover:bg-white/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 text-white hover:bg-red-400"
              onClick={(event) => {
                event.preventDefault()
                void handleDismiss()
              }}
              disabled={dismissing || !onDismiss}
            >
              {dismissing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm Dismiss
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <details className="rounded-lg border border-white/5 bg-white/5 p-3">
        <summary className="cursor-pointer text-xs uppercase tracking-wider text-muted-foreground">
          Activity Log ({activityLog.length})
        </summary>
        <div className="mt-3 space-y-2">
          {activityLog.length === 0 ? (
            <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
          ) : activityLog.map((entry, index) => (
            <div key={`activity-${index}`} className="rounded-md border border-white/10 bg-black/20 p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${activityBadgeClass(entry.action)}`}>
                  {activityLabel(entry.action)}
                </span>
                <p className="text-[11px] text-muted-foreground">
                  by {entry.actor_name ?? 'System'}
                </p>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatRelativeTimestamp(entry.created_at)} · {formatActivityTimestamp(entry.created_at)}
              </p>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
