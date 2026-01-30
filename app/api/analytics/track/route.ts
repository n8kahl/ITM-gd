import { NextRequest, NextResponse } from 'next/server'
import { trackPageView, trackClick, trackConversion, upsertSession } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, data } = body

    switch (type) {
      case 'page_view':
        await trackPageView(data)
        break

      case 'click':
        await trackClick(data)
        break

      case 'conversion':
        await trackConversion(data)
        break

      case 'session':
        await upsertSession(data)
        break

      default:
        return NextResponse.json(
          { error: 'Invalid tracking type' },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Analytics tracking error:', error)
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    )
  }
}
