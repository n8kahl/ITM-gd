const MAX_USER_MESSAGE_CHARS = 8_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

function normalizeBase64(payload: string): string {
  const trimmed = payload.replace(/\s+/g, '');
  const missingPadding = trimmed.length % 4;
  if (missingPadding === 0) return trimmed;
  return trimmed.padEnd(trimmed.length + (4 - missingPadding), '=');
}

function detectMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a) {
    return 'image/png';
  }

  if (buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (buffer.length >= 6) {
    const header = buffer.subarray(0, 6).toString('ascii');
    if (header === 'GIF87a' || header === 'GIF89a') {
      return 'image/gif';
    }
  }

  if (buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }

  return null;
}

/**
 * Sanitizes a user-provided chat message before it is sent to OpenAI.
 */
export function sanitizeUserMessage(text: string): string {
  const source = typeof text === 'string' ? text : '';
  const withoutControlChars = source
    .replace(/[\u0000-\u0008\u000B-\u001F]/g, '')
    .replace(/\r\n?/g, '\n');

  const collapsedWhitespace = withoutControlChars
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return collapsedWhitespace.slice(0, MAX_USER_MESSAGE_CHARS);
}

/**
 * Validates base64 image payloads for OpenAI Vision calls.
 */
export function validateImagePayload(base64: string): boolean {
  if (typeof base64 !== 'string' || base64.trim().length === 0) {
    return false;
  }

  const dataUrlMatch = base64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  const declaredMimeType = dataUrlMatch?.[1]?.toLowerCase() ?? null;
  const rawPayload = dataUrlMatch?.[2] ?? base64;

  if (declaredMimeType && !ALLOWED_IMAGE_MIME_TYPES.has(declaredMimeType)) {
    return false;
  }

  const normalized = normalizeBase64(rawPayload);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    return false;
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(normalized, 'base64');
  } catch {
    return false;
  }

  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    return false;
  }

  const detectedMimeType = detectMimeType(buffer);
  if (!detectedMimeType || !ALLOWED_IMAGE_MIME_TYPES.has(detectedMimeType)) {
    return false;
  }

  if (declaredMimeType && declaredMimeType !== detectedMimeType) {
    return false;
  }

  return true;
}
