import { createClient } from '@supabase/supabase-js'

const STORAGE_BUCKET = 'trade-cards'
const PUBLIC_URL_MARKERS = [
  `/storage/v1/object/public/${STORAGE_BUCKET}/`,
  `/object/public/${STORAGE_BUCKET}/`,
]

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function uploadTradeCardToStorage(
  pngBuffer: Buffer,
  uploadPath: string
): Promise<string> {
  const supabase = getSupabaseAdmin()

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(uploadPath, pngBuffer, {
      contentType: 'image/png',
      cacheControl: '3600',
      upsert: true,
    })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(uploadPath)

  return urlData.publicUrl
}

export function extractTradeCardStoragePath(imageUrlOrPath: string): string | null {
  const trimmed = imageUrlOrPath?.trim()
  if (!trimmed) return null

  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return trimmed.replace(/^\/+/, '')
  }

  for (const marker of PUBLIC_URL_MARKERS) {
    const markerIndex = trimmed.indexOf(marker)
    if (markerIndex === -1) continue

    const encodedPath = trimmed.slice(markerIndex + marker.length)
    if (!encodedPath) return null
    return decodeURIComponent(encodedPath)
  }

  return null
}

export async function deleteTradeCardFromStorage(
  imageUrlOrPath: string,
): Promise<void> {
  const storagePath = extractTradeCardStoragePath(imageUrlOrPath)
  if (!storagePath) return

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])

  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`)
  }
}
