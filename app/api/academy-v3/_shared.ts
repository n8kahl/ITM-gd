import { NextResponse } from 'next/server'

import type { ApiErrorResponse } from '@/lib/academy-v3/contracts/api'

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
