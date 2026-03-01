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

type SignedUploadDestination = {
  uploadUrl: string
  storagePath: string
}

async function getSignedUploadDestination(file: File): Promise<SignedUploadDestination> {
  const res = await fetch('/api/members/journal/screenshot-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
    }),
  })

  const payload = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(payload?.error || `Failed to get upload URL (${res.status})`)
  }

  const uploadUrl = payload?.data?.uploadUrl
    ?? payload?.uploadUrl
    // Backward-compatible fallback for older mocks/handlers.
    ?? payload?.data?.signedUrl
    ?? payload?.signedUrl
  const storagePath = payload?.data?.storagePath
    ?? payload?.storagePath

  if (typeof uploadUrl !== 'string' || uploadUrl.length === 0) {
    throw new Error('Upload URL response was missing uploadUrl')
  }

  if (typeof storagePath !== 'string' || storagePath.length === 0) {
    throw new Error('Upload URL response was missing storagePath')
  }

  return { uploadUrl, storagePath }
}

async function uploadViaSignedUrl(
  file: File,
): Promise<{ storagePath: string; url: string }> {
  const { uploadUrl, storagePath } = await getSignedUploadDestination(file)

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  })

  if (!uploadResponse.ok) {
    throw new Error(`Upload failed (${uploadResponse.status})`)
  }

  const url = await getSignedUrl(storagePath)
  return { storagePath, url }
}

async function uploadViaClientStorage(
  file: File,
  userId: string,
  entryId?: string,
): Promise<{ storagePath: string; url: string }> {
  const supabase = createBrowserSupabase()
  const storagePath = buildStoragePath(userId, file, entryId)

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    })

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`)
  }

  const url = await getSignedUrl(storagePath)
  return { storagePath, url }
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
  try {
    let uploadResult: { storagePath: string; url: string } | null = null
    try {
      // Prefer server-signed upload URLs to avoid client-side RLS/session drift.
      uploadResult = await uploadViaSignedUrl(file)
    } catch {
      // Fallback for older environments/tests where signed upload URL is unavailable.
      uploadResult = await uploadViaClientStorage(file, userId, entryId)
    }

    onProgress?.({ status: 'uploading', percent: 100 })

    const result: UploadProgress = {
      status: 'complete',
      percent: 100,
      url: uploadResult.url,
      storagePath: uploadResult.storagePath,
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
 * The server uses the service role to generate a short-lived signed URL.
 */
async function getSignedUrl(storagePath: string): Promise<string> {
  const res = await fetch('/api/members/journal/screenshot-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storagePath }),
  })

  const payload = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(payload?.error || `Failed to get signed URL (${res.status})`)
  }

  const signedUrl = payload?.data?.signedUrl
    ?? payload?.signedUrl
    ?? payload?.data?.url
    ?? payload?.url

  if (typeof signedUrl !== 'string' || signedUrl.length === 0) {
    throw new Error('Signed URL response was missing signedUrl')
  }

  return signedUrl
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
