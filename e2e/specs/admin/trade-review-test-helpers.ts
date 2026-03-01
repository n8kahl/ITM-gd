import type { Page } from '@playwright/test'
import type {
  CoachMarketDataSnapshot,
  CoachResponsePayload,
  CoachTradeNote,
} from '@/lib/types/coach-review'

export const TRADE_REVIEW_ENTRY_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'

function createJournalEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: TRADE_REVIEW_ENTRY_ID,
    user_id: USER_ID,
    trade_date: '2026-02-27T14:35:00.000Z',
    symbol: 'AAPL',
    direction: 'long',
    contract_type: 'call',
    entry_price: 3.2,
    exit_price: 4.1,
    position_size: 2,
    pnl: 180,
    pnl_percentage: 12.5,
    is_winner: true,
    is_open: false,
    entry_timestamp: '2026-02-27T14:35:00.000Z',
    exit_timestamp: '2026-02-27T15:42:00.000Z',
    stop_loss: 2.6,
    initial_target: 4.5,
    hold_duration_min: 67,
    mfe_percent: 18.2,
    mae_percent: -4.8,
    strike_price: 220,
    expiration_date: '2026-03-20',
    dte_at_entry: 21,
    iv_at_entry: 0.32,
    delta_at_entry: 0.41,
    theta_at_entry: -0.09,
    gamma_at_entry: 0.04,
    vega_at_entry: 0.12,
    underlying_at_entry: 219.6,
    underlying_at_exit: 221.8,
    mood_before: 'confident',
    mood_after: 'excited',
    discipline_score: 4,
    followed_plan: true,
    deviation_notes: null,
    strategy: 'Breakout Retest',
    setup_notes: 'Breakout above PDH with volume expansion',
    execution_notes: 'Entered on pullback after confirmation candle',
    lessons_learned: 'Scale partial at first resistance',
    tags: ['breakout', 'momentum'],
    rating: 4,
    screenshot_url: null,
    screenshot_storage_path: null,
    ai_analysis: {
      grade: 'B',
      entry_quality: 'Solid entry process.',
      exit_quality: 'Exit captured most of move.',
      risk_management: 'Stop respected.',
      lessons: ['Continue waiting for confirmation.'],
      scored_at: '2026-02-27T20:00:00.000Z',
    },
    market_context: null,
    import_id: null,
    is_favorite: false,
    setup_type: 'Bull Breakout',
    is_draft: false,
    draft_status: null,
    draft_expires_at: null,
    coach_review_status: 'pending',
    coach_review_requested_at: '2026-02-28T10:00:00.000Z',
    created_at: '2026-02-27T15:45:00.000Z',
    updated_at: '2026-02-27T15:45:00.000Z',
    ...overrides,
  }
}

function createDraftResponse(): CoachResponsePayload {
  return {
    what_went_well: [
      'You waited for confirmation above PDH before entry.',
      'Risk was defined with a clear stop before the trade.',
      'Position sizing was appropriate for setup quality.',
    ],
    areas_to_improve: [
      {
        point: 'Late partial scaling',
        instruction: 'At $221.90 resistance, pre-place a 30% scale-out order next time.',
      },
      {
        point: 'Exit timing drift',
        instruction: 'When 5m closes below EMA8 after extension, reduce to runner size.',
      },
      {
        point: 'Overstaying final tranche',
        instruction: 'Use a 2-bar fail rule after first target to avoid round trips.',
      },
    ],
    specific_drills: [
      {
        title: 'Resistance Scale Drill',
        description: 'Backtest 10 similar trades and mark optimal first scale levels.',
      },
      {
        title: 'Exit Trigger Drill',
        description: 'Replay 5 sessions and annotate EMA8 reclaim/fail exit points.',
      },
    ],
    overall_assessment: 'Process quality was strong and risk controls were respected. Execution improved after confirmation, but partial management can be tightened for consistency.',
    grade: 'B',
    grade_reasoning: 'Strong plan adherence with minor profit-taking inefficiencies.',
    confidence: 'high',
  }
}

