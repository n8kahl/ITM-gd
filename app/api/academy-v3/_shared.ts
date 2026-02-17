import { NextResponse } from 'next/server'

import type { ApiErrorResponse } from '@/lib/academy-v3/contracts/api'

/** Structured error logger for Academy V3 API routes */
export function logAcademyError(
  route: string,
  code: string,
  error: unknown,
  meta?: Record<string, unknown>
): void {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  console.error(
    JSON.stringify({
      service: 'academy-v3',
      route,
      code,
      message,
      stack,
      timestamp: new Date().toISOString(),
      ...meta,
    })
  )
}

/** Max request body size (100KB) to prevent oversized payloads */
export const MAX_BODY_SIZE = 100 * 1024

/** Validate that a request body does not exceed the size limit */
export async function parseBodySafe<T>(
  request: Request,
  maxSize = MAX_BODY_SIZE
): Promise<T | null> {
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    return null
  }

  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}

export function academyV3ErrorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details,
      },
    },
    { status }
  )
}
