import { NextResponse } from 'next/server'
import { buildHealthPayload } from '../health-check'

export const dynamic = 'force-dynamic'

export async function GET() {
  const payload = await buildHealthPayload()

  return NextResponse.json(payload, {
    status: payload.status === 'degraded' ? 503 : 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
