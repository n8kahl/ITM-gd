/**
 * Sanitize user/AI-generated content to prevent XSS attacks.
 * Strips HTML tags, script content, and dangerous patterns.
 */
export function sanitizeContent(input: string): string {
  if (typeof input !== 'string') return '';

  return input
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove event handler attributes
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove javascript: protocol
    .replace(/javascript\s*:/gi, '')
    // Remove data: protocol for dangerous types
    .replace(/data\s*:\s*(?:text\/html|application\/javascript)/gi, '')
    // Strip HTML tags but preserve content
    .replace(/<\/?[^>]+(>|$)/g, '');
}

/**
 * Validate and sanitize a UUID string
 */
export function sanitizeUUID(input: string): string | null {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(input) ? input : null;
}

/**
 * Sanitize a symbol string (SPX, NDX, etc.)
 */
export function sanitizeSymbol(input: string): string | null {
  const symbolRegex = /^[A-Z]{1,10}$/;
  const upper = input?.toUpperCase()?.trim();
  return symbolRegex.test(upper) ? upper : null;
}
