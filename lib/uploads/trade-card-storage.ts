import { createClient } from '@supabase/supabase-js'

const STORAGE_BUCKET = 'trade-cards'

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
