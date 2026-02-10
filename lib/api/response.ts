import { NextResponse } from 'next/server'

export interface ApiSuccessResponse<T> {
  success: true
  data: T
  meta?: Record<string, unknown>
}

export interface ApiErrorResponse {
  success: false
  error: string
  details?: unknown
}

/**
 * Build a standardized JSON success response payload.
 */
export function successResponse<T>(
  data: T,
  meta?: Record<string, unknown>,
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(meta ? { success: true, data, meta } : { success: true, data })
}

/**
 * Build a standardized JSON error response payload.
 */
export function errorResponse(
  message: string,
  status = 500,
  details?: unknown,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    details ? { success: false, error: message, details } : { success: false, error: message },
    { status },
  )
}
