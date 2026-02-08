import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key)
}

async function requireAdmin(): Promise<{ authorized: boolean; userId?: string }> {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { authorized: false }
  const isAdmin = user.app_metadata?.is_admin === true
  return { authorized: isAdmin, userId: user.id }
}

/**
 * GET /api/admin/tabs — Fetch all tab configurations (admin-only)
 */
export async function GET() {
  try {
    const { authorized } = await requireAdmin()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
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
    const { authorized, userId } = await requireAdmin()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Admin access required' } },
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

    // Log admin activity
    if (userId) {
      await supabase.from('admin_activity_log').insert({
        admin_user_id: userId,
        action: 'update_tab_configurations',
        target_type: 'tab_config',
        details: { tabs_updated: tabs.map((t: { tab_id: string }) => t.tab_id) },
      })
    }

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
