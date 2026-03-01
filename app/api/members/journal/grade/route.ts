import { NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { errorResponse, successResponse } from '@/lib/api/response'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { aiTradeAnalysisSchema, gradeEntriesSchema, sanitizeString } from '@/lib/validation/journal-entry'
import type { AITradeAnalysis } from '@/lib/types/journal'

interface GradeCandidate {
  id: string
  symbol: string
  direction: 'long' | 'short'
  entry_price: number | null
  exit_price: number | null
  position_size: number | null
  pnl: number | null
  pnl_percentage: number | null
  stop_loss: number | null
  initial_target: number | null
  setup_notes: string | null
  execution_notes: string | null
  lessons_learned: string | null
  setup_type?: string | null
  followed_plan: boolean | null
  discipline_score: number | null
}

interface HistoricalContext {
  symbolWinRate: number | null
  symbolAvgPnl: number | null
  symbolTradeCount: number
  recentStreak: 'winning' | 'losing' | 'mixed'
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toGradeCandidate(value: Record<string, unknown>): GradeCandidate | null {
  if (
    typeof value.id !== 'string'
    || typeof value.symbol !== 'string'
    || (value.direction !== 'long' && value.direction !== 'short')
  ) {
    return null
  }

  return {
    id: value.id,
    symbol: value.symbol,
    direction: value.direction,
    entry_price: toNumber(value.entry_price),
    exit_price: toNumber(value.exit_price),
    position_size: toNumber(value.position_size),
    pnl: toNumber(value.pnl),
    pnl_percentage: toNumber(value.pnl_percentage),
    stop_loss: toNumber(value.stop_loss),
    initial_target: toNumber(value.initial_target),
    setup_notes: typeof value.setup_notes === 'string' ? value.setup_notes : null,
    execution_notes: typeof value.execution_notes === 'string' ? value.execution_notes : null,
    lessons_learned: typeof value.lessons_learned === 'string' ? value.lessons_learned : null,
    setup_type: typeof value.setup_type === 'string' ? value.setup_type : null,
    followed_plan: typeof value.followed_plan === 'boolean' ? value.followed_plan : null,
    discipline_score: toNumber(value.discipline_score),
  }
}

function buildHeuristicAnalysis(entry: GradeCandidate): AITradeAnalysis {
  const pnl = entry.pnl ?? 0
  const pnlPct = entry.pnl_percentage ?? 0

  let grade: AITradeAnalysis['grade'] = 'C'
  if (pnl > 0 && pnlPct > 1) grade = 'A'
  else if (pnl > 0) grade = 'B'
  else if (pnl < 0 && pnlPct < -2) grade = 'D'
  else if (pnl < 0) grade = 'C'

  const entryQuality = entry.setup_notes?.trim().length
    ? 'Entry rationale was documented and usable for review.'
    : 'Entry rationale is missing; document setup triggers before execution.'

  const exitQuality = entry.execution_notes?.trim().length
    ? 'Exit execution notes are present and support post-trade review.'
    : 'Exit rationale is thin; note why the position was closed.'

  const riskManagement = (entry.stop_loss != null && entry.initial_target != null)
    ? 'Risk framing included both stop and target levels.'
    : 'Risk framework is incomplete; define stop and target before taking the trade.'

  const lessons = [
    entry.lessons_learned?.trim() || 'Keep position sizing consistent with account risk.',
    pnl >= 0
      ? 'Repeat setups with strong process adherence.'
      : 'Reduce size after consecutive losses and wait for high-conviction setups.',
  ]

  return {
    grade,
    entry_quality: sanitizeString(entryQuality, 500),
    exit_quality: sanitizeString(exitQuality, 500),
    risk_management: sanitizeString(riskManagement, 500),
    lessons: lessons
      .map((lesson) => sanitizeString(lesson, 200))
      .filter((lesson) => lesson.length > 0)
      .slice(0, 5),
    scored_at: new Date().toISOString(),
  }
}

async function requestAIAnalysis(entry: GradeCandidate, history?: HistoricalContext): Promise<AITradeAnalysis | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You grade trade journal entries with historical context. Return strict JSON with keys: grade (A-F), entry_quality (string, max 500 chars), exit_quality (string, max 500 chars), risk_management (string, max 500 chars), lessons (array of strings, max 5 items, each max 200 chars), scored_at (ISO datetime string). Grade holistically: A = excellent process AND outcome, B = good process, C = average, D = poor process, F = reckless. Factor in plan adherence, risk management, and pattern recognition from historical context.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              trade: {
                symbol: entry.symbol,
                direction: entry.direction,
                entry_price: entry.entry_price,
                exit_price: entry.exit_price,
                position_size: entry.position_size,
                pnl: entry.pnl,
                pnl_percentage: entry.pnl_percentage,
                stop_loss: entry.stop_loss,
                initial_target: entry.initial_target,
                setup_type: entry.setup_type,
                followed_plan: entry.followed_plan,
                discipline_score: entry.discipline_score,
                setup_notes: entry.setup_notes,
                execution_notes: entry.execution_notes,
                lessons_learned: entry.lessons_learned,
              },
              history: history ?? null,
            }),
          },
        ],
      }),
    })

    if (!response.ok) {
      console.error('OpenAI grade request failed with status', response.status)
      return null
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string | null } }>
    }

    const content = payload.choices?.[0]?.message?.content
    if (!content) return null

    const parsedJson = JSON.parse(content) as unknown
    const parsed = aiTradeAnalysisSchema.safeParse(parsedJson)
    if (!parsed.success) return null

    return {
      ...parsed.data,
      entry_quality: sanitizeString(parsed.data.entry_quality, 500),
      exit_quality: sanitizeString(parsed.data.exit_quality, 500),
      risk_management: sanitizeString(parsed.data.risk_management, 500),
      lessons: parsed.data.lessons
        .map((lesson) => sanitizeString(lesson, 200))
        .filter((lesson) => lesson.length > 0)
        .slice(0, 5),
    }
  } catch (error) {
    console.error('OpenAI grade request failed:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return errorResponse('Unauthorized', 401)

  try {
    const validated = gradeEntriesSchema.parse(await request.json())

    const { data: rows, error } = await supabase
      .from('journal_entries')
      .select('id,symbol,direction,entry_price,exit_price,position_size,pnl,pnl_percentage,stop_loss,initial_target,setup_notes,execution_notes,lessons_learned,followed_plan,discipline_score')
      .eq('user_id', user.id)
      .in('id', validated.entryIds)

    if (error) {
      console.error('Failed to load entries for grading:', error)
      return errorResponse('Failed to load entries for grading', 500)
    }

    const candidates = (rows ?? [])
      .map((row) => toGradeCandidate(row as Record<string, unknown>))
      .filter((row): row is GradeCandidate => Boolean(row))

    const gradedResults: Array<{ entryId: string, grade: AITradeAnalysis, ai_analysis: AITradeAnalysis }> = []

    // Fetch historical context for each unique symbol
    const symbolHistoryCache = new Map<string, HistoricalContext>()
    const uniqueSymbols: string[] = Array.from(new Set(candidates.map((c: GradeCandidate) => c.symbol)))

    for (const sym of uniqueSymbols) {
      const { data: symTrades } = await supabase
        .from('journal_entries')
        .select('pnl')
        .eq('user_id', user.id)
        .ilike('symbol', sym)
        .not('pnl', 'is', null)
        .order('trade_date', { ascending: false })
        .limit(20)

      const pnls = (symTrades ?? []).map((r) => typeof (r as Record<string, unknown>).pnl === 'number' ? (r as Record<string, unknown>).pnl as number : null).filter((p): p is number => p != null)

      const wins = pnls.filter((p) => p > 0).length
      const last3 = pnls.slice(0, 3)
      const streak: 'winning' | 'losing' | 'mixed' = last3.length >= 2 && last3.every((p) => p > 0) ? 'winning' : last3.length >= 2 && last3.every((p) => p < 0) ? 'losing' : 'mixed'

      symbolHistoryCache.set(sym, {
        symbolWinRate: pnls.length > 0 ? Math.round((wins / pnls.length) * 10000) / 100 : null,
        symbolAvgPnl: pnls.length > 0 ? Math.round((pnls.reduce((s, p) => s + p, 0) / pnls.length) * 100) / 100 : null,
        symbolTradeCount: pnls.length,
        recentStreak: streak,
      })
    }

    for (const entry of candidates) {
      const history = symbolHistoryCache.get(entry.symbol)
      const aiResult = await requestAIAnalysis(entry, history)
      const analysis = aiResult ?? buildHeuristicAnalysis(entry)

      const parsed = aiTradeAnalysisSchema.safeParse(analysis)
      if (!parsed.success) {
        console.error('Grade validation failed for entry:', entry.id)
        continue
      }

      const { error: updateError } = await supabase
        .from('journal_entries')
        .update({ ai_analysis: parsed.data })
        .eq('id', entry.id)
        .eq('user_id', user.id)

      if (updateError) {
        console.error('Failed to store AI analysis:', updateError)
        continue
      }

      gradedResults.push({
        entryId: entry.id,
        grade: parsed.data,
        ai_analysis: parsed.data,
      })
    }

    return successResponse(gradedResults)
  } catch (error) {
    if (error instanceof ZodError) {
      return errorResponse('Invalid request', 400, error.flatten())
    }

    console.error('Journal grade route failed:', error)
    return errorResponse('Internal server error', 500)
  }
}
