export type CoachReviewStatus = 'pending' | 'in_review' | 'completed' | 'dismissed'
export type CoachReviewPriority = 'normal' | 'urgent'
export type CoachGrade = 'A' | 'B' | 'C' | 'D' | 'F'
export type CoachConfidence = 'high' | 'medium' | 'low'

export type CoachReviewAction =
  | 'requested'
  | 'claimed'
  | 'ai_generated'
  | 'draft_saved'
  | 'edited'
  | 'published'
  | 'unpublished'
  | 'dismissed'
  | 'screenshot_added'
  | 'screenshot_removed'
  | 'priority_changed'

export interface CoachReviewRequest {
  id: string
  journal_entry_id: string
  user_id: string
  status: CoachReviewStatus
  priority: CoachReviewPriority
  assigned_to: string | null
  requested_at: string
  claimed_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface CoachReviewQueueItem extends CoachReviewRequest {
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
  member_display_name: string
  member_avatar_url: string | null
  member_discord_username: string | null
  has_draft: boolean
  has_published_note: boolean
}

export interface CoachImprovementItem {
  point: string
  instruction: string
}

export interface CoachDrill {
  title: string
  description: string
}

export interface CoachResponsePayload {
  what_went_well: string[]
  areas_to_improve: CoachImprovementItem[]
  specific_drills: CoachDrill[]
  overall_assessment: string
  grade: CoachGrade
  grade_reasoning: string
  confidence: CoachConfidence
}

export interface CoachTradeNote {
  id: string
  journal_entry_id: string
  review_request_id: string | null
  coach_user_id: string
  coach_response: CoachResponsePayload | null
  internal_notes: string | null
  ai_draft: CoachResponsePayload | null
  screenshots: string[]
  screenshot_urls?: string[]
  market_data_snapshot: CoachMarketDataSnapshot | null
  is_published: boolean
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface CoachMarketDataSnapshot {
  chart: {
    symbol: string
    date: string
    minuteBars: Array<{
      t: number
      o: number
      h: number
      l: number
      c: number
      v: number
      vw?: number
    }>
    dailyBars: Array<{
      t: number
      o: number
      h: number
      l: number
      c: number
      v: number
      vw?: number
    }>
    entryMarker?: {
      timestamp: number
      price: number
    }
    exitMarker?: {
      timestamp: number
      price: number
    }
  }
  options?: {
    contractTicker: string
    strikePrice: number
    expirationDate: string
    contractType: 'call' | 'put'
    greeksAtEntry: {
      delta: number
      gamma: number
      theta: number
      vega: number
    }
    ivAtEntry: number
    openInterest: number | null
    bidAskSpread: {
      bid: number
      ask: number
    } | null
  }
  spxContext: {
    spxPrice: number
    spxChange: number
    vixLevel: number
    regime: 'trending' | 'ranging' | 'compression' | 'breakout'
    regimeDirection: 'bullish' | 'bearish' | 'neutral'
    gexRegime: 'positive_gamma' | 'negative_gamma' | 'near_flip'
    gexFlipPoint: number | null
  }
  volumeContext: {
    tradeTimeVolume: number
    avgVolume: number
    relativeVolume: number
    vwapAtEntry: number | null
    vwapAtExit: number | null
  }
  fetchedAt: string
  dataQuality: 'full' | 'partial' | 'stale'
}

export interface CoachReviewActivityEntry {
  id: string
  review_request_id: string | null
  journal_entry_id: string
  actor_id: string
  action: CoachReviewAction
  details: Record<string, unknown>
  created_at: string
}

export interface CoachReviewQueueParams {
  status?: CoachReviewStatus | 'all'
  priority?: CoachReviewPriority | 'all'
  symbol?: string
  member?: string
  sortBy?: 'requested_at' | 'trade_date' | 'pnl'
  sortDir?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface CoachReviewBrowseParams {
  symbol?: string
  direction?: 'long' | 'short' | 'all'
  contractType?: 'stock' | 'call' | 'put' | 'all'
  memberId?: string
  memberSearch?: string
  startDate?: string
  endDate?: string
  hasCoachNote?: boolean
  sortBy?: 'trade_date' | 'pnl' | 'created_at'
  sortDir?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface CoachAIGenerateRequest {
  journal_entry_id: string
  coach_preliminary_notes?: string
}

export interface CoachAIGenerateResponse {
  success: boolean
  data: {
    draft: CoachResponsePayload
    market_data_snapshot: CoachMarketDataSnapshot
    tokens_used: number
  }
}

export interface CoachNoteUpdateRequest {
  coach_response?: Partial<CoachResponsePayload>
  internal_notes?: string
}

export interface CoachReviewStatsResponse {
  pending_count: number
  in_review_count: number
  completed_today: number
  completed_this_week: number
  avg_response_hours: number | null
}
