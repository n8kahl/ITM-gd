import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUserFromRequest } from '@/lib/request-auth'
import { toSafeErrorMessage } from '@/lib/academy/api-utils'

function parseLimit(value: string | null): number {
  if (!value) return 5
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 5
  return Math.max(1, Math.min(20, Math.round(parsed)))
}

/**
 * GET /api/academy/insights
 * Query params:
 * - limit: number (default 5)
 * - type: optional insight type filter
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { user, supabase } = auth
    const { searchParams } = new URL(request.url)
    const limit = parseLimit(searchParams.get('limit'))
    const type = searchParams.get('type')
    const nowMs = Date.now()

    let query = supabase
      .from('user_learning_insights')
      .select(`
        id,
        insight_type,
        insight_data,
        source_entity_id,
        source_entity_type,
        is_dismissed,
        is_acted_on,
        created_at,
        expires_at
      `)
      .eq('user_id', user.id)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })
      .limit(limit * 2)

    if (type) {
      query = query.eq('insight_type', type)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to load insights' }, { status: 500 })
    }

    const activeItems = (data || []).filter((item) => {
      if (!item.expires_at) return true
      const expiresMs = new Date(item.expires_at).getTime()
      return Number.isFinite(expiresMs) && expiresMs > nowMs
    }).slice(0, limit)

    return NextResponse.json({
      success: true,
      data: {
        items: activeItems,
      },
    })
  } catch (error) {
    console.error('academy insights get failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/academy/insights
 * Body:
 * - id: string
 * - is_dismissed?: boolean
 * - is_acted_on?: boolean
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUserFromRequest(request)
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { user, supabase } = auth
    const { searchParams } = new URL(request.url)
    const body = await request.json().catch(() => ({}))

    const insightId =
      (typeof body?.id === 'string' && body.id) ||
      searchParams.get('id')

    if (!insightId) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
    }

    const patch: { is_dismissed?: boolean; is_acted_on?: boolean } = {}
    if (typeof body?.is_dismissed === 'boolean') {
      patch.is_dismissed = body.is_dismissed
    }
    if (typeof body?.is_acted_on === 'boolean') {
      patch.is_acted_on = body.is_acted_on
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No patchable fields provided' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('user_learning_insights')
      .update(patch)
      .eq('id', insightId)
      .eq('user_id', user.id)
      .select(`
        id,
        insight_type,
        insight_data,
        source_entity_id,
        source_entity_type,
        is_dismissed,
        is_acted_on,
        created_at,
        expires_at
      `)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: 'Insight not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error) {
    console.error('academy insights patch failed', error)
    return NextResponse.json(
      { success: false, error: toSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
