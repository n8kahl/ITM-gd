import { NextRequest, NextResponse } from 'next/server'
import { getRequestUserId } from '@/lib/api/member-auth'

export async function POST(request: NextRequest) {
  const userId = await getRequestUserId(request)
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    success: true,
    data: {
      created: 0,
      sessionsScanned: 0,
      message: 'Auto-generated draft trades have been retired.',
    },
  })
}

