import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { errorResponse, successResponse } from '@/lib/api/response'
import { isAdminUser } from '@/lib/supabase-server'
import type { JournalEntry } from '@/lib/types/journal'
import { sanitizeJournalEntries } from '@/lib/journal/sanitize-entry'
import { coachBrowseParamsSchema } from '@/lib/validation/coach-review'

interface MemberProfileRow {
  user_id: string
  display_name: string | null
}

interface DiscordProfileRow {
  user_id: string
  discord_username: string | null
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
    const parsedQuery = coachBrowseParamsSchema.parse({
      symbol: searchParams.get('symbol') ?? undefined,
      direction: searchParams.get('direction') ?? undefined,
      contractType: searchParams.get('contractType') ?? undefined,
      memberId: searchParams.get('memberId') ?? undefined,
      memberSearch: searchParams.get('memberSearch') ?? undefined,
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      hasCoachNote: searchParams.get('hasCoachNote') ?? undefined,
      sortBy: searchParams.get('sortBy') ?? undefined,
      sortDir: searchParams.get('sortDir') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    })

    const supabase = getSupabaseAdmin()
    const memberSearchTerm = parsedQuery.memberSearch?.trim()

    let query = supabase
      .from('journal_entries')
      .select('*', { count: 'exact' })

    if (parsedQuery.symbol) {
      query = query.ilike('symbol', `%${parsedQuery.symbol.toUpperCase()}%`)
    }
    if (parsedQuery.direction !== 'all') {
      query = query.eq('direction', parsedQuery.direction)
    }
    if (parsedQuery.contractType !== 'all') {
      query = query.eq('contract_type', parsedQuery.contractType)
    }
    if (parsedQuery.memberId) {
      query = query.eq('user_id', parsedQuery.memberId)
    }
    if (memberSearchTerm) {
      const [memberProfilesByName, discordProfilesByName] = await Promise.all([
        supabase
          .from('member_profiles')
          .select('user_id')
          .ilike('display_name', `%${memberSearchTerm}%`)
          .limit(200),
        supabase
          .from('user_discord_profiles')
          .select('user_id')
          .ilike('discord_username', `%${memberSearchTerm}%`)
          .limit(200),
      ])

      const matchedUserIds = Array.from(new Set([
        ...(memberProfilesByName.data ?? []).map((row) => row.user_id as string),
        ...(discordProfilesByName.data ?? []).map((row) => row.user_id as string),
      ]))

      if (matchedUserIds.length === 0) {
        return successResponse([], { total: 0 })
      }

      query = query.in('user_id', matchedUserIds)
    }
    if (parsedQuery.startDate) {
      query = query.gte('trade_date', parsedQuery.startDate)
    }
    if (parsedQuery.endDate) {
      query = query.lte('trade_date', parsedQuery.endDate)
    }

    let excludeCoachNoteEntryIds = new Set<string>()

    if (parsedQuery.hasCoachNote !== undefined) {
      const { data: noteRows, error: noteQueryError } = await supabase
        .from('coach_trade_notes')
        .select('journal_entry_id')

      if (noteQueryError) {
        console.error('[TradeReview][Browse] Failed to query coach note entry ids:', noteQueryError.message)
        return errorResponse('Failed to load coach-note filters', 500)
      }

      const noteEntryIds = Array.from(new Set((noteRows ?? []).map((row) => row.journal_entry_id)))
      if (parsedQuery.hasCoachNote) {
        if (noteEntryIds.length === 0) {
          return successResponse([], { total: 0 })
        }
        query = query.in('id', noteEntryIds)
      } else if (noteEntryIds.length > 0) {
        excludeCoachNoteEntryIds = new Set(noteEntryIds)
      }
    }

    const { data: rows, error, count } = await query
      .order(parsedQuery.sortBy, { ascending: parsedQuery.sortDir === 'asc' })
      .range(parsedQuery.offset, parsedQuery.offset + parsedQuery.limit - 1)

    if (error) {
      console.error('[TradeReview][Browse] Failed to load journal rows:', error.message)
      return errorResponse('Failed to load journal entries', 500)
    }

    const entries = sanitizeJournalEntries(rows ?? [])
    const userIds = Array.from(new Set(entries.map((entry) => entry.user_id)))

    const [memberProfilesResult, discordProfilesResult] = await Promise.all([
      supabase
        .from('member_profiles')
        .select('user_id,display_name')
        .in('user_id', userIds),
      supabase
        .from('user_discord_profiles')
        .select('user_id,discord_username')
        .in('user_id', userIds),
    ])

    const memberProfiles = (memberProfilesResult.data ?? []) as MemberProfileRow[]
    const discordProfiles = (discordProfilesResult.data ?? []) as DiscordProfileRow[]
    const displayNameByUserId = new Map<string, string | null>()
    const discordNameByUserId = new Map<string, string | null>()

    for (const row of memberProfiles) displayNameByUserId.set(row.user_id, row.display_name)
    for (const row of discordProfiles) discordNameByUserId.set(row.user_id, row.discord_username)

    const browseRows = entries.map((entry) => ({
      ...entry,
      member_display_name: displayNameByUserId.get(entry.user_id)
        || discordNameByUserId.get(entry.user_id)
        || `User ${entry.user_id.slice(0, 8)}`,
    }))

    const coachFilteredRows = excludeCoachNoteEntryIds.size > 0
      ? browseRows.filter((entry) => !excludeCoachNoteEntryIds.has(entry.id))
      : browseRows

    return successResponse(coachFilteredRows as Array<JournalEntry & { member_display_name: string }>, {
      total: count ?? coachFilteredRows.length,
    })
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(error.message, 400)
    }
    return errorResponse('Internal server error', 500)
  }
}
