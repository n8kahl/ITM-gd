// ============================================
// CENTRALIZED FORMATTING UTILITIES
// ============================================

// ============================================
// Currency Formatting
// ============================================

/**
 * Format a number as USD currency
 * @param amount - The amount to format
 * @param options - Formatting options
 */
export function formatUSD(
  amount: number,
  options: {
    showCents?: boolean
    showSign?: boolean
    compact?: boolean
  } = {}
): string {
  const { showCents = true, showSign = false, compact = false } = options

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
    notation: compact ? 'compact' : 'standard',
    signDisplay: showSign ? 'always' : 'auto',
  })

  return formatter.format(amount)
}

/**
 * Format a price string (already includes $ or needs it)
 * Normalizes price strings to consistent format
 */
export function formatPrice(price: string | number): string {
  if (typeof price === 'number') {
    return formatUSD(price, { showCents: false })
  }

  // If it's already a formatted string, just return it
  if (price.startsWith('$')) {
    return price
  }

  // Try to parse and format
  const numericPrice = parseFloat(price.replace(/[^0-9.-]/g, ''))
  if (!isNaN(numericPrice)) {
    return formatUSD(numericPrice, { showCents: false })
  }

  return price
}

/**
 * Format a number as a percentage
 */
export function formatPercent(
  value: number,
  options: {
    decimals?: number
    showSign?: boolean
  } = {}
): string {
  const { decimals = 1, showSign = false } = options

  const formatted = value.toFixed(decimals) + '%'

  if (showSign && value > 0) {
    return '+' + formatted
  }

  return formatted
}

/**
 * Format profit/loss with color indicator
 * Returns an object with formatted value and whether it's positive
 */
export function formatPL(amount: number): { formatted: string; isPositive: boolean } {
  const isPositive = amount >= 0
  const formatted = (isPositive ? '+' : '') + formatUSD(amount, { showCents: true })
  return { formatted, isPositive }
}

// ============================================
// Date Formatting
// ============================================

/**
 * Format a date string or Date object to a human-readable format
 */
export function formatDate(
  date: string | Date | null | undefined,
  options: {
    format?: 'short' | 'medium' | 'long' | 'relative'
    includeTime?: boolean
  } = {}
): string {
  if (!date) return '—'

  const { format = 'medium', includeTime = false } = options
  const dateObj = typeof date === 'string' ? new Date(date) : date

  if (isNaN(dateObj.getTime())) return '—'

  // Relative time (e.g., "2 hours ago")
  if (format === 'relative') {
    return formatRelativeTime(dateObj)
  }

  const formatOptions: Intl.DateTimeFormatOptions = {
    year: format === 'short' ? '2-digit' : 'numeric',
    month: format === 'long' ? 'long' : format === 'short' ? 'numeric' : 'short',
    day: 'numeric',
  }

  if (includeTime) {
    formatOptions.hour = 'numeric'
    formatOptions.minute = '2-digit'
  }

  return dateObj.toLocaleDateString('en-US', formatOptions)
}

/**
 * Format a date as relative time (e.g., "2 hours ago", "yesterday")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHr / 24)

  if (diffSec < 60) {
    return 'just now'
  } else if (diffMin < 60) {
    return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`
  } else if (diffHr < 24) {
    return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`
  } else if (diffDays === 1) {
    return 'yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`
  } else {
    return formatDate(date, { format: 'short' })
  }
}

/**
 * Format a date for display in tables/admin panels
 */
export function formatTableDate(date: string | Date | null | undefined): string {
  return formatDate(date, { format: 'short', includeTime: true })
}

/**
 * Format a date for ISO string (YYYY-MM-DD)
 */
export function formatISODate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Format a datetime for display
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  return formatDate(date, { format: 'medium', includeTime: true })
}

// ============================================
// Number Formatting
// ============================================

/**
 * Format a number with commas
 */
export function formatNumber(
  value: number,
  options: {
    decimals?: number
    compact?: boolean
  } = {}
): string {
  const { decimals = 0, compact = false } = options

  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    notation: compact ? 'compact' : 'standard',
  })

  return formatter.format(value)
}

/**
 * Format a large number in compact form (e.g., 1.2K, 3.4M)
 */
export function formatCompactNumber(value: number): string {
  return formatNumber(value, { compact: true })
}

// ============================================
// Duration Formatting
// ============================================

/**
 * Format minutes as hours and minutes (e.g., "2h 30m")
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || minutes === 0) return '—'

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

/**
 * Format seconds as mm:ss
 */
export function formatSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// ============================================
// Text Formatting
// ============================================

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Truncate URL for display
 */
export function truncateUrl(url: string | null | undefined, maxLength = 40): string {
  if (!url) return '—'
  if (url.length <= maxLength) return url
  return url.substring(0, maxLength) + '...'
}

/**
 * Capitalize first letter of each word
 */
export function capitalizeWords(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
