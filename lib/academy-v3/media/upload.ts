import { SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'academy-assets'

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const ALLOWED_VIDEO_TYPES = ['video/mp4']
const MAX_IMAGE_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024 // 500MB

export interface UploadResult {
  path: string
  publicUrl: string
}

export interface UploadError {
  message: string
}

/**
 * Upload an image file to the academy-assets bucket.
 */
export async function uploadAcademyImage(
  supabase: SupabaseClient,
  file: File | Blob,
  storagePath: string,
  contentType?: string,
): Promise<UploadResult> {
  const mimeType = contentType ?? (file instanceof File ? file.type : 'image/png')

  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    throw new Error(`Invalid image type: ${mimeType}. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`)
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(`Image too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 50MB`)
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: mimeType,
      upsert: true,
    })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath)

  return {
    path: storagePath,
    publicUrl: urlData.publicUrl,
  }
}

/**
 * Upload a video file to the academy-assets bucket.
 */
export async function uploadAcademyVideo(
  supabase: SupabaseClient,
  file: File | Blob,
  storagePath: string,
  contentType?: string,
): Promise<UploadResult> {
  const mimeType = contentType ?? (file instanceof File ? file.type : 'video/mp4')

  if (!ALLOWED_VIDEO_TYPES.includes(mimeType)) {
    throw new Error(`Invalid video type: ${mimeType}. Allowed: ${ALLOWED_VIDEO_TYPES.join(', ')}`)
  }

  if (file.size > MAX_VIDEO_SIZE) {
    throw new Error(`Video too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: 500MB`)
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: mimeType,
      upsert: true,
    })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath)

  return {
    path: storagePath,
    publicUrl: urlData.publicUrl,
  }
}

/**
 * Delete a file from the academy-assets bucket.
 */
export async function deleteAcademyAsset(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath])

  if (error) {
    throw new Error(`Delete failed: ${error.message}`)
  }
}

/**
 * List files in a folder within the academy-assets bucket.
 */
export async function listAcademyAssets(
  supabase: SupabaseClient,
  folder: string,
): Promise<Array<{ name: string; size: number; createdAt: string; mimeType: string }>> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(folder, { sortBy: { column: 'created_at', order: 'desc' } })

  if (error) {
    throw new Error(`List failed: ${error.message}`)
  }

  return (data ?? [])
    .filter(item => item.name !== '.emptyFolderPlaceholder')
    .map(item => ({
      name: item.name,
      size: item.metadata?.size ?? 0,
      createdAt: item.created_at ?? '',
      mimeType: item.metadata?.mimetype ?? 'unknown',
    }))
}
