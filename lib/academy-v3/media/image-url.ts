/**
 * Academy image URL utility for Supabase Storage with image transformations.
 *
 * Generates optimized image URLs from the academy-assets bucket.
 * Supabase supports width, height, quality, and format transformations
 * on public bucket objects via query parameters.
 */

interface ImageUrlOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'webp' | 'png' | 'jpg'
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const BUCKET = 'academy-assets'

/**
 * Build an optimized image URL for an academy asset.
 *
 * @param path - Path within the academy-assets bucket (e.g. "modules/spx-day-trading/cover.png")
 * @param opts - Optional image transformation parameters
 * @returns Full URL to the optimized image
 *
 * @example
 * academyImageUrl('modules/spx-day-trading/cover.png', { width: 800, quality: 75, format: 'webp' })
 * // => "https://<project>.supabase.co/storage/v1/object/public/academy-assets/modules/spx-day-trading/cover.png?width=800&quality=75&format=webp"
 */
export function academyImageUrl(path: string, opts?: ImageUrlOptions): string {
  const base = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
  if (!opts) return base

  const params = new URLSearchParams()
  if (opts.width) params.set('width', String(opts.width))
  if (opts.height) params.set('height', String(opts.height))
  if (opts.quality) params.set('quality', String(opts.quality))
  if (opts.format) params.set('format', opts.format)

  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

/**
 * Build the storage path for a module cover image.
 */
export function moduleCoverPath(moduleSlug: string, ext = 'png'): string {
  return `modules/${moduleSlug}/cover.${ext}`
}

/**
 * Build the storage path for a lesson hero image.
 */
export function lessonHeroPath(lessonId: string, ext = 'png'): string {
  return `lessons/${lessonId}/hero.${ext}`
}

/**
 * Build the storage path for a lesson block inline image.
 */
export function lessonBlockImagePath(lessonId: string, blockId: string, index: number, ext = 'png'): string {
  return `lessons/${lessonId}/blocks/${blockId}-${index}.${ext}`
}

/**
 * Build the storage path for an achievement badge icon.
 */
export function achievementIconPath(achievementKey: string): string {
  return `achievements/${achievementKey}.png`
}

/**
 * Build the storage path for a video file.
 */
export function lessonVideoPath(lessonId: string, blockId: string): string {
  return `videos/${lessonId}/${blockId}.mp4`
}
