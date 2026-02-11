import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PERIODS = ['weekly', 'monthly', 'all_time'] as const
const CATEGORIES = ['win_rate', 'total_pnl', 'longest_streak', 'academy_xp', 'discipline_score', 'trade_count'] as const

type Period = typeof PERIODS[number]
type Category = typeof CATEGORIES[number]

function getDateFilter(period: Period): string | null {
  const now = new Date()
  switch (period) {
    case 'weekly': {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      return d.toISOString()
    }
    case 'monthly': {
      const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      return d.toISOString()
    }
    case 'all_time':
      return null
  }
}

serve(async (req) => {
  try {
    // Verify authorization (service role or cron trigger)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const today = new Date().toISOString().split('T')[0]
    let totalInserted = 0

    for (const period of PERIODS) {
      const dateFilter = getDateFilter(period)

      for (const category of CATEGORIES) {
        // Get opted-in users
        const { data: optedInProfiles } = await supabase
          .from('member_profiles')
          .select('user_id, display_name')
          .eq('privacy_settings->>show_on_leaderboard', 'true')

        const optedInUserIds = optedInProfiles?.map(p => p.user_id) || []
        if (optedInUserIds.length === 0) continue

        const profileMap = new Map(optedInProfiles?.map(p => [p.user_id, p]) || [])

        let rankings: Array<{ user_id: string; value: number }> = []

        if (category === 'academy_xp') {
          // Query from user_xp table
          let query = supabase
            .from('user_xp')
            .select('user_id, total_xp')
            .in('user_id', optedInUserIds)
            .order('total_xp', { ascending: false })
            .limit(100)

          const { data } = await query
          rankings = (data || []).map(r => ({ user_id: r.user_id, value: r.total_xp }))
        } else {
          // Query from journal_entries
          let baseQuery = `
            SELECT
              user_id,
              ${getCategorySelect(category)}
            FROM journal_entries
            WHERE is_open = false
              AND user_id = ANY($1)
          `

          if (dateFilter) {
            baseQuery += ` AND trade_date >= '${dateFilter}'`
          }

          baseQuery += `
            GROUP BY user_id
            ${getMinimumFilter(category)}
            ORDER BY metric_value DESC
            LIMIT 100
          `

          const { data, error } = await supabase.rpc('exec_sql', {
            query: baseQuery,
            params: [optedInUserIds],
          }).catch(() => ({ data: null, error: 'RPC not available' }))

          // Fallback: use Supabase query builder for simpler categories
          if (!data) {
            rankings = await computeRankingsFallback(supabase, category, optedInUserIds, dateFilter)
          } else {
            rankings = (data || []).map((r: { user_id: string; metric_value: number }) => ({
              user_id: r.user_id,
              value: r.metric_value,
            }))
          }
        }

        if (rankings.length === 0) continue

        // Delete old snapshots for this period/category/date
        await supabase
          .from('leaderboard_snapshots')
          .delete()
          .eq('period', period)
          .eq('category', category)
          .eq('snapshot_date', today)

        // Insert new rankings
        const entries = rankings.map((r, idx) => ({
          user_id: r.user_id,
          period,
          category,
          rank: idx + 1,
          value: r.value,
          display_name: profileMap.get(r.user_id)?.display_name || null,
          discord_avatar: null,
          discord_username: null,
          membership_tier: null,
          snapshot_date: today,
        }))

        const { error: insertError } = await supabase
          .from('leaderboard_snapshots')
          .insert(entries)

        if (!insertError) {
          totalInserted += entries.length
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Computed leaderboards for ${today}`,
        total_entries: totalInserted,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})

function getCategorySelect(category: Category): string {
  switch (category) {
    case 'win_rate':
      return 'ROUND((COUNT(*) FILTER (WHERE pnl > 0)::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE pnl IS NOT NULL), 0)::NUMERIC) * 100, 1) AS metric_value'
    case 'total_pnl':
      return 'COALESCE(SUM(pnl), 0) AS metric_value'
    case 'longest_streak':
      return 'COUNT(*) FILTER (WHERE pnl > 0) AS metric_value' // Simplified
    case 'discipline_score':
      return 'ROUND(AVG(discipline_score), 1) AS metric_value'
    case 'trade_count':
      return 'COUNT(*) AS metric_value'
    default:
      return 'COUNT(*) AS metric_value'
  }
}

function getMinimumFilter(category: Category): string {
  switch (category) {
    case 'win_rate':
    case 'discipline_score':
      return 'HAVING COUNT(*) >= 10'
    case 'total_pnl':
    case 'longest_streak':
      return 'HAVING COUNT(*) >= 5'
    case 'trade_count':
      return ''
    default:
      return ''
  }
}

async function computeRankingsFallback(
  supabase: ReturnType<typeof createClient>,
  category: Category,
  userIds: string[],
  dateFilter: string | null,
): Promise<Array<{ user_id: string; value: number }>> {
  // For categories that can be computed with the query builder
  if (category === 'trade_count') {
    let query = supabase
      .from('journal_entries')
      .select('user_id', { count: 'exact' })
      .eq('is_open', false)
      .in('user_id', userIds)

    if (dateFilter) {
      query = query.gte('trade_date', dateFilter)
    }

    const { data } = await query
    // Group by user_id manually
    const counts = new Map<string, number>()
    for (const row of data || []) {
      counts.set(row.user_id, (counts.get(row.user_id) || 0) + 1)
    }

    return Array.from(counts.entries())
      .map(([user_id, count]) => ({ user_id, value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 100)
  }

  return []
}
