# Trade Journal V2 — P0/P1 Implementation Spec
**Target:** Production-Ready Trade Journal
**Phase:** Critical Fixes + High Priority Enhancements
**Estimated Effort:** 12-16 hours
**Success Criteria:** All P0/P1 issues resolved, mobile-first tested, accessibility compliant

---

## 1. Scope & Objectives

### 1.1 In-Scope (This Implementation)

**P0 - Ship Blockers:**
1. Fix modal scrolling on mobile devices
2. Fix filter bar responsive layout
3. Add screenshot upload UI with drag & drop (in entry form)
4. Add quick screenshot input on main page (paste/upload → auto-create entry)
5. Add AI grading UI with button trigger

**P1 - High Priority:**
5. Reorganize full entry form into logical sections
6. Add comprehensive form field validation feedback
7. Implement keyboard navigation for table view
8. Replace text loading states with skeleton loaders
9. Add focus trap to delete confirmation modal

**Documentation & Testing:**
10. Complete E2E test suite for all fixed features
11. Update component documentation
12. Add accessibility audit passing criteria

### 1.2 Out-of-Scope (Future Iterations)

- P2 enhancements (keyboard shortcuts, bulk actions, templates)
- Analytics dashboard improvements
- CSV export functionality
- Trade replay visualization
- PWA/offline mutation queue

---

## 2. Technical Requirements

### 2.1 P0.1 — Modal Scrolling Fix

**File:** `components/journal/trade-entry-sheet.tsx`

**Problem:**
- Modal content overflows viewport on mobile
- Form is 1200px+ tall, phones are 667-926px
- Keyboard takes 300-400px, making Save button inaccessible
- No internal scrolling on modal body

**Solution:**

```tsx
// Current (BROKEN):
<div
  ref={containerRef}
  role="dialog"
  aria-modal="true"
  className="relative z-10 w-full max-w-4xl rounded-t-xl border border-white/10 bg-[#101315] p-4 sm:rounded-xl"
>

// Fixed (WORKING):
<div
  ref={containerRef}
  role="dialog"
  aria-modal="true"
  className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-t-xl border border-white/10 bg-[#101315] sm:rounded-xl"
>
  <div className="p-4">
    {/* Header - fixed */}
    <div className="mb-4 flex items-center justify-between sticky top-0 bg-[#101315] z-10 -mx-4 px-4 py-3 border-b border-white/10">
      {/* ... header content ... */}
    </div>

    {/* Scrollable content area */}
    <div className="space-y-4">
      {/* Form content */}
    </div>

    {/* Footer - sticky bottom */}
    {mode === 'full' && (
      <div className="sticky bottom-0 bg-[#101315] -mx-4 px-4 pt-4 border-t border-white/10 mt-4">
        {/* Save/Cancel buttons */}
      </div>
    )}
  </div>
</div>
```

**Mobile-Specific Adjustments:**
- Header sticky at top
- Footer sticky at bottom
- Content scrolls between header/footer
- Max height = 90vh (leaves room for mobile chrome)
- Padding adjustments for sticky elements

**Test Cases:**
- [ ] iPhone SE (375x667) - smallest screen
- [ ] iPhone 12 Pro (390x844)
- [ ] iPhone 14 Pro Max (430x932)
- [ ] Samsung Galaxy S21 (360x800)
- [ ] With keyboard open (test in mobile Safari/Chrome)
- [ ] Landscape orientation
- [ ] Can scroll to Save button with keyboard open
- [ ] Header stays visible while scrolling
- [ ] Footer buttons accessible at all times

---

### 2.2 P0.2 — Filter Bar Responsive Layout

**File:** `components/journal/journal-filter-bar.tsx`

**Problem:**
- First row: `md:grid-cols-6` at 768px = 128px per input (too cramped)
- Second row: `md:grid-cols-5` at 768px = 154px per input (too cramped)
- Inputs are unusable on tablets (768-1024px range)

**Solution:**

```tsx
// Current (BROKEN):
<div className="grid grid-cols-1 gap-3 md:grid-cols-6">

// Fixed (RESPONSIVE):
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">

// And for second row:
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
```

**Responsive Breakpoints:**
- Mobile (< 640px): 1 column (stacked)
- Small tablet (640-768px): 2 columns
- Tablet (768-1024px): 3 columns
- Desktop (1024px+): 5-6 columns

**Test Cases:**
- [ ] Mobile 375px - single column
- [ ] Tablet 768px - 3 columns, readable
- [ ] Desktop 1280px - full 6 columns
- [ ] iPad Pro landscape 1366px
- [ ] Filters remain functional at all sizes
- [ ] No horizontal overflow
- [ ] Touch targets ≥ 44px (iOS guidelines)

---

### 2.3 P0.3 — Screenshot Upload UI

**Files:**
- `components/journal/full-entry-form.tsx` (add upload section)
- `components/journal/screenshot-upload-zone.tsx` (new component)
- `lib/journal/screenshot-upload.ts` (new helper)

**New Component: `screenshot-upload-zone.tsx`**

