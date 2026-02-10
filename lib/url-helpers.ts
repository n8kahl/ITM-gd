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

  // Prefer proxy-provided protocol when present.
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const normalizedProto = forwardedProto === 'http' || forwardedProto === 'https'
    ? forwardedProto
    : null

  // Local dev/test hosts should be http.
  const hostLower = host.toLowerCase()
  const isLoopbackHost =
    hostLower.includes('localhost') ||
    hostLower.startsWith('127.0.0.1') ||
    hostLower.startsWith('0.0.0.0') ||
    hostLower.startsWith('[::1]') ||
    hostLower.startsWith('::1')

  const protocol = normalizedProto || (isLoopbackHost ? 'http' : 'https')

  return new URL(path, `${protocol}://${host}`)
}
