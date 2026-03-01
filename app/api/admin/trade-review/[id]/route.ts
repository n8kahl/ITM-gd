import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse } from '@/lib/api/response'
import { isAdminUser } from '@/lib/supabase-server'
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
  [key: string]: unknown
}

interface ReviewRequestWithAssignment {
  id: string
  status: 'pending' | 'in_review' | 'completed' | 'dismissed'
  assigned_to: string | null
  [key: string]: unknown
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
        .select('*')
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
        .select('*')
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

          if (signedError || !signed?.signedUrl) return null
          return signed.signedUrl
        }))

        coachNoteWithSignedScreenshots = {
          ...coachNote,
          screenshot_urls: signedEntries.filter((url): url is string => Boolean(url)),
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

    const memberStats = {
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
            ...reviewRequest,
            assigned_to_name: assignedToName,
          }
        : null,
      coach_note: coachNoteWithSignedScreenshots ?? null,
      member_stats: memberStats,
      activity_log: activityResult.data ?? [],
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request', 400, error.flatten())
    }

    console.error('[TradeReview][Detail] Route failed:', error)
    return errorResponse('Internal server error', 500)
  }
}