```tsx
'use client'

import { useState, useCallback } from 'react'
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScreenshotUploadZoneProps {
  currentScreenshotUrl?: string | null
  onUploadComplete: (url: string, storagePath: string) => void
  onRemove: () => void
  disabled?: boolean
}

export function ScreenshotUploadZone({
  currentScreenshotUrl,
  onUploadComplete,
  onRemove,
  disabled = false,
}: ScreenshotUploadZoneProps) {
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(currentScreenshotUrl ?? null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files[0]) {
      await handleFile(files[0])
    }
  }, [])

  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files[0]) {
      await handleFile(files[0])
    }
  }, [])

  const handleFile = useCallback(async (file: File) => {
    // Validation
    const maxSize = 5 * 1024 * 1024 // 5MB
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']

    if (!allowedTypes.includes(file.type)) {
      setError('Only PNG, JPEG, and WebP images are allowed')
      return
    }

    if (file.size > maxSize) {
      setError('File size must be less than 5MB')
      return
    }

    setError(null)
    setUploading(true)

    try {
      // Get signed upload URL
      const response = await fetch('/api/members/journal/screenshot-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get upload URL')
      }

      const { uploadUrl, storagePath, publicUrl } = await response.json()

      // Upload to Supabase Storage
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file')
      }

      // Set preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)

      // Notify parent
      onUploadComplete(publicUrl, storagePath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [onUploadComplete])

  const handleRemove = useCallback(() => {
    setPreview(null)
    setError(null)
    onRemove()
  }, [onRemove])

  if (preview) {
    return (
      <div className="relative rounded-lg border border-white/10 bg-white/5 p-3">
        <div className="relative aspect-video w-full overflow-hidden rounded-md">
          <img src={preview} alt="Trade screenshot" className="h-full w-full object-contain" />
        </div>
        <button
          type="button"
          onClick={handleRemove}
          disabled={disabled || uploading}
          className="absolute right-1 top-1 rounded-md bg-black/60 p-1.5 text-white hover:bg-black/80"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div>
      <label
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors',
          dragActive
            ? 'border-emerald-500 bg-emerald-500/10'
            : 'border-white/20 bg-white/5 hover:border-white/30',
          disabled && 'cursor-not-allowed opacity-60'
        )}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        ) : (
          <>
            <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-ivory">
              <span className="font-medium text-emerald-500">Click to upload</span> or drag and drop
            </p>
            <p className="mt-1 text-xs text-muted-foreground">PNG, JPEG, or WebP (max 5MB)</p>
          </>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleChange}
          disabled={disabled || uploading}
          className="hidden"
        />
      </label>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  )
}
```

**Integration into Full Entry Form:**

Add new section in `full-entry-form.tsx` (after Notes section):

```tsx
<details className="rounded-lg border border-white/10 bg-white/5 p-3">
  <summary className="cursor-pointer text-sm font-medium text-ivory">Screenshot</summary>
  <div className="mt-3">
    <ScreenshotUploadZone
      currentScreenshotUrl={values.screenshot_url}
      onUploadComplete={(url, path) => {
        onChange('screenshot_url', url)
        onChange('screenshot_storage_path', path)
      }}
      onRemove={() => {
        onChange('screenshot_url', null)
        onChange('screenshot_storage_path', null)
      }}
      disabled={disabled}
    />
  </div>
</details>
```

**Test Cases:**
- [ ] Drag & drop PNG file - uploads successfully
- [ ] Click to select file - opens file picker
- [ ] Upload JPEG - works
- [ ] Upload WebP - works
- [ ] Try to upload PDF - shows error "Only PNG, JPEG, and WebP..."
- [ ] Try to upload 6MB file - shows error "File size must be less than 5MB"
- [ ] Preview shows after upload
- [ ] Remove button deletes preview
- [ ] Disabled state prevents upload
- [ ] Loading spinner shows during upload
- [ ] Error messages clear on retry
- [ ] Works on mobile Safari (iOS)
- [ ] Works on Chrome Android

---

### 2.4 P0.4 — Quick Screenshot Entry (Critical Trader Workflow)

**Location:** Main journal page header, next to Import button

**Problem:**
- Traders often screenshot their trades immediately after execution
- Current workflow: New Entry → Full Form → Scroll to Screenshot → Upload → Fill other fields
- This is 5 clicks + scrolling - too slow for quick logging
- Screenshot is often the ONLY initial data traders have

**Solution: Screenshot-First Entry Creation**

**Add Quick Screenshot Button:**

```tsx
// In app/members/journal/page.tsx header section
<div className="flex items-center gap-2">
  <Link href="/members/journal/analytics" className="...">
    <BarChart3 className="h-4 w-4" />
    Analytics
  </Link>

  {/* NEW: Quick Screenshot Button */}
  <button
    type="button"
    onClick={() => setShowScreenshotQuickAdd(true)}
    className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-ivory hover:bg-white/5"
  >
    <ImageIcon className="h-4 w-4" />
    Screenshot
  </button>

  <button
    type="button"
    onClick={() => setShowImportWizard((prev) => !prev)}
    className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 px-3 text-sm text-ivory hover:bg-white/5"
  >
    <Upload className="h-4 w-4" />
    Import
  </button>

  <button
    type="button"
    onClick={() => {
      setEditEntry(null)
      setSheetOpen(true)
    }}
    disabled={disableActions}
    className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
  >
    <Plus className="h-4 w-4" />
    New Entry
  </button>
</div>
```

**New Component: `screenshot-quick-add.tsx`**

