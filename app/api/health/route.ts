import { NextResponse } from 'next/server'

/**
 * Public health check endpoint for Railway zero-downtime deployments.
 * Railway hits this endpoint to verify the new deployment is ready
 * before switching traffic from the old instance.
 *
 * This route is NOT matched by middleware (no auth required).
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  )
}
