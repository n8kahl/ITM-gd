import { NextRequest } from 'next/server'
import { successResponse } from '@/lib/api/response'

export async function POST(_request: NextRequest) {
  return successResponse({
    received: true,
    deprecated: true,
    ignored: true,
    message: 'Whop affiliate webhooks have been retired.',
  })
}