```tsx
'use client'

import { useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Upload, Loader2, Clipboard, Check } from 'lucide-react'
import { useFocusTrap } from '@/hooks/use-focus-trap'

interface ScreenshotQuickAddProps {
  open: boolean
  onClose: () => void
  onEntryCreated: (entryId: string) => void
}

export function ScreenshotQuickAdd({ open, onClose, onEntryCreated }: ScreenshotQuickAddProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [pasteSupported, setPasteSupported] = useState(false)

  // Optional fields for quick context
  const [symbol, setSymbol] = useState('')
  const [notes, setNotes] = useState('')

  useFocusTrap({
    active: open,
    containerRef,
    onEscape: () => {
      if (!uploading) onClose()
    },
  })

  // Check clipboard API support
  useState(() => {
    setPasteSupported(typeof navigator?.clipboard?.read === 'function')
  }, [])

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const imageTypes = item.types.filter(type => type.startsWith('image/'))
        if (imageTypes.length > 0) {
          const blob = await item.getType(imageTypes[0])
          const file = new File([blob], `screenshot-${Date.now()}.png`, { type: blob.type })
          await handleFile(file)
          return
        }
      }
      setError('No image found in clipboard. Try copying a screenshot first.')
    } catch (err) {
      setError('Failed to read clipboard. Try drag & drop or file upload instead.')
    }
  }, [])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files[0]) {
      await handleFile(files[0])
    }
  }, [])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files[0]) {
      await handleFile(files[0])
    }
  }, [])

  const handleFile = useCallback(async (file: File) => {
    // Validation
    const maxSize = 5 * 1024 * 1024 // 5MB
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']

    if (!allowedTypes.includes(file.type)) {
      setError('Only PNG, JPEG, and WebP images are allowed')
      return
    }

    if (file.size > maxSize) {
      setError('File size must be less than 5MB')
      return
    }

    setError(null)
    setUploading(true)

    try {
      // Get signed upload URL
      const response = await fetch('/api/members/journal/screenshot-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get upload URL')
      }

      const { uploadUrl, storagePath, publicUrl } = await response.json()

      // Upload to Supabase Storage
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file')
      }

      // Set preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)

      // Auto-create journal entry with screenshot
      await createEntryWithScreenshot(publicUrl, storagePath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setUploading(false)
    }
  }, [symbol, notes, onEntryCreated, onClose])

  const createEntryWithScreenshot = async (screenshotUrl: string, storagePath: string) => {
    try {
      const payload: Record<string, unknown> = {
        symbol: symbol.trim() || 'TEMP', // Temporary symbol if not provided
        screenshot_url: screenshotUrl,
        screenshot_storage_path: storagePath,
        setup_notes: notes.trim() || undefined,
        trade_date: new Date().toISOString(),
      }

      const response = await fetch('/api/members/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Failed to create journal entry')
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Failed to create entry')
      }

      // Success! Notify parent and close
      onEntryCreated(result.data.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create entry')
    } finally {
      setUploading(false)
    }
  }

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="absolute inset-0"
        onClick={() => {
          if (!uploading) onClose()
        }}
      />

      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="screenshot-title"
        className="relative z-10 w-full max-w-2xl rounded-xl border border-white/10 bg-[#101315] p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="screenshot-title" className="text-lg font-semibold text-ivory">
              Quick Entry from Screenshot
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste, drag & drop, or upload a screenshot to create a journal entry
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="rounded-md border border-white/10 p-2 text-muted-foreground hover:text-ivory"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {preview ? (
          <div className="space-y-4">
            <div className="relative aspect-video overflow-hidden rounded-lg border border-white/10">
              <img src={preview} alt="Trade screenshot preview" className="h-full w-full object-contain bg-black/20" />
            </div>

            {/* Optional context fields */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Symbol (optional)</label>
                <input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g. AAPL"
                  className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
                  disabled={uploading}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Quick Notes (optional)</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Morning breakout"
                  className="h-10 w-full rounded-md border border-white/10 bg-black/20 px-3 text-sm text-ivory"
                  disabled={uploading}
                />
              </div>
            </div>

            {uploading && (
              <div className="flex items-center justify-center gap-2 text-sm text-emerald-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating journal entry...
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Paste from clipboard button */}
            {pasteSupported && (
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                disabled={uploading}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-emerald-500/40 bg-emerald-500/10 px-6 py-4 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20"
              >
                <Clipboard className="h-5 w-5" />
                Paste from Clipboard
              </button>
            )}

            {/* Drag & drop zone */}
            <label
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 transition-colors',
                dragActive
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-white/20 bg-white/5 hover:border-white/30',
                uploading && 'cursor-not-allowed opacity-60'
              )}
            >
              {uploading ? (
                <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
              ) : (
                <>
                  <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-base text-ivory">
                    <span className="font-medium text-emerald-500">Click to upload</span> or drag and drop
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">PNG, JPEG, or WebP (max 5MB)</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileSelect}
                disabled={uploading}
                className="hidden"
              />
            </label>

            {error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
```

**Integration:**

```tsx
// app/members/journal/page.tsx
import { ScreenshotQuickAdd } from '@/components/journal/screenshot-quick-add'

// Add state
const [showScreenshotQuickAdd, setShowScreenshotQuickAdd] = useState(false)

// Add component before ImportWizard
{showScreenshotQuickAdd && (
  <ScreenshotQuickAdd
    open={showScreenshotQuickAdd}
    onClose={() => setShowScreenshotQuickAdd(false)}
    onEntryCreated={(entryId) => {
      setShowScreenshotQuickAdd(false)
      void loadEntries()
      // Optionally auto-open the new entry for editing
      const newEntry = entries.find(e => e.id === entryId)
      if (newEntry) {
        setEditEntry(newEntry)
        setSheetOpen(true)
      }
    }}
  />
)}
```

**Workflow:**

1. Trader takes screenshot (Cmd+Shift+4 on Mac, Win+Shift+S on Windows)
2. Opens journal page
3. Clicks "Screenshot" button
4. **Either:**
   - Clicks "Paste from Clipboard" (fastest - 1 click!)
   - Drags screenshot from desktop
   - Clicks to select file
5. (Optional) Adds symbol and quick notes
6. Screenshot auto-uploads and creates entry
7. Entry opens in edit mode to fill remaining details

**Benefits:**
- **Fastest** way to log a trade (2 clicks total)
- Captures trade immediately while fresh
- Mobile-friendly (can paste from Photos app)
- No need to remember all details - screenshot has them
- Can fill in full details later

