import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Public endpoint: returns tab configurations ordered by sort_order.
 * Used by MemberAuthContext to dynamically render sidebar tabs.
 * Cached with 5-minute revalidation.
 */

// Default fallback if database is unavailable
const DEFAULT_TABS = [
  { tab_id: 'dashboard', label: 'Command Center', icon: 'LayoutDashboard', path: '/members', required_tier: 'core', sort_order: 0, is_required: true, mobile_visible: true, is_active: true },
  { tab_id: 'journal', label: 'Trade Journal', icon: 'BookOpen', path: '/members/journal', required_tier: 'core', sort_order: 1, is_required: false, mobile_visible: true, is_active: true },
  { tab_id: 'ai-coach', label: 'AI Coach', icon: 'Bot', path: '/members/ai-coach', required_tier: 'pro', sort_order: 2, is_required: false, mobile_visible: true, is_active: true, badge_text: 'Beta', badge_variant: 'emerald' },
  { tab_id: 'library', label: 'Training Library', icon: 'GraduationCap', path: '/members/library', required_tier: 'pro', sort_order: 3, is_required: false, mobile_visible: false, is_active: true },
  { tab_id: 'studio', label: 'Trade Studio', icon: 'Palette', path: '/members/studio', required_tier: 'executive', sort_order: 4, is_required: false, mobile_visible: false, is_active: true },
  { tab_id: 'profile', label: 'Profile', icon: 'UserCircle', path: '/members/profile', required_tier: 'core', sort_order: 99, is_required: true, mobile_visible: true, is_active: true },
]

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        success: true,
        data: DEFAULT_TABS,
      })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data: tabs, error } = await supabase
      .from('tab_configurations')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error || !tabs?.length) {
      return NextResponse.json({
        success: true,
        data: DEFAULT_TABS,
      })
    }

    return NextResponse.json({
      success: true,
      data: tabs,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    })
  } catch (error) {
    console.error('Error fetching tab configurations:', error)
    return NextResponse.json({
      success: true,
      data: DEFAULT_TABS,
    })
  }
}
