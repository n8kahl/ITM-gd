import { NextResponse } from 'next/server'
import { buildLivenessPayload } from './health-check'

export const dynamic = 'force-dynamic'

export async function GET() {
  const payload = buildLivenessPayload()
  return NextResponse.json(payload, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