**Test Cases:**
- [ ] Paste button works (Chrome, Safari, Firefox)
- [ ] Paste from clipboard after taking screenshot
- [ ] Drag & drop screenshot from desktop
- [ ] Click to upload from file picker
- [ ] Works with PNG screenshot
- [ ] Works with JPEG photo
- [ ] File validation shows errors
- [ ] Preview displays correctly
- [ ] Optional symbol/notes save with entry
- [ ] Entry auto-created on upload success
- [ ] Entry opens in edit mode after creation
- [ ] Works on mobile Safari (paste from Photos)
- [ ] Works on Chrome Android
- [ ] Keyboard shortcuts work (Cmd+V to paste)
- [ ] Error handling graceful

**Priority:** P0 - This is the **killer feature** for trader adoption

---

### 2.5 P0.5 — AI Grading UI

**Files:**
- `components/journal/entry-detail-sheet.tsx` (add grade button)
- `components/journal/ai-grade-display.tsx` (new component)

**Add to Entry Detail Sheet:**

```tsx
// In actions section, add Grade button
<button
  type="button"
  onClick={handleGrade}
  disabled={disableActions || grading}
  className="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-500/40 px-4 text-sm text-emerald-400 hover:bg-emerald-500/10"
>
  {grading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
  {grading ? 'Grading...' : 'Grade Trade'}
</button>

// Show grade result if exists
{entry.ai_analysis && (
  <AIGradeDisplay analysis={entry.ai_analysis} />
)}
```

**New Component: `ai-grade-display.tsx`**

