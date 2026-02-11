import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

type LeaderboardPeriod = 'weekly' | 'monthly' | 'all_time'
type LeaderboardCategory =
  | 'win_rate'
  | 'total_pnl'
  | 'longest_streak'
  | 'academy_xp'
  | 'discipline_score'
  | 'trade_count'

type MembershipTier = 'core' | 'pro' | 'executive'

interface MemberProfileRow {
  user_id: string
  display_name: string | null
  privacy_settings: unknown
}

interface DiscordProfileRow {
  user_id: string
  discord_user_id: string | null
  discord_username: string | null
  discord_avatar: string | null
  discord_roles: unknown
}

interface JournalEntryRow {
  user_id: string
  pnl: number | string | null
  trade_date: string
  discipline_score: number | string | null
  is_open: boolean
}

interface UserXpRow {
  user_id: string
  total_xp: number | string | null
}

interface UserAggregate {
  totalTrades: number
  pnlTrades: number
  winningTrades: number
  totalPnl: number
  disciplineSum: number
  disciplineCount: number
  longestWinStreak: number
}

interface LeaderboardCandidate {
  user_id: string
  value: number
}

interface DisplayMeta {
  display_name: string | null
  discord_avatar: string | null
  discord_username: string | null
  membership_tier: MembershipTier | null
}

const PERIOD_WINDOWS: Record<LeaderboardPeriod, number | null> = {
  weekly: 7,
  monthly: 30,
  all_time: null,
}

const ALL_PERIODS: LeaderboardPeriod[] = ['weekly', 'monthly', 'all_time']
const ALL_CATEGORIES: LeaderboardCategory[] = [
  'win_rate',
  'total_pnl',
  'longest_streak',
  'academy_xp',
  'discipline_score',
  'trade_count',
]

const TIER_PRIORITY: Record<MembershipTier, number> = {
  core: 1,
  pro: 2,
  executive: 3,
}

function normalizeTier(value: unknown): MembershipTier | null {
  if (value === 'core' || value === 'pro' || value === 'executive') {
    return value
  }

  if (value === 'execute') {
    return 'executive'
  }

  return null
}

function parseRoleTierMapping(rawValue: unknown): Record<string, MembershipTier> {
  if (!rawValue) return {}

  let parsed: unknown = rawValue
  if (typeof rawValue === 'string') {
    try {
      parsed = JSON.parse(rawValue)
    } catch {
      return {}
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {}
  }

  const mapping: Record<string, MembershipTier> = {}

  for (const [roleId, rawTier] of Object.entries(parsed)) {
    const normalized = normalizeTier(rawTier)
    if (normalized) {
      mapping[String(roleId)] = normalized
    }
  }

  return mapping
}

function resolveMembershipTier(
  discordRoles: string[] | null | undefined,
  roleTierMapping: Record<string, MembershipTier>,
): MembershipTier | null {
  const roles = Array.isArray(discordRoles) ? discordRoles : []
  let highestTier: MembershipTier | null = null

  for (const roleId of roles) {
    const mapped = roleTierMapping[roleId]
    if (!mapped) continue

    if (!highestTier || TIER_PRIORITY[mapped] > TIER_PRIORITY[highestTier]) {
      highestTier = mapped
    }
  }

  return highestTier
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }

  return null
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function shouldIncludeOnLeaderboard(privacySettings: unknown): boolean {
  if (!isObjectRecord(privacySettings)) {
    return true
  }

  const raw = privacySettings.show_on_leaderboard
  if (typeof raw === 'boolean') {
    return raw
  }

  return true
}

function toRoleList(discordRoles: unknown): string[] {
  if (!Array.isArray(discordRoles)) {
    return []
  }

  return discordRoles.map((role) => String(role))
}

function resolveDiscordAvatarUrl(
  avatar: string | null | undefined,
  discordUserId: string | null | undefined,
): string | null {
  if (!avatar) return null

  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar
  }

  if (!discordUserId) return null

  return `https://cdn.discordapp.com/avatars/${discordUserId}/${avatar}.png?size=128`
}

function getStartDateIso(periodDays: number | null): string | null {
  if (!periodDays) return null

  const startDate = new Date()
  startDate.setUTCDate(startDate.getUTCDate() - periodDays)
  return startDate.toISOString()
}

