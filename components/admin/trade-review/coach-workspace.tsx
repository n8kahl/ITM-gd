'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Loader2, Upload, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CoachResponsePayload, CoachTradeNote } from '@/lib/types/coach-review'

interface CoachWorkspaceProps {
  entryId: string
  note: CoachTradeNote | null
  activityLog: Array<Record<string, unknown>>
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

export function CoachWorkspace({
  entryId,
  note,
  activityLog,
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
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const rawPaths = Array.isArray(note?.screenshots) ? note.screenshots : []
  const signedUrls = Array.isArray(note?.screenshot_urls) ? note.screenshot_urls : []
  const screenshots = rawPaths.map((path, index) => ({
    path,
    url: signedUrls[index] ?? null,
  }))

  const canSave = hasMinimumDraftContent(draft)

  const mutateWell = (index: number, value: string) => {
    setDraft((prev) => ({
      ...prev,
      what_went_well: prev.what_went_well.map((item, rowIndex) => (rowIndex === index ? value : item)),
    }))
  }

  const mutateImprove = (index: number, key: 'point' | 'instruction', value: string) => {
    setDraft((prev) => ({
      ...prev,
      areas_to_improve: prev.areas_to_improve.map((item, rowIndex) => (
        rowIndex === index ? { ...item, [key]: value } : item
      )),
    }))
  }

  const mutateDrill = (index: number, key: 'title' | 'description', value: string) => {
    setDraft((prev) => ({
      ...prev,
      specific_drills: prev.specific_drills.map((item, rowIndex) => (
        rowIndex === index ? { ...item, [key]: value } : item
      )),
    }))
  }

  const handleSave = async () => {
    if (!onSaveDraft || !canSave) return
    setError(null)

    try {
      await onSaveDraft({
        coach_response: trimDraft(draft),
        internal_notes: internalNotes.trim().length > 0 ? internalNotes.trim() : null,
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save draft')
    }
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

  const handlePublish = async () => {
    if (!onPublish) return
    if (!window.confirm('This will publish coach feedback to the member. Continue?')) return

    setError(null)
    try {
      await onPublish()
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Failed to publish feedback')
    }
  }

  const handleDismiss = async () => {
    if (!onDismiss) return
    if (!window.confirm('Dismiss this review request without publishing feedback?')) return

    setError(null)
    try {
      await onDismiss()
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

  return (
    <div className="glass-card-heavy space-y-4 rounded-xl border border-white/10 p-5">
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
        <Button
          type="button"
          size="sm"
          onClick={() => { void handleGenerate() }}
          disabled={generating || !onGenerateAI}
          className="h-9 px-3"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {generating ? 'Generating...' : 'Generate AI Analysis'}
        </Button>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Coach Preliminary Notes</p>
        <textarea
          value={preliminaryNotes}
          onChange={(event) => setPreliminaryNotes(event.target.value)}
          rows={3}
          placeholder="Optional notes to shape the AI analysis..."
          className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory outline-none focus:border-emerald-400/50"
        />
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-3">
        <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Internal Notes (Private)</p>
        <textarea
          value={internalNotes}
          onChange={(event) => setInternalNotes(event.target.value)}
          rows={4}
          placeholder="Private coach notes. Never shown to members."
          className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory outline-none focus:border-emerald-400/50"
        />
      </div>

      <section className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">What Went Well</p>
          <Button
            type="button"
            variant="luxury-outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setDraft((prev) => ({ ...prev, what_went_well: [...prev.what_went_well, ''] }))}
            disabled={draft.what_went_well.length >= 5}
          >
            Add
          </Button>
        </div>
        {draft.what_went_well.map((item, index) => (
          <div key={`well-${index}`} className="flex items-start gap-2">
            <textarea
              value={item}
              rows={2}
              onChange={(event) => mutateWell(index, event.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory outline-none focus:border-emerald-400/50"
            />
            <Button
              type="button"
              variant="luxury-outline"
              size="sm"
              className="h-8 px-2"
              onClick={() => setDraft((prev) => ({
                ...prev,
                what_went_well: prev.what_went_well.filter((_, rowIndex) => rowIndex !== index),
              }))}
              disabled={draft.what_went_well.length <= 1}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Areas to Improve</p>
          <Button
            type="button"
            variant="luxury-outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setDraft((prev) => ({
              ...prev,
              areas_to_improve: [...prev.areas_to_improve, { point: '', instruction: '' }],
            }))}
            disabled={draft.areas_to_improve.length >= 5}
          >
            Add
          </Button>
        </div>
        {draft.areas_to_improve.map((item, index) => (
          <div key={`improve-${index}`} className="space-y-2 rounded-md border border-white/10 bg-black/20 p-2.5">
            <textarea
              value={item.point}
              rows={2}
              placeholder="Observation"
              onChange={(event) => mutateImprove(index, 'point', event.target.value)}
              className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory outline-none focus:border-emerald-400/50"
            />
            <textarea
              value={item.instruction}
              rows={2}
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
                onClick={() => setDraft((prev) => ({
                  ...prev,
                  areas_to_improve: prev.areas_to_improve.filter((_, rowIndex) => rowIndex !== index),
                }))}
                disabled={draft.areas_to_improve.length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Specific Drills</p>
          <Button
            type="button"
            variant="luxury-outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setDraft((prev) => ({
              ...prev,
              specific_drills: [...prev.specific_drills, { title: '', description: '' }],
            }))}
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
              rows={2}
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
                onClick={() => setDraft((prev) => ({
                  ...prev,
                  specific_drills: prev.specific_drills.filter((_, rowIndex) => rowIndex !== index),
                }))}
                disabled={draft.specific_drills.length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Assessment & Grade</p>
        <textarea
          value={draft.overall_assessment}
          rows={4}
          placeholder="Overall assessment"
          onChange={(event) => setDraft((prev) => ({ ...prev, overall_assessment: event.target.value }))}
          className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory outline-none focus:border-emerald-400/50"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={draft.grade}
            onChange={(event) => setDraft((prev) => ({
              ...prev,
              grade: event.target.value as CoachResponsePayload['grade'],
            }))}
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory outline-none focus:border-emerald-400/50"
          >
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
            <option value="F">F</option>
          </select>
          <select
            value={draft.confidence}
            onChange={(event) => setDraft((prev) => ({
              ...prev,
              confidence: event.target.value as CoachResponsePayload['confidence'],
            }))}
            className="rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory outline-none focus:border-emerald-400/50"
          >
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
        </div>
        <textarea
          value={draft.grade_reasoning}
          rows={2}
          placeholder="Grade reasoning"
          onChange={(event) => setDraft((prev) => ({ ...prev, grade_reasoning: event.target.value }))}
          className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-ivory outline-none focus:border-emerald-400/50"
        />
      </section>

      <section className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-3">
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
                <div className="relative h-24 overflow-hidden rounded-md border border-white/10 bg-black/40">
                  {screenshot.url ? (
                    <Image
                      src={screenshot.url}
                      alt={`Coach screenshot ${entryId}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-2 text-center text-[11px] text-muted-foreground">
                      Signed URL unavailable
                    </div>
                  )}
                </div>
                <p className="truncate text-[11px] text-muted-foreground">{screenshot.path}</p>
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

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <Button
          type="button"
          variant="luxury-outline"
          size="sm"
          className="h-9 px-3"
          onClick={() => { void handleSave() }}
          disabled={saving || !onSaveDraft || !canSave}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save Draft
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-9 px-3"
          onClick={() => { void handlePublish() }}
          disabled={publishing || !onPublish || !canSave}
        >
          {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Publish to Member
        </Button>
        <Button
          type="button"
          variant="luxury-outline"
          size="sm"
          className="h-9 px-3 text-red-300"
          onClick={() => { void handleDismiss() }}
          disabled={dismissing || !onDismiss}
        >
          {dismissing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Dismiss
        </Button>
      </div>

      <details className="rounded-lg border border-white/10 bg-white/5 p-3">
        <summary className="cursor-pointer text-xs uppercase tracking-wider text-muted-foreground">
          Activity Log ({activityLog.length})
        </summary>
        <div className="mt-3 space-y-2">
          {activityLog.length === 0 ? (
            <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
          ) : activityLog.map((entry, index) => (
            <div key={`activity-${index}`} className="rounded-md border border-white/10 bg-black/20 p-2">
              <p className="text-xs text-ivory/90">{String(entry.action ?? 'unknown')}</p>
              <p className="text-[11px] text-muted-foreground">{formatActivityTimestamp(entry.created_at)}</p>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
