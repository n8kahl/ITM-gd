import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * Public endpoint: returns tab configurations ordered by sort_order.
 * Used by MemberAuthContext to dynamically render sidebar tabs.
 * Cached with 5-minute revalidation.
 */

type TabConfigRecord = {
  tab_id: string
  label: string
  icon: string
  path: string
  required_tier: 'core' | 'pro' | 'executive' | 'admin'
  sort_order: number
  is_required: boolean
  mobile_visible: boolean
  is_active: boolean
  badge_text?: string
  badge_variant?: string
  description?: string
  [key: string]: unknown
}

const TRADE_DAY_REPLAY_TAB: TabConfigRecord = {
  tab_id: 'trade-day-replay',
  label: 'Trade Day Replay',
  icon: 'Play',
  path: '/members/trade-day-replay',
  required_tier: 'admin',
  sort_order: 8,
  is_required: false,
  mobile_visible: true,
  is_active: true,
  description: 'Replay and analyze a full trade day from transcript + market data',
}

// Default fallback if database is unavailable
const DEFAULT_TABS: TabConfigRecord[] = [
  { tab_id: 'dashboard', label: 'Command Center', icon: 'LayoutDashboard', path: '/members', required_tier: 'core', sort_order: 0, is_required: true, mobile_visible: true, is_active: true },
  { tab_id: 'journal', label: 'Trade Journal', icon: 'BookOpen', path: '/members/journal', required_tier: 'core', sort_order: 1, is_required: false, mobile_visible: true, is_active: true },
  { tab_id: 'spx-command-center', label: 'SPX Command Center', icon: 'Target', path: '/members/spx-command-center', required_tier: 'pro', sort_order: 3, is_required: false, mobile_visible: true, is_active: true, badge_text: 'LIVE', badge_variant: 'emerald' },
  { tab_id: 'ai-coach', label: 'AI Coach', icon: 'Bot', path: '/members/ai-coach', required_tier: 'pro', sort_order: 4, is_required: false, mobile_visible: true, is_active: true, badge_text: 'Beta', badge_variant: 'emerald' },
  { tab_id: 'library', label: 'Academy', icon: 'GraduationCap', path: '/members/academy', required_tier: 'core', sort_order: 5, is_required: false, mobile_visible: false, is_active: true },
  { tab_id: 'social', label: 'Social', icon: 'Users', path: '/members/social', required_tier: 'core', sort_order: 6, is_required: false, mobile_visible: true, is_active: true },
  { tab_id: 'studio', label: 'Trade Studio', icon: 'Palette', path: '/members/studio', required_tier: 'executive', sort_order: 7, is_required: false, mobile_visible: false, is_active: true },
  TRADE_DAY_REPLAY_TAB,
  { tab_id: 'profile', label: 'Profile', icon: 'UserCircle', path: '/members/profile', required_tier: 'core', sort_order: 99, is_required: true, mobile_visible: true, is_active: true },
]

type DynamicTabRecord = Record<string, unknown> & {
  tab_id?: unknown
  sort_order?: unknown
  is_active?: unknown
}

function hasReplayTab(rows: DynamicTabRecord[]): boolean {
  return rows.some((row) => String(row.tab_id || '') === 'trade-day-replay')
}

function sortBySortOrder<T extends { sort_order?: unknown }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aSort = Number(a.sort_order ?? 0)
    const bSort = Number(b.sort_order ?? 0)
    return aSort - bSort
  })
}

function ensureReplayTabInActiveRows(allRows: DynamicTabRecord[], activeRows: DynamicTabRecord[]): DynamicTabRecord[] {
  if (hasReplayTab(allRows)) {
    return activeRows
  }
  return [...activeRows, TRADE_DAY_REPLAY_TAB]
}

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({
        success: true,
        data: DEFAULT_TABS,
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const { data: tabs, error } = await supabase
      .from('tab_configurations')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error || !tabs?.length) {
      return NextResponse.json({
        success: true,
        data: sortBySortOrder(DEFAULT_TABS),
      })
    }

    const allRows = (tabs || []) as DynamicTabRecord[]
    const activeRows = allRows.filter((row) => row.is_active !== false)
    const rowsWithReplay = ensureReplayTabInActiveRows(allRows, activeRows)

    return NextResponse.json({
      success: true,
      data: sortBySortOrder(rowsWithReplay),
    }, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error fetching tab configurations:', error)
    return NextResponse.json({
      success: true,
      data: sortBySortOrder(DEFAULT_TABS),
    })
  }
}
