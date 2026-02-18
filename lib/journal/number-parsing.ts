export interface ParsedNumericInput {
  value: number | null
  valid: boolean
}

/**
 * Parse user-entered numeric text with tolerant handling for:
 * - currency symbols ($, €, £, ¥)
 * - thousands separators (",")
 * - decimal commas ("12,34" -> 12.34)
 */
export function parseNumericInput(input: unknown): ParsedNumericInput {
  if (input === null || input === undefined) {
    return { value: null, valid: true }
  }

  if (typeof input === 'number') {
    return Number.isFinite(input)
      ? { value: input, valid: true }
      : { value: null, valid: false }
  }

  if (typeof input !== 'string') {
    return { value: null, valid: false }
  }

  const trimmed = input.trim()
  if (trimmed.length === 0) {
    return { value: null, valid: true }
  }

  let normalized = trimmed
    .replace(/\s+/g, '')
    .replace(/[$€£¥]/g, '')
    .replace(/[%]/g, '')

  const isParenthesizedNegative = normalized.startsWith('(') && normalized.endsWith(')')
  if (isParenthesizedNegative) {
    normalized = normalized.slice(1, -1)
  }

  // If both separators exist, assume commas are thousands separators.
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/,/g, '')
  } else if (normalized.includes(',') && !normalized.includes('.')) {
    const commaParts = normalized.split(',')
    const looksLikeThousandsGrouping = (
      commaParts.length > 2
      || (commaParts.length === 2 && commaParts[1].length === 3 && commaParts[0].length >= 1)
    )

    if (looksLikeThousandsGrouping) {
      normalized = normalized.replace(/,/g, '')
    } else {
      // Locale decimal comma.
      normalized = normalized.replace(/,/g, '.')
    }
  }

  if (!/^[+-]?\d*(\.\d+)?$/.test(normalized)) {
    return { value: null, valid: false }
  }

  const parsed = Number(normalized) * (isParenthesizedNegative ? -1 : 1)
  return Number.isFinite(parsed)
    ? { value: parsed, valid: true }
    : { value: null, valid: false }
}
