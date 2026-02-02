import { NextRequest } from 'next/server'

/**
 * Helper to construct absolute URLs safely using the correct origin.
 * Fixes Railway proxy issues where request.url may have the wrong origin.
 *
 * @param path - The path to append (e.g., '/login', '/admin')
 * @param request - The Next.js request object
 * @returns A URL object with the correct origin
 */
export function getAbsoluteUrl(path: string, request: NextRequest): URL {
  // Use the host header if available (set by Railway proxy)
  const host = request.headers.get('host') || new URL(request.url).host

  // Determine protocol: use https in production, http for localhost
  const protocol = host.includes('localhost') ? 'http' : 'https'

  return new URL(path, `${protocol}://${host}`)
}
