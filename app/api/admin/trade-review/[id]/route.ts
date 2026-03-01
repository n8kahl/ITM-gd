import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse } from '@/lib/api/response'
import { isAdminUser } from '@/lib/supabase-server'
import type { CoachDraftStatus, CoachMemberStats, CoachReviewActivityEntry } from '@/lib/types/coach-review'
import { getSupabaseAdmin } from '@/app/api/admin/trade-review/_shared'

const paramsSchema = z.object({
  id: z.string().uuid(),
})

interface UserTradeSummaryRow {
  symbol: string
  pnl: number | null
  discipline_score: number | null
  trade_date: string
}

interface CoachNoteWithScreenshots {
  screenshots?: unknown
  coach_response?: unknown
  ai_draft?: unknown
  is_published?: boolean
  [key: string]: unknown
}

interface ReviewRequestWithAssignment {
  id: string
  status: 'pending' | 'in_review' | 'completed' | 'dismissed'
  assigned_to: string | null
  requested_at: string
}

interface ActivityLogRow {
  id: string
  review_request_id: string | null
  journal_entry_id: string
  actor_id: string
  action: CoachReviewActivityEntry['action'] | string
  details: unknown
  created_at: string
}

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function isRenderableImageUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false
  return (
    /^https?:\/\//i.test(trimmed)
    || trimmed.startsWith('data:image/')
    || trimmed.startsWith('blob:')
    || trimmed.startsWith('/')
  )
}

function deriveRecentStreak(pnls: number[]): 'winning' | 'losing' | 'mixed' {
  if (pnls.length === 0) return 'mixed'
  const sample = pnls.slice(0, 5)
  if (sample.every((value) => value > 0)) return 'winning'
  if (sample.every((value) => value < 0)) return 'losing'
  return 'mixed'
}

