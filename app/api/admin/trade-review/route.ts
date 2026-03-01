import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api/response'
import { isAdminUser } from '@/lib/supabase-server'
import type { CoachReviewQueueItem } from '@/lib/types/coach-review'
import { coachQueueParamsSchema } from '@/lib/validation/coach-review'

interface JournalEntryRow {
  id: string
  user_id: string
  symbol: string
  direction: 'long' | 'short'
  contract_type: 'stock' | 'call' | 'put'
  trade_date: string
  pnl: number | null
  pnl_percentage: number | null
  is_winner: boolean | null
  entry_price: number | null
  exit_price: number | null
  screenshot_url: string | null
}

interface ReviewRequestRow {
  id: string
  journal_entry_id: string
  user_id: string
  status: 'pending' | 'in_review' | 'completed' | 'dismissed'
  priority: 'normal' | 'urgent'
  assigned_to: string | null
  requested_at: string
  claimed_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  journal_entries: JournalEntryRow | null
}

interface CoachTradeNoteRow {
  journal_entry_id: string
  ai_draft: Record<string, unknown> | null
  coach_response: Record<string, unknown> | null
  is_published: boolean
}

interface MemberProfileRow {
  user_id: string
  display_name: string | null
}

interface DiscordProfileRow {
  user_id: string
  discord_username: string | null
  discord_avatar: string | null
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export async function GET(request: NextRequest) {
  if (!await isAdminUser()) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const { searchParams } = new URL(request.url)
    const parsedQuery = coachQueueParamsSchema.parse({
      status: searchParams.get('status') ?? undefined,
      priority: searchParams.get('priority') ?? undefined,
      symbol: searchParams.get('symbol') ?? undefined,
      member: searchParams.get('member') ?? undefined,
      sortBy: searchParams.get('sortBy') ?? undefined,
      sortDir: searchParams.get('sortDir') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    })

    const supabase = getSupabaseAdmin()

    let memberUserIds: string[] | null = null
    const memberFilterTerm = parsedQuery.member?.trim()
    if (memberFilterTerm) {
      const [memberProfilesByName, discordProfilesByName] = await Promise.all([
        supabase
          .from('member_profiles')
          .select('user_id')
          .ilike('display_name', `%${memberFilterTerm}%`)
          .limit(200),
        supabase
          .from('user_discord_profiles')
          .select('user_id')
          .ilike('discord_username', `%${memberFilterTerm}%`)
          .limit(200),
      ])

      memberUserIds = Array.from(new Set([
        ...(memberProfilesByName.data ?? []).map((row) => row.user_id as string),
        ...(discordProfilesByName.data ?? []).map((row) => row.user_id as string),
      ]))

      if (memberUserIds.length === 0) {
        return successResponse([], { total: 0 })
      }
    }

    let query = supabase
      .from('coach_review_requests')
      .select(`
        id,
        journal_entry_id,
        user_id,
        status,
        priority,
        assigned_to,
        requested_at,
        claimed_at,
        completed_at,
        created_at,
        updated_at,
        journal_entries!inner (
          id,
          user_id,
          symbol,
          direction,
          contract_type,
          trade_date,
          pnl,
          pnl_percentage,
          is_winner,
          entry_price,
          exit_price,
          screenshot_url
        )
      `, { count: 'exact' })

    if (memberUserIds) {
      query = query.in('user_id', memberUserIds)
    }
    if (parsedQuery.status !== 'all') {
      query = query.eq('status', parsedQuery.status)
    }
    if (parsedQuery.priority !== 'all') {
      query = query.eq('priority', parsedQuery.priority)
    }
    if (parsedQuery.symbol) {
      query = query.ilike('journal_entries.symbol', `%${parsedQuery.symbol.toUpperCase()}%`)
    }

    if (parsedQuery.sortBy === 'trade_date') {
      query = query.order('trade_date', { ascending: parsedQuery.sortDir === 'asc', referencedTable: 'journal_entries' })
    } else if (parsedQuery.sortBy === 'pnl') {
      query = query.order('pnl', { ascending: parsedQuery.sortDir === 'asc', referencedTable: 'journal_entries' })
    } else {
      query = query.order('requested_at', { ascending: parsedQuery.sortDir === 'asc' })
    }

    const { data, error, count } = await query.range(
      parsedQuery.offset,
      parsedQuery.offset + parsedQuery.limit - 1,
    )

    if (error) {
      console.error('[TradeReview][Queue] Failed to load queue rows:', error.message)
      return errorResponse('Failed to load review queue', 500)
    }

    const rows = (data ?? []) as unknown as ReviewRequestRow[]
    const userIds = Array.from(new Set(rows.map((row) => row.user_id)))
    const journalEntryIds = Array.from(new Set(rows.map((row) => row.journal_entry_id)))

    const [memberProfilesResult, discordProfilesResult, notesResult] = await Promise.all([
      userIds.length > 0
        ? supabase
          .from('member_profiles')
          .select('user_id,display_name')
          .in('user_id', userIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length > 0
        ? supabase
          .from('user_discord_profiles')
          .select('user_id,discord_username,discord_avatar')
          .in('user_id', userIds)
        : Promise.resolve({ data: [], error: null }),
      journalEntryIds.length > 0
        ? supabase
          .from('coach_trade_notes')
          .select('journal_entry_id,ai_draft,coach_response,is_published')
          .in('journal_entry_id', journalEntryIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    const memberProfiles = (memberProfilesResult.data ?? []) as MemberProfileRow[]
    const discordProfiles = (discordProfilesResult.data ?? []) as DiscordProfileRow[]
    const noteRows = (notesResult.data ?? []) as CoachTradeNoteRow[]

    const displayNameByUserId = new Map<string, string | null>()
    for (const row of memberProfiles) displayNameByUserId.set(row.user_id, row.display_name)

    const discordByUserId = new Map<string, DiscordProfileRow>()
    for (const row of discordProfiles) discordByUserId.set(row.user_id, row)

    const noteStateByEntryId = new Map<string, { hasDraft: boolean; hasPublished: boolean }>()
    for (const row of noteRows) {
      const existing = noteStateByEntryId.get(row.journal_entry_id) ?? { hasDraft: false, hasPublished: false }
      existing.hasDraft = existing.hasDraft || row.ai_draft != null || row.coach_response != null
      existing.hasPublished = existing.hasPublished || row.is_published === true
      noteStateByEntryId.set(row.journal_entry_id, existing)
    }

    const queueItems = rows
      .map((row): CoachReviewQueueItem | null => {
        if (!row.journal_entries) return null
        const memberMeta = discordByUserId.get(row.user_id)
        const noteState = noteStateByEntryId.get(row.journal_entry_id)
        return {
          id: row.id,
          journal_entry_id: row.journal_entry_id,
          user_id: row.user_id,
          status: row.status,
          priority: row.priority,
          assigned_to: row.assigned_to,
          requested_at: row.requested_at,
          claimed_at: row.claimed_at,
          completed_at: row.completed_at,
          created_at: row.created_at,
          updated_at: row.updated_at,
          symbol: row.journal_entries.symbol,
          direction: row.journal_entries.direction,
          contract_type: row.journal_entries.contract_type,
          trade_date: row.journal_entries.trade_date,
          pnl: row.journal_entries.pnl,
          pnl_percentage: row.journal_entries.pnl_percentage,
          is_winner: row.journal_entries.is_winner,
          entry_price: row.journal_entries.entry_price,
          exit_price: row.journal_entries.exit_price,
          screenshot_url: row.journal_entries.screenshot_url,
          member_display_name: displayNameByUserId.get(row.user_id)
            || memberMeta?.discord_username
            || `User ${row.user_id.slice(0, 8)}`,
          member_avatar_url: memberMeta?.discord_avatar ?? null,
          member_discord_username: memberMeta?.discord_username ?? null,
          has_draft: noteState?.hasDraft ?? false,
          has_published_note: noteState?.hasPublished ?? false,
        }
      })
      .filter((item): item is CoachReviewQueueItem => Boolean(item))

    return successResponse(queueItems, {
      total: count ?? queueItems.length,
    })
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, 400)
    }
    return errorResponse('Internal server error', 500)
  }
}
