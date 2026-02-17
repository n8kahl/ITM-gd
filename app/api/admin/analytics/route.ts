import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/supabase-server'
import {
  AdminAnalyticsResponse,
  AICoachActivity,
  analyticsPeriodDays,
  analyticsPeriodStartIso,
  normalizeAnalyticsPeriod,
  RecentContact,
  RecentPageView,
  RecentSale,
  RecentSubscriber,
} from '@/lib/admin-analytics'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  }
  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, key)
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function dateKey(value: string): string {
  return value.slice(0, 10)
}

function buildCountMap(values: Array<string | null | undefined>): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    const key = (value || 'unknown').trim() || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

function countByDay(values: Array<string | null | undefined>): Array<{ date: string; count: number }> {
  const buckets = values.reduce<Record<string, number>>((acc, value) => {
    if (!value) return acc
    const key = dateKey(value)
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  return Object.entries(buckets)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function firstInitialLastName(name: string | null | undefined): string {
  if (!name) return 'Anonymous'

  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Anonymous'
  if (parts.length === 1) return `${parts[0].charAt(0).toUpperCase()}.`

  return `${parts[0].charAt(0).toUpperCase()}. ${parts[parts.length - 1]}`
}

function formatPrice(value: string | null | undefined): string {
  if (!value) return '$0'
  return value.startsWith('$') ? value : `$${value}`
}

function userDisplayNameFromMetadata(
  email: string | null | undefined,
  rawUserMeta: Record<string, unknown> | null | undefined
): string {
  const metaName = rawUserMeta?.full_name || rawUserMeta?.name || rawUserMeta?.display_name
  if (typeof metaName === 'string' && metaName.trim().length > 0) {
    return metaName
  }
  if (email && email.includes('@')) {
    return email.split('@')[0]
  }
  return 'Member'
}

export async function GET(request: NextRequest) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const period = normalizeAnalyticsPeriod(request.nextUrl.searchParams.get('period'))
    const startIso = analyticsPeriodStartIso(period)
    const rpcDays = analyticsPeriodDays(period)
    const supabaseAdmin = getSupabaseAdmin()

    const { data: platformRaw, error: platformError } = await supabaseAdmin.rpc('get_admin_analytics', {
      p_days: rpcDays,
    })

    if (platformError) {
      console.warn('get_admin_analytics RPC unavailable, using manual fallback:', platformError.message)
    }

    const platformData = (!platformError && platformRaw && typeof platformRaw === 'object')
      ? platformRaw as Record<string, unknown>
      : {}

    let pageViewsQuery = supabaseAdmin
      .from('page_views')
      .select('id, session_id, page_path, referrer, device_type, browser, os, created_at')
      .order('created_at', { ascending: false })

    let clicksQuery = supabaseAdmin
      .from('click_events')
      .select('element_type, created_at')
      .order('created_at', { ascending: false })

    let conversionsQuery = supabaseAdmin
      .from('conversion_events')
      .select('id, session_id, event_type, event_value, created_at')
      .order('created_at', { ascending: false })

    let subscribersRecentQuery = supabaseAdmin
      .from('subscribers')
      .select('id, name, email, phone, instagram_handle, twitter_handle, created_at')
      .order('created_at', { ascending: false })
      .limit(20)

    let contactsRecentQuery = supabaseAdmin
      .from('contact_submissions')
      .select('id, name, email, message, phone, created_at')
      .order('created_at', { ascending: false })
      .limit(20)

    let pageViewsRecentQuery = supabaseAdmin
      .from('page_views')
      .select('id, session_id, page_path, referrer, device_type, browser, os, created_at')
      .order('created_at', { ascending: false })
      .limit(20)

    let totalPageViewsCountQuery = supabaseAdmin
      .from('page_views')
      .select('id', { count: 'exact', head: true })

    let totalClicksCountQuery = supabaseAdmin
      .from('click_events')
      .select('id', { count: 'exact', head: true })

    let totalSubscribersCountQuery = supabaseAdmin
      .from('subscribers')
      .select('id', { count: 'exact', head: true })

    let totalContactsCountQuery = supabaseAdmin
      .from('contact_submissions')
      .select('id', { count: 'exact', head: true })

    let subscribedCountQuery = supabaseAdmin
      .from('conversion_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'subscription')

    let aiCoachSessionsQuery = supabaseAdmin
      .from('ai_coach_sessions')
      .select('id, user_id, message_count, created_at')
      .order('created_at', { ascending: false })
      .limit(3)

    let manualNewMembersQuery = supabaseAdmin
      .schema('auth')
      .from('users')
      .select('id', { count: 'exact', head: true })

    let manualJournalEntriesQuery = supabaseAdmin
      .from('journal_entries')
      .select('id', { count: 'exact', head: true })

    let manualAiAnalysisQuery = supabaseAdmin
      .from('journal_entries')
      .select('id', { count: 'exact', head: true })
      .not('ai_analysis', 'is', null)

    let manualAiCoachSessionsQuery = supabaseAdmin
      .from('ai_coach_sessions')
      .select('id', { count: 'exact', head: true })

    let manualAiCoachMessagesQuery = supabaseAdmin
      .from('ai_coach_messages')
      .select('id', { count: 'exact', head: true })

    let manualSharedTradeCardsQuery = supabaseAdmin
      .from('shared_trade_cards')
      .select('id', { count: 'exact', head: true })

    let manualActiveUsersQuery = supabaseAdmin
      .from('member_analytics_events')
      .select('user_id')

    if (startIso) {
      pageViewsQuery = pageViewsQuery.gte('created_at', startIso)
      clicksQuery = clicksQuery.gte('created_at', startIso)
      conversionsQuery = conversionsQuery.gte('created_at', startIso)
      subscribersRecentQuery = subscribersRecentQuery.gte('created_at', startIso)
      contactsRecentQuery = contactsRecentQuery.gte('created_at', startIso)
      pageViewsRecentQuery = pageViewsRecentQuery.gte('created_at', startIso)
      totalPageViewsCountQuery = totalPageViewsCountQuery.gte('created_at', startIso)
      totalClicksCountQuery = totalClicksCountQuery.gte('created_at', startIso)
      totalSubscribersCountQuery = totalSubscribersCountQuery.gte('created_at', startIso)
      totalContactsCountQuery = totalContactsCountQuery.gte('created_at', startIso)
      subscribedCountQuery = subscribedCountQuery.gte('created_at', startIso)
      aiCoachSessionsQuery = aiCoachSessionsQuery.gte('created_at', startIso)
      manualNewMembersQuery = manualNewMembersQuery.gte('created_at', startIso)
      manualJournalEntriesQuery = manualJournalEntriesQuery.gte('created_at', startIso)
      manualAiAnalysisQuery = manualAiAnalysisQuery.gte('created_at', startIso)
      manualAiCoachSessionsQuery = manualAiCoachSessionsQuery.gte('created_at', startIso)
      manualAiCoachMessagesQuery = manualAiCoachMessagesQuery.gte('created_at', startIso)
      manualSharedTradeCardsQuery = manualSharedTradeCardsQuery.gte('shared_at', startIso)
      manualActiveUsersQuery = manualActiveUsersQuery.gte('created_at', startIso)
    }

    const [
      pageViewsResult,
      clicksResult,
      conversionsResult,
      subscribersRecentResult,
      contactsRecentResult,
      pageViewsRecentResult,
      totalPageViewsCountResult,
      totalClicksCountResult,
      totalSubscribersCountResult,
      totalContactsCountResult,
      subscribedCountResult,
      pendingApplicationsResult,
      activeLearnersResult,
      aiCoachSessionsResult,
      pricingTiersResult,
      manualTotalMembersResult,
      manualNewMembersResult,
      manualJournalEntriesResult,
      manualAiAnalysisResult,
      manualAiCoachSessionsResult,
      manualAiCoachMessagesResult,
      manualSharedTradeCardsResult,
      manualActiveUsersResult,
    ] = await Promise.all([
      pageViewsQuery,
      clicksQuery,
      conversionsQuery,
      subscribersRecentQuery,
      contactsRecentQuery,
      pageViewsRecentQuery,
      totalPageViewsCountQuery,
      totalClicksCountQuery,
      totalSubscribersCountQuery,
      totalContactsCountQuery,
      subscribedCountQuery,
      supabaseAdmin
        .from('cohort_applications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      startIso
        ? supabaseAdmin
            .from('academy_user_lesson_attempts')
            .select('user_id, started_at, completed_at')
            .or(`started_at.gte.${startIso},completed_at.gte.${startIso}`)
        : supabaseAdmin.from('academy_user_lesson_attempts').select('user_id'),
      aiCoachSessionsQuery,
      supabaseAdmin.from('pricing_tiers').select('id, name, monthly_price'),
      supabaseAdmin.schema('auth').from('users').select('id', { count: 'exact', head: true }),
      manualNewMembersQuery,
      manualJournalEntriesQuery,
      manualAiAnalysisQuery,
      manualAiCoachSessionsQuery,
      manualAiCoachMessagesQuery,
      manualSharedTradeCardsQuery,
      manualActiveUsersQuery,
    ])

    // Graceful degradation: warn on query failures instead of crashing.
    // Many analytics tables (click_events, conversion_events, page_views) may
    // not exist in every environment. Show whatever data IS available.
    const warnIfError = (label: string, result: { error: { message: string } | null }) => {
      if (result.error) {
        console.warn(`Analytics query failed [${label}]:`, result.error.message)
      }
    }

    warnIfError('page_views', pageViewsResult)
    warnIfError('click_events', clicksResult)
    warnIfError('conversion_events', conversionsResult)
    warnIfError('subscribers_recent', subscribersRecentResult)
    warnIfError('contacts_recent', contactsRecentResult)
    warnIfError('page_views_recent', pageViewsRecentResult)
    warnIfError('total_page_views_count', totalPageViewsCountResult)
    warnIfError('total_clicks_count', totalClicksCountResult)
    warnIfError('total_subscribers_count', totalSubscribersCountResult)
    warnIfError('total_contacts_count', totalContactsCountResult)
    warnIfError('subscribed_count', subscribedCountResult)
    warnIfError('cohort_applications', pendingApplicationsResult)
    warnIfError('academy_user_lesson_attempts', activeLearnersResult)
    warnIfError('ai_coach_sessions', aiCoachSessionsResult)
    warnIfError('pricing_tiers', pricingTiersResult)
    warnIfError('auth_users_total', manualTotalMembersResult)
    warnIfError('auth_users_new', manualNewMembersResult)
    warnIfError('journal_entries', manualJournalEntriesResult)
    warnIfError('journal_ai_analysis', manualAiAnalysisResult)
    warnIfError('ai_coach_sessions_count', manualAiCoachSessionsResult)
    warnIfError('ai_coach_messages_count', manualAiCoachMessagesResult)
    warnIfError('shared_trade_cards', manualSharedTradeCardsResult)
    warnIfError('member_analytics_events', manualActiveUsersResult)

    const pageViewsRows = pageViewsResult.data || []
    const clickRows = clicksResult.data || []
    const conversionRows = conversionsResult.data || []

    // Fallback calculation based on fetched rows only (may be capped by API row limits).
    const fallbackUniqueVisitors = new Set(
      pageViewsRows
        .map((row: { session_id: string | null }) => row.session_id)
        .filter(Boolean)
    ).size

    // Preferred: server-side distinct count across the full filtered dataset.
    const { data: uniqueVisitorsRpc, error: uniqueVisitorsError } = await supabaseAdmin.rpc(
      'count_unique_page_view_sessions',
      { p_start: startIso, p_end: null }
    )

    if (uniqueVisitorsError) {
      console.warn('count_unique_page_view_sessions RPC unavailable, using row-based fallback:', uniqueVisitorsError.message)
    }

    const uniqueVisitors = uniqueVisitorsError
      ? fallbackUniqueVisitors
      : toNumber(uniqueVisitorsRpc)

    const subscribedCount = subscribedCountResult.count || 0
    const conversionRate = uniqueVisitors > 0
      ? Number(((subscribedCount / uniqueVisitors) * 100).toFixed(2))
      : 0

    const conversionFunnel = conversionRows.reduce(
      (acc: { modal_opened: number; modal_closed: number; form_submitted: number; subscribed: number }, row: {
        event_type: string | null
      }) => {
        switch (row.event_type) {
          case 'modal_opened':
            acc.modal_opened += 1
            break
          case 'modal_closed':
            acc.modal_closed += 1
            break
          case 'form_submitted':
            acc.form_submitted += 1
            break
          case 'subscription':
            acc.subscribed += 1
            break
          default:
            break
        }
        return acc
      },
      { modal_opened: 0, modal_closed: 0, form_submitted: 0, subscribed: 0 }
    )

    const pageViewsByDay = countByDay(
      pageViewsRows.map((row: { created_at: string | null }) => row.created_at)
    ).map((point) => ({ date: point.date, views: point.count }))

    const conversionsByDay = countByDay(
      conversionRows
        .filter((row: { event_type: string | null }) => row.event_type === 'subscription')
        .map((row: { created_at: string | null }) => row.created_at)
    )

    const deviceBreakdown = buildCountMap(
      pageViewsRows.map((row: { device_type: string | null }) => row.device_type)
    )
    const browserBreakdown = buildCountMap(
      pageViewsRows.map((row: { browser: string | null }) => row.browser)
    )
    const clickBreakdown = buildCountMap(
      clickRows.map((row: { element_type: string | null }) => row.element_type)
    )

    const topPages = Object.entries(
      buildCountMap(pageViewsRows.map((row: { page_path: string | null }) => row.page_path))
    )
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10)

    const activeLearners = new Set(
      (activeLearnersResult.data || [])
        .map((row: { user_id: string | null }) => row.user_id)
        .filter(Boolean)
    ).size

    const manualActiveUsers = new Set(
      (manualActiveUsersResult.data || [])
        .map((row: { user_id: string | null }) => row.user_id)
        .filter(Boolean)
    ).size

    const recentSubscribers: RecentSubscriber[] = (subscribersRecentResult.data || []).map((row: {
      id: string
      name: string | null
      email: string
      phone: string | null
      instagram_handle: string | null
      twitter_handle: string | null
      created_at: string
    }) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      instagram_handle: row.instagram_handle,
      twitter_handle: row.twitter_handle,
      created_at: row.created_at,
    }))

    const recentContacts: RecentContact[] = (contactsRecentResult.data || []).map((row: {
      id: string
      name: string
      email: string
      message: string
      phone: string | null
      created_at: string
    }) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      message: row.message,
      phone: row.phone,
      created_at: row.created_at,
    }))

    const recentPageViews: RecentPageView[] = (pageViewsRecentResult.data || []).map((row: {
      id: string
      session_id: string
      page_path: string
      referrer: string | null
      device_type: string | null
      browser: string | null
      os: string | null
      created_at: string
    }) => ({
      id: row.id,
      session_id: row.session_id,
      page_path: row.page_path,
      referrer: row.referrer,
      device_type: row.device_type,
      browser: row.browser,
      os: row.os,
      created_at: row.created_at,
    }))

    const subscriptionRows = conversionRows.filter(
      (row: { event_type: string | null }) => row.event_type === 'subscription'
    )
    const latestSubscriptionRows = subscriptionRows.slice(0, 5)
    const saleSessionIds = latestSubscriptionRows
      .map((row: { session_id: string | null }) => row.session_id)
      .filter((value): value is string => Boolean(value))

    const { data: salesSubscribersData, error: salesSubscribersError } = saleSessionIds.length > 0
      ? await supabaseAdmin
          .from('subscribers')
          .select('session_id, name')
          .in('session_id', saleSessionIds)
      : { data: [], error: null }

    if (salesSubscribersError) {
      console.warn('Analytics query failed [sales_subscribers]:', salesSubscribersError.message)
    }

    const subscriberBySession = new Map<string, string>()
    ;(salesSubscribersData || []).forEach((row: { session_id: string; name: string | null }) => {
      subscriberBySession.set(row.session_id, firstInitialLastName(row.name))
    })

    const tierData = pricingTiersResult.data || []
    const tierById = new Map<string, { name: string; monthly_price: string | null }>()
    tierData.forEach((tier: { id: string; name: string; monthly_price: string | null }) => {
      tierById.set(tier.id.toLowerCase(), { name: tier.name, monthly_price: tier.monthly_price })
      tierById.set(tier.name.toLowerCase(), { name: tier.name, monthly_price: tier.monthly_price })
    })

    const recentSales: RecentSale[] = latestSubscriptionRows.map((row: {
      id: string
      session_id: string | null
      event_value: string | null
      created_at: string
    }) => {
      const rawTier = (row.event_value || '').trim()
      const tierLookupKey = rawTier.toLowerCase()
      const tierMatch = tierById.get(tierLookupKey)
        || (tierLookupKey.includes('core') ? tierById.get('core') : null)
        || (tierLookupKey.includes('pro') ? tierById.get('pro') : null)
        || (tierLookupKey.includes('exec') ? tierById.get('executive') : null)
      const tierName = tierMatch?.name || rawTier || 'Subscription'
      const amount = formatPrice(tierMatch?.monthly_price || null)
      const subscriberName = row.session_id
        ? (subscriberBySession.get(row.session_id) || 'Anonymous')
        : 'Anonymous'

      return {
        id: row.id,
        subscriber_name: subscriberName,
        tier_name: tierName,
        amount,
        created_at: row.created_at,
      }
    })

    const aiCoachSessions = aiCoachSessionsResult.data || []
    const aiCoachUserIds = aiCoachSessions
      .map((row: { user_id: string | null }) => row.user_id)
      .filter((value): value is string => Boolean(value))

    const { data: authUsersData, error: authUsersError } = aiCoachUserIds.length > 0
      ? await supabaseAdmin
          .schema('auth')
          .from('users')
          .select('id, email, raw_user_meta_data')
          .in('id', aiCoachUserIds)
      : { data: [], error: null }

    if (authUsersError) {
      console.warn('Analytics query failed [auth_users_coach]:', authUsersError.message)
    }

    const authUserMap = new Map<string, { email: string | null; raw_user_meta_data: Record<string, unknown> | null }>()
    ;(authUsersData || []).forEach((row: {
      id: string
      email: string | null
      raw_user_meta_data: Record<string, unknown> | null
    }) => {
      authUserMap.set(row.id, {
        email: row.email,
        raw_user_meta_data: row.raw_user_meta_data,
      })
    })

    const aiCoachActivity: AICoachActivity[] = aiCoachSessions.map((row: {
      id: string
      user_id: string
      message_count: number | null
      created_at: string
    }) => {
      const authUser = authUserMap.get(row.user_id)
      return {
        session_id: row.id,
        user_id: row.user_id,
        user_name: userDisplayNameFromMetadata(authUser?.email, authUser?.raw_user_meta_data),
        message_count: row.message_count || 0,
        created_at: row.created_at,
      }
    })

    const readPlatformMetric = (key: string, fallback: number) =>
      Object.prototype.hasOwnProperty.call(platformData, key)
        ? toNumber(platformData[key])
        : fallback

    const response: AdminAnalyticsResponse = {
      period,
      platform: {
        total_members: readPlatformMetric('total_members', manualTotalMembersResult.count || 0),
        new_members: readPlatformMetric('new_members', manualNewMembersResult.count || 0),
        total_journal_entries: readPlatformMetric('total_journal_entries', manualJournalEntriesResult.count || 0),
        ai_analysis_count: readPlatformMetric('ai_analysis_count', manualAiAnalysisResult.count || 0),
        ai_coach_sessions: readPlatformMetric('ai_coach_sessions', manualAiCoachSessionsResult.count || 0),
        ai_coach_messages: readPlatformMetric('ai_coach_messages', manualAiCoachMessagesResult.count || 0),
        shared_trade_cards: readPlatformMetric('shared_trade_cards', manualSharedTradeCardsResult.count || 0),
        active_users: readPlatformMetric('active_users', manualActiveUsers),
        active_learners: activeLearners,
        pending_applications: pendingApplicationsResult.count || 0,
      },
      marketing: {
        total_page_views: totalPageViewsCountResult.count || 0,
        unique_visitors: uniqueVisitors,
        total_clicks: totalClicksCountResult.count || 0,
        total_subscribers: totalSubscribersCountResult.count || 0,
        total_contacts: totalContactsCountResult.count || 0,
        conversion_rate: conversionRate,
      },
      page_views_by_day: pageViewsByDay,
      conversions_by_day: conversionsByDay,
      conversion_funnel: conversionFunnel,
      device_breakdown: deviceBreakdown,
      browser_breakdown: browserBreakdown,
      click_breakdown: clickBreakdown,
      top_pages: topPages,
      recent_subscribers: recentSubscribers,
      recent_contacts: recentContacts,
      recent_page_views: recentPageViews,
      recent_sales: recentSales,
      ai_coach_activity: aiCoachActivity,
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=60, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    console.error('Failed to fetch admin analytics:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
