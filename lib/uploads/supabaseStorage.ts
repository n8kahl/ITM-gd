import { createBrowserSupabase } from '@/lib/supabase-browser'

const BUCKET = 'journal-screenshots'
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export interface UploadProgress {
  status: 'validating' | 'uploading' | 'complete' | 'error'
  /** 0-100 for uploading, undefined otherwise */
  percent?: number
  /** Public or signed URL of the uploaded file */
  url?: string
  /** Storage path for DB reference */
  storagePath?: string
  /** Error message if status === 'error' */
  error?: string
}

/**
 * Validate file before upload.
 * Throws a user-friendly error string on failure.
 */
function validateFile(file: File): void {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`File type "${file.type}" is not allowed. Use PNG, JPG, or WebP.`)
  }
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    throw new Error(`File is ${sizeMB}MB. Maximum allowed size is 5MB.`)
  }
}

/**
 * Build a unique, collision-free storage path.
 * Format: {userId}/{entryId|"new"}/{timestamp}-{random}.{ext}
 */
function buildStoragePath(userId: string, file: File, entryId?: string): string {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  const folder = entryId || 'new'
  return `${userId}/${folder}/${timestamp}-${random}.${ext}`
}

/**
 * Upload a screenshot file to Supabase Storage.
 *
 * @param file      The File to upload
 * @param userId    Authenticated user's ID (for path namespacing)
 * @param entryId   Optional journal entry ID (for path namespacing)
 * @param onProgress Callback for status updates
 * @returns         The final UploadProgress with url and storagePath
 */
export async function uploadScreenshot(
  file: File,
  userId: string,
  entryId?: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadProgress> {
  // --- Validate ---
  onProgress?.({ status: 'validating' })
  try {
    validateFile(file)
  } catch (err) {
    const result: UploadProgress = {
      status: 'error',
      error: err instanceof Error ? err.message : 'Validation failed',
    }
    onProgress?.(result)
    return result
  }

  // --- Upload ---
  onProgress?.({ status: 'uploading', percent: 0 })
  const supabase = createBrowserSupabase()
  const storagePath = buildStoragePath(userId, file, entryId)

  try {
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      })

    if (uploadError) {
      const result: UploadProgress = {
        status: 'error',
        error: `Upload failed: ${uploadError.message}`,
      }
      onProgress?.(result)
      return result
    }

    onProgress?.({ status: 'uploading', percent: 100 })

    // --- Get signed URL from server (private bucket) ---
    const signedUrl = await getSignedUrl(storagePath)

    const result: UploadProgress = {
      status: 'complete',
      percent: 100,
      url: signedUrl,
      storagePath,
    }
    onProgress?.(result)
    return result
  } catch (err) {
    const result: UploadProgress = {
      status: 'error',
      error: err instanceof Error ? err.message : 'Upload failed unexpectedly',
    }
    onProgress?.(result)
    return result
  }
}

/**
 * Request a signed URL from our server-side API route.
 * The server uses the service role to generate a long-lived signed URL.
 */
async function getSignedUrl(storagePath: string): Promise<string> {
  const res = await fetch('/api/members/journal/screenshot-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storagePath }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Failed to get signed URL (${res.status})`)
  }

  const data = await res.json()
  return data.signedUrl
}

/**
 * Delete a screenshot from storage (cleanup on entry delete or re-upload).
 */
export async function deleteScreenshot(storagePath: string): Promise<void> {
  const supabase = createBrowserSupabase()
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath])
  if (error) {
    console.error('Failed to delete screenshot:', error.message)
  }
}