function createMarketSnapshot(): CoachMarketDataSnapshot {
  const minuteBars = Array.from({ length: 80 }).map((_, index) => ({
    t: Date.parse('2026-02-27T14:00:00.000Z') + index * 60_000,
    o: 219.2 + index * 0.03,
    h: 219.35 + index * 0.03,
    l: 219.1 + index * 0.03,
    c: 219.25 + index * 0.03,
    v: 10000 + index * 120,
    vw: 219.2 + index * 0.028,
  }))

  const dailyBars = Array.from({ length: 30 }).map((_, index) => ({
    t: Date.parse('2026-01-20T00:00:00.000Z') + index * 86_400_000,
    o: 208 + index * 0.5,
    h: 209 + index * 0.6,
    l: 207.6 + index * 0.45,
    c: 208.4 + index * 0.55,
    v: 72000000 + index * 100000,
    vw: 208.1 + index * 0.52,
  }))

  return {
    chart: {
      symbol: 'AAPL',
      date: '2026-02-27',
      minuteBars,
      dailyBars,
      entryMarker: {
        timestamp: Date.parse('2026-02-27T14:35:00.000Z'),
        price: 3.2,
      },
      exitMarker: {
        timestamp: Date.parse('2026-02-27T15:42:00.000Z'),
        price: 4.1,
      },
    },
    options: {
      contractTicker: 'O:AAPL260320C00220000',
      strikePrice: 220,
      expirationDate: '2026-03-20',
      contractType: 'call',
      greeksAtEntry: {
        delta: 0.41,
        gamma: 0.04,
        theta: -0.09,
        vega: 0.12,
      },
      ivAtEntry: 0.32,
      openInterest: 12400,
      bidAskSpread: {
        bid: 3.15,
        ask: 3.25,
      },
    },
    spxContext: {
      spxPrice: 6088.42,
      spxChange: 0.54,
      vixLevel: 16.2,
      regime: 'trending',
      regimeDirection: 'bullish',
      gexRegime: 'positive_gamma',
      gexFlipPoint: 6060.0,
    },
    volumeContext: {
      tradeTimeVolume: 15200,
      avgVolume: 78000000,
      relativeVolume: 1.18,
      vwapAtEntry: 220.1,
      vwapAtExit: 221.6,
    },
    fetchedAt: '2026-03-01T15:00:00.000Z',
    dataQuality: 'full',
  }
}

function createInitialCoachNote(): CoachTradeNote {
  return {
    id: 'note-1',
    journal_entry_id: TRADE_REVIEW_ENTRY_ID,
    review_request_id: 'request-1',
    coach_user_id: 'admin-1',
    coach_response: null,
    internal_notes: null,
    ai_draft: null,
    screenshots: [],
    screenshot_urls: [],
    market_data_snapshot: null,
    is_published: false,
    published_at: null,
    created_at: '2026-03-01T12:00:00.000Z',
    updated_at: '2026-03-01T12:00:00.000Z',
  }
}

