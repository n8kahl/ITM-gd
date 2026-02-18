import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { logAdminActivity } from '@/lib/admin/audit-log'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

async function requireAdmin(): Promise<{ authorized: boolean; userId?: string; reason?: string }> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      console.error('[Admin Tabs API] Auth error:', error.message)
      return { authorized: false, reason: 'session_expired' }
    }
    if (!user) {
      console.error('[Admin Tabs API] No user in session')
      return { authorized: false, reason: 'no_session' }
    }
    const isAdmin = user.app_metadata?.is_admin === true
    if (!isAdmin) {
      console.error('[Admin Tabs API] User is not admin:', user.id)
      return { authorized: false, reason: 'not_admin' }
    }
    return { authorized: true, userId: user.id }
  } catch (err) {
    console.error('[Admin Tabs API] requireAdmin exception:', err)
    return { authorized: false, reason: 'auth_error' }
  }
}

/**
 * GET /api/admin/tabs — Fetch all tab configurations (admin-only)
 */
export async function GET() {
  try {
    const { authorized, reason } = await requireAdmin()
    if (!authorized) {
      const message = reason === 'session_expired' || reason === 'no_session'
        ? 'Your session has expired. Please refresh the page and try again.'
        : 'Admin access required'
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message } },
        { status: 403 }
      )
    }

    const supabase = getSupabaseAdmin()
    const { data: tabs, error } = await supabase
      .from('tab_configurations')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: error.message } },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: tabs })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/tabs — Update all tab configurations (admin-only)
 * Accepts: { tabs: TabConfig[] }
 */
export async function PUT(request: NextRequest) {
  try {
    const { authorized, userId, reason } = await requireAdmin()
    if (!authorized) {
      const message = reason === 'session_expired' || reason === 'no_session'
        ? 'Your session has expired. Please refresh the page and try again.'
        : 'Admin access required'
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message } },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { tabs } = body

    if (!Array.isArray(tabs) || tabs.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'tabs array is required' } },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()

    // Upsert each tab configuration
    for (const tab of tabs) {
      const { error } = await supabase
        .from('tab_configurations')
        .upsert({
          tab_id: tab.tab_id,
          label: tab.label,
          icon: tab.icon,
          path: tab.path,
          required_tier: tab.required_tier,
          badge_text: tab.badge_text || null,
          badge_variant: tab.badge_variant || null,
          description: tab.description || null,
          mobile_visible: tab.mobile_visible ?? true,
          sort_order: tab.sort_order,
          is_required: tab.is_required ?? false,
          is_active: tab.is_active ?? true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tab_id' })

      if (error) {
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: `Failed to update tab ${tab.tab_id}: ${error.message}` } },
          { status: 500 }
        )
      }
    }

    await logAdminActivity({
      action: 'tabs_updated',
      targetType: 'tab_config',
      targetId: userId,
      details: { tabs_updated: tabs.map((t: { tab_id: string }) => t.tab_id) },
    })

    // Return updated tabs
    const { data: updatedTabs } = await supabase
      .from('tab_configurations')
      .select('*')
      .order('sort_order', { ascending: true })

    return NextResponse.json({ success: true, data: updatedTabs })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message: error instanceof Error ? error.message : 'Internal server error' } },
      { status: 500 }
    )
  }
}