function hasObjectContent(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deriveDraftStatus(note: CoachNoteWithScreenshots | null): CoachDraftStatus {
  if (!note) return 'none'
  if (note.is_published === true) return 'published'
  if (hasObjectContent(note.coach_response)) return 'manual_draft'
  if (hasObjectContent(note.ai_draft)) return 'ai_draft'
  return 'none'
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await isAdminUser()) {
    return errorResponse('Unauthorized', 401)
  }

  try {
    const parsedParams = paramsSchema.parse(await params)
    const supabase = getSupabaseAdmin()

    const { data: entry, error: entryError } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('id', parsedParams.id)
      .maybeSingle()

    if (entryError) {
      console.error('[TradeReview][Detail] Failed to load entry:', entryError.message)
      return errorResponse('Failed to load trade entry', 500)
    }

    if (!entry) {
      return errorResponse('Trade entry not found', 404)
    }

    const userId = entry.user_id as string

    const [
      memberProfileResult,
      discordProfileResult,
      reviewRequestResult,
      coachNoteResult,
      activityResult,
      tradeSummaryResult,
    ] = await Promise.all([
      supabase
        .from('member_profiles')
        .select('display_name,custom_avatar_url')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('user_discord_profiles')
        .select('discord_username,discord_avatar')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('coach_review_requests')
        .select('id,status,assigned_to,requested_at')
        .eq('journal_entry_id', parsedParams.id)
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('coach_trade_notes')
        .select('*')
        .eq('journal_entry_id', parsedParams.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('coach_review_activity_log')
        .select('id,review_request_id,journal_entry_id,actor_id,action,details,created_at')
        .eq('journal_entry_id', parsedParams.id)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('journal_entries')
        .select('symbol,pnl,discipline_score,trade_date')
        .eq('user_id', userId)
        .order('trade_date', { ascending: false })
        .limit(500),
    ])

    const memberProfile = memberProfileResult.data
    const discordProfile = discordProfileResult.data
    const reviewRequest = (reviewRequestResult.data ?? null) as ReviewRequestWithAssignment | null
    const tradeSummaryRows = (tradeSummaryResult.data ?? []) as UserTradeSummaryRow[]
    const coachNote = (coachNoteResult.data ?? null) as CoachNoteWithScreenshots | null
    const activityRows = (activityResult.data ?? []) as ActivityLogRow[]
    let assignedToName: string | null = null

    if (reviewRequest?.assigned_to) {
      const [assignedMemberProfile, assignedDiscordProfile] = await Promise.all([
        supabase
          .from('member_profiles')
          .select('display_name')
          .eq('user_id', reviewRequest.assigned_to)
          .maybeSingle(),
        supabase
          .from('user_discord_profiles')
          .select('discord_username')
          .eq('user_id', reviewRequest.assigned_to)
          .maybeSingle(),
      ])

      assignedToName = assignedMemberProfile.data?.display_name
        ?? assignedDiscordProfile.data?.discord_username
        ?? null
    }

    const actorIds = Array.from(new Set(activityRows
      .map((row) => row.actor_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)))

    const actorNameById = new Map<string, string>()
    if (actorIds.length > 0) {
      const [actorMemberProfiles, actorDiscordProfiles] = await Promise.all([
        supabase
          .from('member_profiles')
          .select('user_id,display_name')
          .in('user_id', actorIds),
        supabase
          .from('user_discord_profiles')
          .select('user_id,discord_username')
          .in('user_id', actorIds),
      ])

      const displayNameById = new Map<string, string>()
      for (const row of actorMemberProfiles.data ?? []) {
        if (row.user_id && row.display_name) {
          displayNameById.set(row.user_id, row.display_name)
        }
      }

      const discordNameById = new Map<string, string>()
      for (const row of actorDiscordProfiles.data ?? []) {
        if (row.user_id && row.discord_username) {
          discordNameById.set(row.user_id, row.discord_username)
        }
      }

      for (const actorId of actorIds) {
        const resolvedName = displayNameById.get(actorId)
          ?? discordNameById.get(actorId)
          ?? `User ${actorId.slice(0, 8)}`
        actorNameById.set(actorId, resolvedName)
      }
    }

    let coachNoteWithSignedScreenshots = coachNote
    if (coachNote && Array.isArray(coachNote.screenshots) && coachNote.screenshots.length > 0) {
      const screenshotPaths = coachNote.screenshots
        .filter((path): path is string => typeof path === 'string' && path.length > 0)

      if (screenshotPaths.length > 0) {
        const signedEntries = await Promise.all(screenshotPaths.map(async (path) => {
          const { data: signed, error: signedError } = await supabase
            .storage
            .from('coach-review-screenshots')
            .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

          if (signedError || !signed?.signedUrl) return ''
          return signed.signedUrl
        }))

        // Preserve one-to-one index alignment with `screenshots`.
        coachNoteWithSignedScreenshots = {
          ...coachNote,
          screenshot_urls: signedEntries,
        }
      }
    }

    const resolvedPnls = tradeSummaryRows
      .map((row) => row.pnl)
      .filter((value): value is number => value != null)

    const wins = resolvedPnls.filter((value) => value > 0).length
    const avgPnl = resolvedPnls.length > 0
      ? round(resolvedPnls.reduce((sum, value) => sum + value, 0) / resolvedPnls.length, 2)
      : 0

    const symbolRows = tradeSummaryRows.filter((row) => row.symbol === entry.symbol)
    const symbolPnls = symbolRows
      .map((row) => row.pnl)
      .filter((value): value is number => value != null)
    const symbolWins = symbolPnls.filter((value) => value > 0).length

    const disciplineScores = tradeSummaryRows
      .map((row) => row.discipline_score)
      .filter((value): value is number => value != null)

    const memberStats: CoachMemberStats = {
      total_trades: tradeSummaryRows.length,
      win_rate: resolvedPnls.length > 0 ? round((wins / resolvedPnls.length) * 100, 2) : 0,
      avg_pnl: avgPnl,
      symbol_stats: symbolRows.length > 0
        ? {
            win_rate: symbolPnls.length > 0 ? round((symbolWins / symbolPnls.length) * 100, 2) : 0,
            avg_pnl: symbolPnls.length > 0
              ? round(symbolPnls.reduce((sum, value) => sum + value, 0) / symbolPnls.length, 2)
              : 0,
            trade_count: symbolRows.length,
          }
        : null,
      recent_streak: deriveRecentStreak(resolvedPnls),
      avg_discipline_score: disciplineScores.length > 0
        ? round(disciplineScores.reduce((sum, value) => sum + value, 0) / disciplineScores.length, 2)
        : null,
    }

    let resolvedMemberScreenshotUrl: string | null = isRenderableImageUrl(entry.screenshot_url)
      ? entry.screenshot_url
      : null

    const screenshotCandidates = [
      entry.screenshot_storage_path,
      typeof entry.screenshot_url === 'string' ? entry.screenshot_url : null,
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

    if (!resolvedMemberScreenshotUrl && screenshotCandidates.length > 0) {
      for (const candidatePath of screenshotCandidates) {
        const { data: signedImage, error: signedImageError } = await supabase
          .storage
          .from('journal-screenshots')
          .createSignedUrl(candidatePath, SIGNED_URL_TTL_SECONDS)

        if (!signedImageError && signedImage?.signedUrl) {
          resolvedMemberScreenshotUrl = signedImage.signedUrl
          break
        }
      }
    }

    const entryWithResolvedScreenshot = {
      ...entry,
      screenshot_url: resolvedMemberScreenshotUrl,
    }

    const activityLog: CoachReviewActivityEntry[] = activityRows.map((row) => ({
      id: row.id,
      review_request_id: row.review_request_id,
      journal_entry_id: row.journal_entry_id,
      actor_id: row.actor_id,
      actor_name: actorNameById.get(row.actor_id) ?? `User ${row.actor_id.slice(0, 8)}`,
      action: row.action as CoachReviewActivityEntry['action'],
      details: typeof row.details === 'object' && row.details !== null
        ? row.details as Record<string, unknown>
        : {},
      created_at: row.created_at,
    }))

    return successResponse({
      entry: entryWithResolvedScreenshot,
      member: {
        display_name: memberProfile?.display_name
          || discordProfile?.discord_username
          || `User ${userId.slice(0, 8)}`,
        avatar_url: discordProfile?.discord_avatar ?? memberProfile?.custom_avatar_url ?? null,
        discord_username: discordProfile?.discord_username ?? null,
        tier: null,
      },
      review_request: reviewRequest
        ? {
            id: reviewRequest.id,
            status: reviewRequest.status,
            assigned_to: reviewRequest.assigned_to,
            requested_at: reviewRequest.requested_at,
            assigned_to_name: assignedToName,
          }
        : null,
      coach_note: coachNoteWithSignedScreenshots ?? null,
      draft_status: deriveDraftStatus(coachNoteWithSignedScreenshots),
      member_stats: memberStats,
      activity_log: activityLog,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request', 400, error.flatten())
    }

    console.error('[TradeReview][Detail] Route failed:', error)
    return errorResponse('Internal server error', 500)
  }
}
