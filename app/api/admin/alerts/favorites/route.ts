import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerUser, isAdminUser } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/app/api/admin/alerts/discord/_shared'

const updateSchema = z.object({
  pinnedTickers: z.array(z.string()).max(8).optional(),
  recentTickers: z.array(z.string()).max(24).optional(),
  maxRecentTickers: z.number().int().min(1).max(12).optional(),
  defaultSizeTag: z.enum(['full', 'light', 'lotto']).optional(),
  defaultStopPct: z.number().min(0).max(1000).nullable().optional(),
  defaultStrikesPerSide: z.number().int().min(2).max(40).optional(),
  defaultMentionEveryone: z.boolean().optional(),
})

interface AdminAlertPreferencesRow {
  user_id: string
  pinned_tickers: string[] | null
  recent_tickers: string[] | null
  max_recent_tickers: number | null
  default_size_tag: 'full' | 'light' | 'lotto' | null
  default_stop_pct: number | null
  default_strikes_per_side: number | null
  default_mention_everyone: boolean | null
}

function normalizeTicker(input: string): string {
  return input.trim().toUpperCase()
}

function normalizeTickerList(input: string[] | null | undefined, max: number): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  for (const candidate of input ?? []) {
    const normalized = normalizeTicker(candidate)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    output.push(normalized)
    if (output.length >= max) break
  }
  return output
}

function withDefaults(row: AdminAlertPreferencesRow | null, userId: string): AdminAlertPreferencesRow {
  return {
    user_id: userId,
    pinned_tickers: normalizeTickerList(row?.pinned_tickers, 8).length > 0
      ? normalizeTickerList(row?.pinned_tickers, 8)
      : ['SPX'],
    recent_tickers: normalizeTickerList(row?.recent_tickers, 24),
    max_recent_tickers: Math.max(1, Math.min(12, Math.trunc(row?.max_recent_tickers ?? 5))),
    default_size_tag: row?.default_size_tag ?? 'full',
    default_stop_pct: row?.default_stop_pct ?? 20,
    default_strikes_per_side: row?.default_strikes_per_side ?? 10,
    default_mention_everyone: row?.default_mention_everyone ?? true,
  }
}

function buildChipList(row: AdminAlertPreferencesRow): string[] {
  const pinned = normalizeTickerList(row.pinned_tickers, 8)
  const maxRecent = Math.max(1, Math.min(12, Math.trunc(row.max_recent_tickers ?? 5)))
  const recent = normalizeTickerList(row.recent_tickers, 24).filter((ticker) => !pinned.includes(ticker))
  return [...pinned, ...recent.slice(0, maxRecent)]
}

async function loadPreferences(userId: string): Promise<AdminAlertPreferencesRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('admin_alert_preferences')
    .select(
      'user_id,pinned_tickers,recent_tickers,max_recent_tickers,default_size_tag,default_stop_pct,default_strikes_per_side,default_mention_everyone',
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as AdminAlertPreferencesRow | null) ?? null
}

async function upsertPreferences(row: AdminAlertPreferencesRow): Promise<AdminAlertPreferencesRow> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('admin_alert_preferences')
    .upsert(
      {
        user_id: row.user_id,
        pinned_tickers: row.pinned_tickers ?? ['SPX'],
        recent_tickers: row.recent_tickers ?? [],
        max_recent_tickers: row.max_recent_tickers ?? 5,
        default_size_tag: row.default_size_tag ?? 'full',
        default_stop_pct: row.default_stop_pct ?? 20,
        default_strikes_per_side: row.default_strikes_per_side ?? 10,
        default_mention_everyone: row.default_mention_everyone ?? true,
      },
      { onConflict: 'user_id' },
    )
    .select(
      'user_id,pinned_tickers,recent_tickers,max_recent_tickers,default_size_tag,default_stop_pct,default_strikes_per_side,default_mention_everyone',
    )
    .single()

  if (error) throw new Error(error.message)
  return data as AdminAlertPreferencesRow
}

export async function GET() {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = await getServerUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const existing = await loadPreferences(user.id)
    const normalized = withDefaults(existing, user.id)
    const persisted = existing ? normalized : await upsertPreferences(normalized)
    const responseRow = withDefaults(persisted, user.id)

    return NextResponse.json({
      success: true,
      preferences: {
        pinnedTickers: responseRow.pinned_tickers ?? ['SPX'],
        recentTickers: responseRow.recent_tickers ?? [],
        maxRecentTickers: responseRow.max_recent_tickers ?? 5,
        defaultSizeTag: responseRow.default_size_tag ?? 'full',
        defaultStopPct: responseRow.default_stop_pct ?? 20,
        defaultStrikesPerSide: responseRow.default_strikes_per_side ?? 10,
        defaultMentionEveryone: responseRow.default_mention_everyone ?? true,
      },
      chips: buildChipList(responseRow),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load alert favorites' },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  if (!await isAdminUser()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = await getServerUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await request.json().catch(() => ({}))
    const parsed = updateSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request payload' },
        { status: 400 },
      )
    }

    const current = withDefaults(await loadPreferences(user.id), user.id)
    const body = parsed.data
    const nextPinned = body.pinnedTickers
      ? normalizeTickerList(body.pinnedTickers, 8)
      : (current.pinned_tickers ?? ['SPX'])
    const safePinned = nextPinned.length > 0 ? nextPinned : ['SPX']
    const nextRecent = body.recentTickers
      ? normalizeTickerList(body.recentTickers, 24).filter((ticker) => !safePinned.includes(ticker))
      : (current.recent_tickers ?? [])
    const nextRow: AdminAlertPreferencesRow = {
      user_id: user.id,
      pinned_tickers: safePinned,
      recent_tickers: nextRecent,
      max_recent_tickers: body.maxRecentTickers ?? current.max_recent_tickers ?? 5,
      default_size_tag: body.defaultSizeTag ?? current.default_size_tag ?? 'full',
      default_stop_pct: body.defaultStopPct !== undefined ? body.defaultStopPct : (current.default_stop_pct ?? 20),
      default_strikes_per_side: body.defaultStrikesPerSide ?? current.default_strikes_per_side ?? 10,
      default_mention_everyone: body.defaultMentionEveryone ?? current.default_mention_everyone ?? true,
    }

    const saved = await upsertPreferences(nextRow)
    const responseRow = withDefaults(saved, user.id)

    return NextResponse.json({
      success: true,
      preferences: {
        pinnedTickers: responseRow.pinned_tickers ?? ['SPX'],
        recentTickers: responseRow.recent_tickers ?? [],
        maxRecentTickers: responseRow.max_recent_tickers ?? 5,
        defaultSizeTag: responseRow.default_size_tag ?? 'full',
        defaultStopPct: responseRow.default_stop_pct ?? 20,
        defaultStrikesPerSide: responseRow.default_strikes_per_side ?? 10,
        defaultMentionEveryone: responseRow.default_mention_everyone ?? true,
      },
      chips: buildChipList(responseRow),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update alert favorites' },
      { status: 500 },
    )
  }
}