function buildAggregatesByUser(rows: JournalEntryRow[]): Map<string, UserAggregate> {
  const rowsByUser = new Map<string, JournalEntryRow[]>()

  for (const row of rows) {
    if (!rowsByUser.has(row.user_id)) {
      rowsByUser.set(row.user_id, [])
    }
    rowsByUser.get(row.user_id)!.push(row)
  }

  const aggregates = new Map<string, UserAggregate>()

  for (const [userId, userRows] of rowsByUser.entries()) {
    userRows.sort((left, right) => {
      return new Date(left.trade_date).getTime() - new Date(right.trade_date).getTime()
    })

    let totalTrades = 0
    let pnlTrades = 0
    let winningTrades = 0
    let totalPnl = 0
    let disciplineSum = 0
    let disciplineCount = 0
    let currentWinStreak = 0
    let longestWinStreak = 0

    for (const trade of userRows) {
      totalTrades += 1

      const pnl = toNumber(trade.pnl)
      if (pnl != null) {
        pnlTrades += 1
        totalPnl += pnl

        if (pnl > 0) {
          winningTrades += 1
          currentWinStreak += 1
          if (currentWinStreak > longestWinStreak) {
            longestWinStreak = currentWinStreak
          }
        } else {
          currentWinStreak = 0
        }
      } else {
        currentWinStreak = 0
      }

      const disciplineScore = toNumber(trade.discipline_score)
      if (disciplineScore != null) {
        disciplineSum += disciplineScore
        disciplineCount += 1
      }
    }

    aggregates.set(userId, {
      totalTrades,
      pnlTrades,
      winningTrades,
      totalPnl,
      disciplineSum,
      disciplineCount,
      longestWinStreak,
    })
  }

  return aggregates
}

function buildDisplayMetaMap(
  optedInProfiles: MemberProfileRow[],
  discordProfiles: DiscordProfileRow[],
  roleTierMapping: Record<string, MembershipTier>,
): Map<string, DisplayMeta> {
  const profileByUser = new Map<string, MemberProfileRow>()
  for (const profile of optedInProfiles) {
    profileByUser.set(profile.user_id, profile)
  }

  const discordByUser = new Map<string, DiscordProfileRow>()
  for (const discord of discordProfiles) {
    discordByUser.set(discord.user_id, discord)
  }

  const displayMetaMap = new Map<string, DisplayMeta>()

  for (const profile of optedInProfiles) {
    const discord = discordByUser.get(profile.user_id)

    const roles = toRoleList(discord?.discord_roles)
    const membershipTier = resolveMembershipTier(roles, roleTierMapping)

    displayMetaMap.set(profile.user_id, {
      display_name: profile.display_name ?? discord?.discord_username ?? null,
      discord_username: discord?.discord_username ?? null,
      discord_avatar: resolveDiscordAvatarUrl(discord?.discord_avatar, discord?.discord_user_id),
      membership_tier: membershipTier,
    })
  }

  return displayMetaMap
}

function buildCandidatesByCategory(
  aggregates: Map<string, UserAggregate>,
  userXpByUser: Map<string, number>,
  optedInUserIds: Set<string>,
): Record<LeaderboardCategory, LeaderboardCandidate[]> {
  const candidates: Record<LeaderboardCategory, LeaderboardCandidate[]> = {
    win_rate: [],
    total_pnl: [],
    longest_streak: [],
    academy_xp: [],
    discipline_score: [],
    trade_count: [],
  }

  for (const [userId, aggregate] of aggregates.entries()) {
    if (!optedInUserIds.has(userId)) continue

    if (aggregate.pnlTrades >= 10) {
      const winRate = (aggregate.winningTrades / aggregate.pnlTrades) * 100
      candidates.win_rate.push({ user_id: userId, value: winRate })
    }

    if (aggregate.pnlTrades >= 5) {
      candidates.total_pnl.push({ user_id: userId, value: aggregate.totalPnl })
      candidates.longest_streak.push({ user_id: userId, value: aggregate.longestWinStreak })
    }

    if (aggregate.totalTrades >= 10 && aggregate.disciplineCount > 0) {
      const avgDiscipline = aggregate.disciplineSum / aggregate.disciplineCount
      candidates.discipline_score.push({ user_id: userId, value: avgDiscipline })
    }

    if (aggregate.totalTrades > 0) {
      candidates.trade_count.push({ user_id: userId, value: aggregate.totalTrades })
    }
  }

  for (const userId of optedInUserIds) {
    const totalXp = userXpByUser.get(userId)
    if (totalXp == null || totalXp <= 0) continue

    candidates.academy_xp.push({ user_id: userId, value: totalXp })
  }

  for (const category of ALL_CATEGORIES) {
    candidates[category].sort((left, right) => {
      if (right.value !== left.value) {
        return right.value - left.value
      }
      return left.user_id.localeCompare(right.user_id)
    })
  }

  return candidates
}

