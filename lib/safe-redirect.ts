/**
 * Validates and sanitizes redirect URLs to prevent open redirect vulnerabilities.
 * Only allows relative paths within the same origin.
 */

// Whitelist of allowed redirect path prefixes
const ALLOWED_PREFIXES = ['/members', '/admin', '/login', '/join-discord', '/']

/**
 * Validates a redirect URL and returns a safe version.
 * @param redirect - The redirect URL to validate
 * @param defaultPath - Default path if validation fails (default: '/members')
 * @returns A safe redirect path
 */
export function getSafeRedirect(redirect: string | null, defaultPath = '/members'): string {
  // If no redirect provided, use default
  if (!redirect) {
    return defaultPath
  }

  // Trim whitespace
  const trimmed = redirect.trim()

  // Must start with / (relative path)
  if (!trimmed.startsWith('/')) {
    console.warn(`Blocked redirect to non-relative path: ${redirect}`)
    return defaultPath
  }

  // Block protocol-relative URLs (//evil.com)
  if (trimmed.startsWith('//')) {
    console.warn(`Blocked redirect to protocol-relative URL: ${redirect}`)
    return defaultPath
  }

  // Block URLs with @ (user:pass@host)
  if (trimmed.includes('@')) {
    console.warn(`Blocked redirect with credentials: ${redirect}`)
    return defaultPath
  }

  // Block URLs with backslash (can be used to bypass checks)
  if (trimmed.includes('\\')) {
    console.warn(`Blocked redirect with backslash: ${redirect}`)
    return defaultPath
  }

  // Block URLs with encoded characters that could bypass checks
  // Decode and re-check
  try {
    const decoded = decodeURIComponent(trimmed)
    if (decoded !== trimmed) {
      // Contains encoded chars - decode and validate again
      if (decoded.startsWith('//') || decoded.includes('@') || decoded.includes('\\')) {
        console.warn(`Blocked redirect with encoded bypass: ${redirect}`)
        return defaultPath
      }
    }
  } catch {
    // Invalid encoding, reject
    console.warn(`Blocked redirect with invalid encoding: ${redirect}`)
    return defaultPath
  }

  // Check against allowed prefixes (optional strictness)
  const isAllowed = ALLOWED_PREFIXES.some(prefix =>
    trimmed === prefix || trimmed.startsWith(prefix + '/') || trimmed.startsWith(prefix + '?')
  )

  if (!isAllowed) {
    console.warn(`Blocked redirect to non-whitelisted path: ${redirect}`)
    return defaultPath
  }

  return trimmed
}

/**
 * Checks if a redirect URL is safe (for use in conditionals)
 */
export function isValidRedirect(redirect: string | null): boolean {
  if (!redirect) return false
  return getSafeRedirect(redirect, '__INVALID__') !== '__INVALID__'
}