export async function setupTradeReviewApiMocks(page: Page) {
  const state = {
    entry: createJournalEntry(),
    note: createInitialCoachNote(),
    reviewStatus: 'pending' as 'pending' | 'in_review' | 'completed' | null,
    aiGeneratedCount: 0,
    saveCount: 0,
    publishCount: 0,
    dismissCount: 0,
    uploadCount: 0,
  }

  const activity: Array<Record<string, unknown>> = [
    {
      id: 'log-1',
      action: 'requested',
      created_at: '2026-03-01T10:01:00.000Z',
    },
  ]

  const queueData = [
    {
      id: 'request-1',
      journal_entry_id: TRADE_REVIEW_ENTRY_ID,
      user_id: USER_ID,
      status: state.reviewStatus,
      priority: 'normal',
      assigned_to: null,
      requested_at: '2026-03-01T10:00:00.000Z',
      claimed_at: null,
      completed_at: null,
      created_at: '2026-03-01T10:00:00.000Z',
      updated_at: '2026-03-01T10:00:00.000Z',
      symbol: 'AAPL',
      direction: 'long',
      contract_type: 'call',
      trade_date: '2026-02-27T14:35:00.000Z',
      pnl: 180,
      pnl_percentage: 12.5,
      is_winner: true,
      entry_price: 3.2,
      exit_price: 4.1,
      screenshot_url: null,
      member_display_name: 'Mock Member',
      member_avatar_url: null,
      member_discord_username: 'mock_member',
      has_draft: false,
      has_published_note: false,
    },
  ]

  const browseData = [
    {
      ...createJournalEntry({ symbol: 'TSLA', id: '33333333-3333-4333-8333-333333333333' }),
      member_display_name: 'Mock Member',
    },
  ]

  function detailPayload() {
    return {
      entry: {
        ...state.entry,
        coach_review_status: state.reviewStatus,
      },
      member: {
        display_name: 'Mock Member',
        avatar_url: null,
        discord_username: 'mock_member',
        tier: 'Elite',
      },
      review_request: {
        id: 'request-1',
        status: state.reviewStatus ?? 'dismissed',
      },
      coach_note: state.note,
      member_stats: {
        total_trades: 40,
        win_rate: 57.5,
        avg_pnl: 74.1,
        symbol_stats: {
          win_rate: 63.4,
          avg_pnl: 91.2,
          trade_count: 15,
        },
        recent_streak: 'winning',
        avg_discipline_score: 3.9,
      },
      activity_log: activity,
    }
  }

  await page.route('**/rest/v1/coach_review_requests*', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'content-type': 'application/json',
        'content-range': '0-0/0',
      },
      body: '[]',
    })
  })

  await page.route('**/mock-upload/**', async (route) => {
    await route.fulfill({ status: 200, body: '' })
  })

  await page.route('**/api/admin/trade-review**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const { pathname } = url

    if (pathname === '/api/admin/trade-review/stats') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            pending_count: state.reviewStatus === 'pending' ? 1 : 0,
            in_review_count: state.reviewStatus === 'in_review' ? 1 : 0,
            completed_today: state.publishCount,
            completed_this_week: state.publishCount,
            avg_response_hours: state.publishCount > 0 ? 2.4 : null,
          },
        }),
      })
      return
    }

    if (pathname === '/api/admin/trade-review') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: queueData }),
      })
      return
    }

    if (pathname === '/api/admin/trade-review/browse') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: browseData }),
      })
      return
    }

    if (pathname === '/api/admin/trade-review/ai-coach' && request.method() === 'POST') {
      state.aiGeneratedCount += 1
      const draft = createDraftResponse()
      state.note = {
        ...state.note,
        ai_draft: draft,
        market_data_snapshot: createMarketSnapshot(),
      }
      state.reviewStatus = 'in_review'
      activity.unshift({ id: `log-ai-${state.aiGeneratedCount}`, action: 'ai_generated', created_at: new Date().toISOString() })

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            draft,
            market_data_snapshot: state.note.market_data_snapshot,
            tokens_used: 1400,
          },
        }),
      })
      return
    }

    if (pathname === `/api/admin/trade-review/${TRADE_REVIEW_ENTRY_ID}`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: detailPayload() }),
      })
      return
    }

    if (pathname === `/api/admin/trade-review/${TRADE_REVIEW_ENTRY_ID}/notes`) {
      const payload = (request.postDataJSON() ?? {}) as {
        coach_response?: CoachResponsePayload
        internal_notes?: string | null
      }
      state.saveCount += 1
      state.note = {
        ...state.note,
        coach_response: payload.coach_response ?? state.note.coach_response,
        internal_notes: payload.internal_notes ?? state.note.internal_notes,
      }
      activity.unshift({ id: `log-save-${state.saveCount}`, action: 'edited', created_at: new Date().toISOString() })

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: state.note }),
      })
      return
    }

    if (pathname === `/api/admin/trade-review/${TRADE_REVIEW_ENTRY_ID}/publish`) {
      state.publishCount += 1
      state.reviewStatus = 'completed'
      state.note = {
        ...state.note,
        is_published: true,
        published_at: new Date().toISOString(),
      }
      activity.unshift({ id: `log-publish-${state.publishCount}`, action: 'published', created_at: new Date().toISOString() })

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { published: true } }),
      })
      return
    }

    if (pathname === `/api/admin/trade-review/${TRADE_REVIEW_ENTRY_ID}/dismiss`) {
      state.dismissCount += 1
      state.reviewStatus = null
      activity.unshift({ id: `log-dismiss-${state.dismissCount}`, action: 'dismissed', created_at: new Date().toISOString() })

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { dismissed: true } }),
      })
      return
    }

    if (pathname === `/api/admin/trade-review/${TRADE_REVIEW_ENTRY_ID}/screenshots` && request.method() === 'POST') {
      state.uploadCount += 1
      const path = `${TRADE_REVIEW_ENTRY_ID}/mock-${state.uploadCount}.png`
      state.note = {
        ...state.note,
        screenshots: [...state.note.screenshots, path],
        screenshot_urls: [...(state.note.screenshot_urls ?? []), `http://127.0.0.1:3000/mock-upload/${path}`],
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            path,
            token: 'mock-token',
            signed_url: `http://127.0.0.1:3000/mock-upload/${path}`,
            content_type: 'image/png',
          },
        }),
      })
      return
    }

    if (pathname === `/api/admin/trade-review/${TRADE_REVIEW_ENTRY_ID}/screenshots` && request.method() === 'DELETE') {
      const path = url.searchParams.get('path')
      if (path) {
        state.note = {
          ...state.note,
          screenshots: state.note.screenshots.filter((row) => row !== path),
          screenshot_urls: (state.note.screenshot_urls ?? []).filter((row) => !row.includes(path)),
        }
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { removed: true } }),
      })
      return
    }

    await route.fallback()
  })

  return state
}