function isAuthorizedRequest(req: Request): boolean {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const cronSecret = Deno.env.get('LEADERBOARD_CRON_SECRET') ?? Deno.env.get('CRON_SECRET') ?? ''
  const authorizationHeader = req.headers.get('authorization') ?? ''
  const apiKey = req.headers.get('apikey') ?? ''
  const cronHeader = req.headers.get('x-cron-secret') ?? ''

  const bearer = authorizationHeader.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length)
    : ''

  if (serviceRoleKey && (bearer === serviceRoleKey || apiKey === serviceRoleKey)) {
    return true
  }

  if (cronSecret && (cronHeader === cronSecret || bearer === cronSecret)) {
    return true
  }

  return false
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  }

  if (!isAuthorizedRequest(req)) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const snapshotDate = new Date().toISOString().slice(0, 10)

    const { data: roleTierSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'role_tier_mapping')
      .maybeSingle()

    const roleTierMapping = parseRoleTierMapping(roleTierSetting?.value)

    const { data: profileRows, error: profileError } = await supabase
      .from('member_profiles')
      .select('user_id, display_name, privacy_settings')

    if (profileError) {
      throw new Error(`Failed to load member profiles: ${profileError.message}`)
    }

    const optedInProfiles = (profileRows as MemberProfileRow[] | null | undefined)?.filter((profile) => {
      return shouldIncludeOnLeaderboard(profile.privacy_settings)
    }) ?? []

    const optedInUserIds = new Set(optedInProfiles.map((profile) => profile.user_id))

    if (optedInUserIds.size === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No opted-in users to rank',
          snapshot_date: snapshotDate,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        },
      )
    }

    const { data: discordRows, error: discordError } = await supabase
      .from('user_discord_profiles')
      .select('user_id, discord_user_id, discord_username, discord_avatar, discord_roles')
      .in('user_id', Array.from(optedInUserIds))

    if (discordError) {
      throw new Error(`Failed to load Discord profiles: ${discordError.message}`)
    }

    const { data: userXpRows, error: userXpError } = await supabase
      .from('user_xp')
      .select('user_id, total_xp')
      .in('user_id', Array.from(optedInUserIds))

    if (userXpError) {
      throw new Error(`Failed to load user XP: ${userXpError.message}`)
    }

    const userXpByUser = new Map<string, number>()
    for (const row of (userXpRows ?? []) as UserXpRow[]) {
      const totalXp = toNumber(row.total_xp)
      if (totalXp != null) {
        userXpByUser.set(row.user_id, totalXp)
      }
    }

    const displayMetaMap = buildDisplayMetaMap(
      optedInProfiles,
      (discordRows ?? []) as DiscordProfileRow[],
      roleTierMapping,
    )

    const insertedCounts: Record<string, number> = {}

    for (const period of ALL_PERIODS) {
      const startIso = getStartDateIso(PERIOD_WINDOWS[period])

      let tradesQuery = supabase
        .from('journal_entries')
        .select('user_id, pnl, trade_date, discipline_score, is_open')
        .eq('is_open', false)

      if (startIso) {
        tradesQuery = tradesQuery.gte('trade_date', startIso)
      }

      const { data: tradeRows, error: tradeRowsError } = await tradesQuery

      if (tradeRowsError) {
        throw new Error(`Failed to load trades for ${period}: ${tradeRowsError.message}`)
      }

      const aggregates = buildAggregatesByUser((tradeRows ?? []) as JournalEntryRow[])
      const candidatesByCategory = buildCandidatesByCategory(
        aggregates,
        userXpByUser,
        optedInUserIds,
      )

      for (const category of ALL_CATEGORIES) {
        const key = `${period}:${category}`
        const topCandidates = candidatesByCategory[category].slice(0, 100)

        const snapshotRows = topCandidates.map((candidate, index) => {
          const displayMeta = displayMetaMap.get(candidate.user_id)

          return {
            user_id: candidate.user_id,
            period,
            category,
            rank: index + 1,
            value: Number(candidate.value.toFixed(4)),
            display_name: displayMeta?.display_name ?? null,
            discord_avatar: displayMeta?.discord_avatar ?? null,
            discord_username: displayMeta?.discord_username ?? null,
            membership_tier: displayMeta?.membership_tier ?? null,
            snapshot_date: snapshotDate,
          }
        })

        const { error: deleteError } = await supabase
          .from('leaderboard_snapshots')
          .delete()
          .eq('period', period)
          .eq('category', category)
          .eq('snapshot_date', snapshotDate)

        if (deleteError) {
          throw new Error(`Failed to clear ${key} snapshot: ${deleteError.message}`)
        }

        if (snapshotRows.length > 0) {
          const { error: insertError } = await supabase
            .from('leaderboard_snapshots')
            .insert(snapshotRows)

          if (insertError) {
            throw new Error(`Failed to insert ${key} snapshot: ${insertError.message}`)
          }
        }

        insertedCounts[key] = snapshotRows.length
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        snapshot_date: snapshotDate,
        inserted: insertedCounts,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error) {
    console.error('Failed to compute leaderboards', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unexpected error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      },
    )
  }
})
