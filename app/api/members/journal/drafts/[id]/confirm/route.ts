import { NextRequest, NextResponse } from 'next/server'
import { getRequestUserId } from '@/lib/api/member-auth'

export async function POST(request: NextRequest) {
  const userId = await getRequestUserId(request)
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json(
    { success: false, error: 'Draft entries are disabled and no longer supported.' },
    { status: 410 },
  )
}