```tsx
'use client'

import type { AITradeAnalysis } from '@/lib/types/journal'
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'

interface AIGradeDisplayProps {
  analysis: AITradeAnalysis
}

const gradeConfig = {
  A: { color: 'emerald', icon: CheckCircle2, label: 'Excellent' },
  B: { color: 'champagne', icon: CheckCircle2, label: 'Good' },
  C: { color: 'amber', icon: AlertTriangle, label: 'Fair' },
  D: { color: 'orange', icon: AlertTriangle, label: 'Poor' },
  F: { color: 'red', icon: XCircle, label: 'Failed' },
} as const

export function AIGradeDisplay({ analysis }: AIGradeDisplayProps) {
  const config = gradeConfig[analysis.grade]
  const Icon = config.icon

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="mb-4 flex items-center gap-3">
        <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-${config.color}-900/30 border border-${config.color}-800/30`}>
          <span className={`text-xl font-bold text-${config.color}-400`}>{analysis.grade}</span>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-ivory">AI Trade Grade</h4>
          <p className="text-xs text-muted-foreground">{config.label} — Scored {new Date(analysis.scored_at).toLocaleString()}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h5 className="mb-1 text-xs font-medium text-muted-foreground">Entry Quality</h5>
          <p className="text-sm text-ivory">{analysis.entry_quality}</p>
        </div>

        <div>
          <h5 className="mb-1 text-xs font-medium text-muted-foreground">Exit Quality</h5>
          <p className="text-sm text-ivory">{analysis.exit_quality}</p>
        </div>

        <div>
          <h5 className="mb-1 text-xs font-medium text-muted-foreground">Risk Management</h5>
          <p className="text-sm text-ivory">{analysis.risk_management}</p>
        </div>

        {analysis.lessons.length > 0 && (
          <div>
            <h5 className="mb-2 text-xs font-medium text-muted-foreground">Lessons Learned</h5>
            <ul className="space-y-1">
              {analysis.lessons.map((lesson, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ivory">
                  <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 text-${config.color}-400`} />
                  <span>{lesson}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
```

**Grade Handler Logic:**

```tsx
const handleGrade = async () => {
  if (!entry) return
  setGrading(true)
  setGradeError(null)

  try {
    const response = await fetch('/api/members/journal/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryIds: [entry.id] }),
    })

    if (!response.ok) {
      throw new Error('Failed to grade trade')
    }

    const payload = await response.json()
    if (!payload.success) {
      throw new Error(payload.error || 'Grading failed')
    }

    // Update entry with new analysis
    const graded = payload.data[0]
    // Trigger parent to refresh entry
    onGradeComplete(graded)
  } catch (err) {
    setGradeError(err instanceof Error ? err.message : 'Grading failed')
  } finally {
    setGrading(false)
  }
}
```

**Test Cases:**
- [ ] Grade button visible in entry detail
- [ ] Click triggers grade API call
- [ ] Loading spinner shows during grading
- [ ] Grade display appears after completion
- [ ] All 5 grades (A-F) render correctly
- [ ] Lessons list displays properly
- [ ] Error handling shows user-friendly message
- [ ] Re-grading updates existing grade
- [ ] Works on mobile layout

---

### 2.5 P1.1 — Reorganize Full Entry Form

**File:** `components/journal/full-entry-form.tsx`

**Problem:**
- 35+ fields in one `<details>` section
- Overwhelming, hard to scan
- Fields not logically grouped

**Solution:**

```tsx
export function FullEntryForm({ values, symbolError, disabled = false, onChange }: FullEntryFormProps) {
  return (
    <div className="space-y-3">
      {/* Section 1: Core Trade Details */}
      <details open className="rounded-lg border border-white/10 bg-white/5 p-3">
        <summary className="cursor-pointer text-sm font-medium text-ivory">
          Core Trade Details
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {/* trade_date, symbol, direction, contract_type */}
          {/* entry_price, exit_price, position_size */}
          {/* pnl, pnl_percentage, is_open */}
        </div>
      </details>

      {/* Section 2: Risk Management */}
      <details className="rounded-lg border border-white/10 bg-white/5 p-3">
        <summary className="cursor-pointer text-sm font-medium text-ivory">
          Risk Management
        </summary>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {/* stop_loss, initial_target, strategy */}
          {/* hold_duration_min, mfe_percent, mae_percent */}
        </div>
      </details>

      {/* Section 3: Options Details (conditional) */}
      {values.contract_type !== 'stock' && (
        <details className="rounded-lg border border-white/10 bg-white/5 p-3">
          <summary className="cursor-pointer text-sm font-medium text-ivory">
            Options Details
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            {/* strike_price, expiration_date, dte_at_entry */}
            {/* iv_at_entry, delta_at_entry, theta_at_entry */}
            {/* gamma_at_entry, vega_at_entry */}
            {/* underlying_at_entry, underlying_at_exit */}
          </div>
        </details>
      )}

      {/* Section 4: Psychology & Discipline */}
      <details className="rounded-lg border border-white/10 bg-white/5 p-3">
        <summary className="cursor-pointer text-sm font-medium text-ivory">
          Psychology & Discipline
        </summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* mood_before, mood_after */}
            {/* discipline_score, followed_plan */}
          </div>
          {/* deviation_notes (full width textarea) */}
        </div>
      </details>

      {/* Section 5: Notes & Tags */}
      <details className="rounded-lg border border-white/10 bg-white/5 p-3">
        <summary className="cursor-pointer text-sm font-medium text-ivory">
          Notes & Lessons
        </summary>
        <div className="mt-3 space-y-3">
          {/* setup_notes */}
          {/* execution_notes */}
          {/* lessons_learned */}
          {/* tags, rating */}
        </div>
      </details>

      {/* Section 6: Screenshot */}
      <details className="rounded-lg border border-white/10 bg-white/5 p-3">
        <summary className="cursor-pointer text-sm font-medium text-ivory">
          Screenshot
        </summary>
        <div className="mt-3">
          <ScreenshotUploadZone {...} />
        </div>
      </details>
    </div>
  )
}
```

**Benefits:**
- Logical grouping improves scannability
- Collapsed sections reduce visual overwhelm
- Options section only shows for calls/puts
- First section open by default (common fields)
- Mobile-friendly (sections stack cleanly)

**Test Cases:**
- [ ] All 6 sections present
- [ ] Core Trade Details open by default
- [ ] Others collapsed by default
- [ ] Options section hidden for stock trades
- [ ] Options section visible for call/put trades
- [ ] Click summary toggles collapse
- [ ] All fields accessible in their sections
- [ ] Mobile layout stacks nicely

---

### 2.6 P1.2 — Comprehensive Form Validation Feedback

**File:** `components/journal/full-entry-form.tsx`

**Problem:**
- Only symbol shows validation errors
- Other fields fail silently
- No visual indication of required fields

**Solution:**

Add validation state to form:

```tsx
interface FullEntryFormProps {
  values: FullEntryValues
  symbolError: string | null
  errors: Record<string, string>  // NEW
  disabled?: boolean
  onChange: (key: keyof FullEntryValues, value: string | boolean) => void
}

// Field helper component
function FormField({
  label,
  error,
  required,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}

// Usage:
<FormField label="Symbol" error={symbolError} required>
  <input
    value={values.symbol}
    onChange={(event) => onChange('symbol', event.target.value.toUpperCase())}
    className={cn(
      "h-10 w-full rounded-md border bg-black/20 px-3 text-sm text-ivory",
      symbolError ? "border-red-500" : "border-white/10"
    )}
    placeholder="AAPL"
    disabled={disabled}
    aria-invalid={!!symbolError}
    aria-describedby={symbolError ? "symbol-error" : undefined}
  />
</FormField>
```

**Validation Rules to Add:**
- Symbol: Required, 1-16 chars, alphanumeric
- Entry Price: If exit_price exists, entry_price required
- Exit Price: If pnl exists, exit_price required
- Position Size: Must be > 0 if provided
- Stop Loss: Must be numeric if provided
- Expiration Date: Required if contract_type is call/put
- Strike Price: Required if contract_type is call/put

**Test Cases:**
- [ ] Submit with empty symbol - shows error
- [ ] Submit with exit price but no entry - shows error
- [ ] Submit call option without strike - shows error
- [ ] Submit call option without expiry - shows error
- [ ] Error messages appear inline below fields
- [ ] Error fields highlighted with red border
- [ ] Error messages have proper aria attributes
- [ ] Errors clear when field corrected

---

### 2.7 P1.3 — Table Keyboard Navigation

**File:** `components/journal/journal-table-view.tsx`

**Add Arrow Key Navigation:**

```tsx
export function JournalTableView({ entries, onSelectEntry, ... }: JournalTableViewProps) {
  const [focusedIndex, setFocusedIndex] = useState(0)
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (entries.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setFocusedIndex((prev) => Math.min(prev + 1, entries.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusedIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'Home':
          e.preventDefault()
          setFocusedIndex(0)
          break
        case 'End':
          e.preventDefault()
          setFocusedIndex(entries.length - 1)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [entries.length])

  useEffect(() => {
    // Focus the row when index changes
    rowRefs.current[focusedIndex]?.focus()
  }, [focusedIndex])

  return (
    <table>
      <tbody>
        {entries.map((entry, index) => (
          <tr
            key={entry.id}
            ref={(el) => { rowRefs.current[index] = el }}
            tabIndex={index === focusedIndex ? 0 : -1}
            className={cn(
              '...',
              index === focusedIndex && 'ring-2 ring-emerald-500 ring-inset'
            )}
            onFocus={() => setFocusedIndex(index)}
            // ... rest
          >
        ))}
      </tbody>
    </table>
  )
}
```

**Test Cases:**
- [ ] Arrow Down moves focus to next row
- [ ] Arrow Up moves focus to previous row
- [ ] Home key jumps to first row
- [ ] End key jumps to last row
- [ ] Focused row has visible ring indicator
- [ ] Tab key still works normally
- [ ] Enter opens detail sheet
- [ ] Focus preserved after modal closes

---

### 2.8 P1.4 — Skeleton Loading States

**Files:**
- `components/ui/skeleton.tsx` (if not exists)
- `components/journal/journal-table-skeleton.tsx` (new)
- `components/journal/journal-card-skeleton.tsx` (new)

**Table Skeleton:**

```tsx
export function JournalTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="glass-card-heavy rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-white/[0.04]">
              {/* Same header structure as real table */}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="border-b border-white/[0.04]">
                <td className="px-4 py-3">
                  <div className="h-4 w-16 animate-pulse rounded bg-white/10" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-5 w-12 animate-pulse rounded bg-white/10" />
                </td>
                {/* ... more skeleton cells ... */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

**Usage in page:**

```tsx
{loading ? (
  filters.view === 'cards' ? (
    <JournalCardSkeleton cards={6} />
  ) : (
    <JournalTableSkeleton rows={10} />
  )
) : entries.length === 0 ? (
  // ... empty state
) : (
  // ... real data
)}
```

**Test Cases:**
- [ ] Skeleton shows on initial load
- [ ] Skeleton matches real table/card structure
- [ ] Animation is smooth (CSS only, no JS)
- [ ] Skeleton rows = expected data count
- [ ] Transition from skeleton to real data is smooth

---

### 2.9 P1.5 — Delete Modal Focus Trap

**Files:**
- `components/journal/delete-confirmation-modal.tsx` (extract to new component)
- `app/members/journal/page.tsx` (use new component)

**Extract Delete Modal:**

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useFocusTrap } from '@/hooks/use-focus-trap'

interface DeleteConfirmationModalProps {
  entry: { symbol: string; trade_date: string; pnl: number | null }
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  busy?: boolean
}

export function DeleteConfirmationModal({
  entry,
  onConfirm,
  onCancel,
  busy = false,
}: DeleteConfirmationModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useFocusTrap({
    active: true,
    containerRef,
    onEscape: () => {
      if (!busy) onCancel()
    },
  })

  // Focus cancel button on mount
  useEffect(() => {
    cancelButtonRef.current?.focus()
  }, [])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <div
        ref={containerRef}
        role="alertdialog"
        aria-labelledby="delete-title"
        aria-describedby="delete-description"
        className="w-full max-w-md rounded-lg border border-white/10 bg-[#111416] p-6"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-900/30">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div className="flex-1">
            <h3 id="delete-title" className="text-base font-semibold text-ivory">
              Delete trade entry?
            </h3>
            <p id="delete-description" className="mt-2 text-sm text-muted-foreground">
              {entry.symbol} ({entry.trade_date.slice(0, 10)}) with P&L{' '}
              {entry.pnl != null ? `$${entry.pnl.toFixed(2)}` : '—'} will be permanently deleted.
              This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-10 rounded-md border border-white/10 px-4 text-sm font-medium text-ivory hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="h-10 rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
          >
            {busy ? 'Deleting...' : 'Delete Trade'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Test Cases:**
- [ ] Modal captures focus on mount
- [ ] Tab cycles between Cancel and Delete only
- [ ] Escape key closes modal (when not busy)
- [ ] Cancel button focused by default
- [ ] Clicking backdrop does nothing (intentional)
- [ ] Aria attributes present
- [ ] Screen reader announces alert dialog
- [ ] Works with keyboard only (no mouse)

---

## 3. Test Plan

### 3.1 Unit Tests

**New Test Files:**
- `components/journal/__tests__/screenshot-upload-zone.test.tsx`
- `components/journal/__tests__/ai-grade-display.test.tsx`
- `components/journal/__tests__/delete-confirmation-modal.test.tsx`

**Coverage Requirements:**
- Screenshot upload: file validation, size limits, type checking
- AI grade display: all grade levels render correctly
- Delete modal: focus trap, escape handler, busy state

### 3.2 Integration Tests

**API Endpoint Tests:**
- Screenshot upload flow (get URL → upload → verify)
- AI grading flow (submit → receive → update entry)

### 3.3 E2E Tests (Playwright)

**Critical Paths:**

```typescript
// tests/e2e/journal/mobile-form.spec.ts
test('mobile: can complete full entry form with keyboard open', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE
  await page.goto('/members/journal')
  await page.click('text=New Entry')

  // Fill form fields
  await page.fill('[placeholder="AAPL"]', 'TSLA')
  // ... fill more fields

  // Verify Save button is reachable
  const saveButton = page.locator('button:has-text("Save")')
  await expect(saveButton).toBeInViewport()

  // Simulate keyboard opening (reduce viewport height)
  await page.setViewportSize({ width: 375, height: 350 })

  // Verify form still scrollable and Save button reachable
  await saveButton.scrollIntoViewIfNeeded()
  await expect(saveButton).toBeInViewport()
  await saveButton.click()
})

// tests/e2e/journal/screenshot-upload.spec.ts
test('can upload screenshot via drag and drop', async ({ page }) => {
  await page.goto('/members/journal')
  await page.click('text=New Entry')
  await page.click('text=Full Form')
  await page.click('text=Screenshot')

  // Simulate file drop
  const filePath = path.join(__dirname, 'fixtures', 'test-screenshot.png')
  const buffer = await fs.promises.readFile(filePath)
  const dataTransfer = await page.evaluateHandle((data) => {
    const dt = new DataTransfer()
    const file = new File([new Uint8Array(data)], 'screenshot.png', { type: 'image/png' })
    dt.items.add(file)
    return dt
  }, [...buffer])

  await page.dispatchEvent('[role="dialog"] label', 'drop', { dataTransfer })

  // Verify preview shows
  await expect(page.locator('img[alt="Trade screenshot"]')).toBeVisible()

  // Save entry
  await page.click('button:has-text("Save")')

  // Verify screenshot persists
  await page.click('table tr:first-child')
  await expect(page.locator('img[alt="Trade screenshot"]')).toBeVisible()
})

// tests/e2e/journal/ai-grading.spec.ts
test('can grade trade and view analysis', async ({ page }) => {
  // Prerequisite: entry exists
  await page.goto('/members/journal')
  await page.click('table tr:first-child')

  // Click grade button
  await page.click('button:has-text("Grade Trade")')

  // Wait for grading to complete
  await expect(page.locator('text=Grading...')).toBeHidden({ timeout: 15000 })

  // Verify grade display
  await expect(page.locator('text=AI Trade Grade')).toBeVisible()
  await expect(page.locator('text=Entry Quality')).toBeVisible()
  await expect(page.locator('text=Exit Quality')).toBeVisible()
  await expect(page.locator('text=Risk Management')).toBeVisible()
})

// tests/e2e/journal/keyboard-nav.spec.ts
test('table: keyboard navigation with arrow keys', async ({ page }) => {
  await page.goto('/members/journal')

  // Focus first row
  await page.focus('table tbody tr:first-child')

  // Arrow down to second row
  await page.keyboard.press('ArrowDown')

  // Verify focus moved
  await expect(page.locator('table tbody tr:nth-child(2)')).toBeFocused()

  // Arrow up back to first
  await page.keyboard.press('ArrowUp')
  await expect(page.locator('table tbody tr:first-child')).toBeFocused()

  // Home key
  await page.keyboard.press('End')
  await expect(page.locator('table tbody tr:last-child')).toBeFocused()

  // Open detail with Enter
  await page.keyboard.press('Enter')
  await expect(page.locator('[role="dialog"]')).toBeVisible()
})

// tests/e2e/journal/delete-modal.spec.ts
test('delete modal: focus trap and keyboard controls', async ({ page }) => {
  await page.goto('/members/journal')

  // Open delete modal
  await page.click('table tr:first-child button[aria-label*="Delete"]')

  // Verify modal open
  await expect(page.locator('[role="alertdialog"]')).toBeVisible()

  // Verify Cancel button focused
  await expect(page.locator('button:has-text("Cancel")')).toBeFocused()

  // Tab to Delete button
  await page.keyboard.press('Tab')
  await expect(page.locator('button:has-text("Delete Trade")')).toBeFocused()

  // Tab wraps back to Cancel
  await page.keyboard.press('Tab')
  await expect(page.locator('button:has-text("Cancel")')).toBeFocused()

  // Escape closes
  await page.keyboard.press('Escape')
  await expect(page.locator('[role="alertdialog"]')).toBeHidden()
})

// tests/e2e/journal/responsive-filters.spec.ts
test.describe('filters: responsive layout', () => {
  test('mobile: filters stack vertically', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/members/journal')

    // Verify single column layout
    const grid = page.locator('.grid').first()
    const gridCols = await grid.evaluate((el) =>
      window.getComputedStyle(el).gridTemplateColumns.split(' ').length
    )
    expect(gridCols).toBe(1)
  })

  test('tablet: filters show 3 columns', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/members/journal')

    const grid = page.locator('.grid').first()
    const gridCols = await grid.evaluate((el) =>
      window.getComputedStyle(el).gridTemplateColumns.split(' ').length
    )
    expect(gridCols).toBe(3)
  })

  test('desktop: filters show 6 columns', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/members/journal')

    const grid = page.locator('.grid').first()
    const gridCols = await grid.evaluate((el) =>
      window.getComputedStyle(el).gridTemplateColumns.split(' ').length
    )
    expect(gridCols).toBe(6)
  })
})
```

### 3.4 Accessibility Audit

**WCAG Compliance Checklist:**

- [ ] **1.1.1 Non-text Content (Level A)**
  - All images have alt text
  - Icons have aria-labels
  - Screenshot upload zone has proper labels

- [ ] **1.3.1 Info and Relationships (Level A)**
  - Form fields have labels
  - Headings properly structured
  - Table headers properly marked

- [ ] **1.4.3 Contrast (Level AA)**
  - Text colors meet 4.5:1 ratio
  - Form borders visible
  - Error messages readable

- [ ] **2.1.1 Keyboard (Level A)**
  - All interactive elements reachable
  - Tab order logical
  - No keyboard traps (except intentional focus traps)

- [ ] **2.1.2 No Keyboard Trap (Level A)**
  - Modals can be escaped with Escape key
  - Focus traps properly implemented

- [ ] **2.4.3 Focus Order (Level A)**
  - Tab order matches visual order
  - Focus moves logically through form sections

- [ ] **2.4.7 Focus Visible (Level AA)**
  - All focusable elements have visible focus indicator
  - Focus ring on table rows
  - Focus outline on form inputs

- [ ] **3.2.2 On Input (Level A)**
  - No unexpected context changes on form input
  - Form submission requires explicit action

- [ ] **3.3.1 Error Identification (Level A)**
  - Form errors clearly identified
  - Error messages associated with fields
  - Required fields marked

- [ ] **3.3.2 Labels or Instructions (Level A)**
  - All form fields have labels
  - Required fields indicated
  - Format instructions provided

- [ ] **4.1.2 Name, Role, Value (Level A)**
  - All custom components have proper ARIA
  - Modals use role="dialog" or role="alertdialog"
  - Buttons have accessible names

- [ ] **4.1.3 Status Messages (Level AA)**
  - Loading states announced
  - Success/error messages announced
  - Form submission feedback provided

**Tools:**
- Run axe DevTools on all pages
- Test with screen reader (VoiceOver on macOS, NVDA on Windows)
- Test keyboard-only navigation
- Test with 200% zoom
- Test with Windows High Contrast mode

---

## 4. Documentation Updates

### 4.1 Component Documentation

Create/update JSDoc comments:

```tsx
/**
 * ScreenshotUploadZone - Drag & drop file upload for trade screenshots
 *
 * Features:
 * - Drag and drop support
 * - Click to upload
 * - File validation (type, size)
 * - Preview after upload
 * - Remove uploaded file
 * - Accessible with keyboard
 *
 * @example
 * <ScreenshotUploadZone
 *   currentScreenshotUrl={entry.screenshot_url}
 *   onUploadComplete={(url, path) => {
 *     updateEntry({ screenshot_url: url, screenshot_storage_path: path })
 *   }}
 *   onRemove={() => updateEntry({ screenshot_url: null })}
 * />
 */
```

### 4.2 Update Implementation Status

**File:** `docs/trade-journal/TRADE_JOURNAL_IMPLEMENTATION_STATUS.md`

Add:

```markdown
## V2.1 Production Hardening (2026-02-10)

- [x] P0.1: Fixed modal scrolling on mobile devices
- [x] P0.2: Fixed filter bar responsive layout
- [x] P0.3: Added screenshot upload UI with drag & drop
- [x] P0.4: Added AI grading UI with button trigger
- [x] P1.1: Reorganized full entry form into 6 logical sections
- [x] P1.2: Added comprehensive form field validation feedback
- [x] P1.3: Implemented keyboard navigation for table view
- [x] P1.4: Replaced text loading states with skeleton loaders
- [x] P1.5: Added focus trap to delete confirmation modal
- [x] E2E test suite coverage: 95%+
- [x] WCAG 2.1 AA compliance verified
- [x] Mobile tested on iPhone SE, 12 Pro, 14 Pro Max, Samsung Galaxy S21
- [x] Tablet tested on iPad Air, iPad Pro
```

### 4.3 Update README

Add to `README.md` or journal-specific README:

```markdown
## Trade Journal Features

### Entry Management
- ✅ Quick and full entry forms
- ✅ Screenshot upload with drag & drop
- ✅ AI-powered trade grading
- ✅ Mobile-optimized forms
- ✅ Keyboard navigation support

### Analytics & Filtering
- ✅ Advanced performance metrics
- ✅ Multi-dimensional filtering
- ✅ Table and card views
- ✅ Responsive on all devices

### Accessibility
- ✅ WCAG 2.1 AA compliant
- ✅ Full keyboard support
- ✅ Screen reader compatible
- ✅ Focus management
```

---

## 5. Implementation Checklist

### Phase 1: P0 Fixes (Critical)
- [ ] 2.1: Fix modal scrolling (sticky header/footer)
- [ ] 2.2: Fix filter bar responsive grid
- [ ] 2.3: Implement screenshot upload component (in entry form)
- [ ] 2.4: Implement quick screenshot entry (main page - KILLER FEATURE)
- [ ] 2.5: Implement AI grading UI
- [ ] Test P0 fixes on all devices
- [ ] Deploy to staging

### Phase 2: P1 Enhancements (High Priority)
- [ ] 2.5: Reorganize full entry form sections
- [ ] 2.6: Add form validation feedback
- [ ] 2.7: Add table keyboard navigation
- [ ] 2.8: Add skeleton loading states
- [ ] 2.9: Extract and enhance delete modal
- [ ] Test P1 fixes
- [ ] Update documentation

### Phase 3: Testing & Validation
- [ ] Write unit tests for new components
- [ ] Write E2E tests for all flows
- [ ] Run accessibility audit
- [ ] Cross-browser testing
- [ ] Mobile device testing
- [ ] Performance testing

### Phase 4: Documentation & Deployment
- [ ] Update component documentation
- [ ] Update implementation status
- [ ] Update README
- [ ] Code review
- [ ] Deploy to production
- [ ] Monitor error rates

---

## 6. Success Metrics

### Pre-Launch Validation
- [ ] All P0 tests pass
- [ ] All P1 tests pass
- [ ] E2E test suite: 95%+ pass rate
- [ ] Lighthouse accessibility score: 95+
- [ ] axe DevTools: 0 violations
- [ ] Mobile Safari: no layout issues
- [ ] Chrome Android: no layout issues

### Post-Launch Metrics
- User can complete form on iPhone SE: >95% success rate
- Modal scroll issues: 0 reported bugs
- Screenshot upload success rate: >90%
- AI grading completion rate: >85%
- Filter usage on tablet: >50% increase

---

## 7. Rollback Plan

If critical issues found after deployment:

1. **Immediate:** Feature flag to hide screenshot upload / AI grading
2. **Quick:** Revert modal CSS changes (if blocking)
3. **Full:** Rollback entire deployment to previous version

**Rollback Triggers:**
- >10% error rate on journal page
- >5% of users unable to save entries
- Critical accessibility regression
- Data loss reported

---

## 8. Timeline

**Estimated Total: 12-16 hours**

- Phase 1 (P0): 6-8 hours
- Phase 2 (P1): 4-6 hours
- Phase 3 (Testing): 2-3 hours
- Phase 4 (Docs): 1 hour

**Target Completion:** Within 2 days of starting implementation

---

**END OF SPEC**
