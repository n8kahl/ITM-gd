import { z } from 'zod'

export interface TradeGradeDimension {
  grade: string
  score: number
  feedback: string
}

export interface TradeGradeResult {
  overall_grade: string
  score: number
  dimensions: {
    setup: TradeGradeDimension
    execution: TradeGradeDimension
    risk: TradeGradeDimension
    outcome: TradeGradeDimension
  }
  improvement_tips: string[]
  pattern_flags: string[]
  graded_at: string
  model: string
}

export interface TradeGradeInput {
  symbol?: string | null
  direction?: 'long' | 'short' | 'neutral' | null
  entry_price?: number | null
  exit_price?: number | null
  stop_loss?: number | null
  initial_target?: number | null
  pnl?: number | null
  pnl_percentage?: number | null
  mfe_percent?: number | null
  mae_percent?: number | null
  setup_notes?: string | null
  execution_notes?: string | null
  lessons_learned?: string | null
  strategy?: string | null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function scoreToGrade(score: number): string {
  if (score >= 97) return 'A+'
  if (score >= 93) return 'A'
  if (score >= 90) return 'A-'
  if (score >= 87) return 'B+'
  if (score >= 83) return 'B'
  if (score >= 80) return 'B-'
  if (score >= 77) return 'C+'
  if (score >= 73) return 'C'
  if (score >= 70) return 'C-'
  if (score >= 67) return 'D+'
  if (score >= 63) return 'D'
  if (score >= 60) return 'D-'
  return 'F'
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

const OPENAI_TIMEOUT_MS = 15_000
const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions'

const gptDimensionSchema = z.object({
  grade: z.string().min(1).max(4),
  score: z.number().min(0).max(100),
  feedback: z.string().min(1).max(2_000),
})

const gptGradeResultSchema = z.object({
  overall_grade: z.string().min(1).max(4),
  score: z.number().min(0).max(100),
  dimensions: z.object({
    setup: gptDimensionSchema,
    execution: gptDimensionSchema,
    risk: gptDimensionSchema,
    outcome: gptDimensionSchema,
  }),
  improvement_tips: z.array(z.string().min(1).max(500)).max(10),
  pattern_flags: z.array(z.string().min(1).max(100)).max(20),
})

function normalizeGPTGrade(result: z.infer<typeof gptGradeResultSchema>): TradeGradeResult {
  return {
    overall_grade: result.overall_grade,
    score: round2(clamp(result.score, 0, 100)),
    dimensions: {
      setup: {
        ...result.dimensions.setup,
        score: round2(clamp(result.dimensions.setup.score, 0, 100)),
      },
      execution: {
        ...result.dimensions.execution,
        score: round2(clamp(result.dimensions.execution.score, 0, 100)),
      },
      risk: {
        ...result.dimensions.risk,
        score: round2(clamp(result.dimensions.risk.score, 0, 100)),
      },
      outcome: {
        ...result.dimensions.outcome,
        score: round2(clamp(result.dimensions.outcome.score, 0, 100)),
      },
    },
    improvement_tips: result.improvement_tips,
    pattern_flags: result.pattern_flags,
    graded_at: new Date().toISOString(),
    model: 'gpt-4o',
  }
}

async function gradeTradeWithGPT(input: TradeGradeInput, apiKey: string): Promise<TradeGradeResult> {
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS)

  try {
    const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.2,
        tool_choice: {
          type: 'function',
          function: {
            name: 'grade_trade',
          },
        },
        tools: [
          {
            type: 'function',
            function: {
              name: 'grade_trade',
              description: 'Return a structured trade grade assessment.',
              parameters: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  overall_grade: {
                    type: 'string',
                    description: 'Letter grade from A+ through F',
                  },
                  score: {
                    type: 'number',
                    minimum: 0,
                    maximum: 100,
                  },
                  dimensions: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      setup: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                          grade: { type: 'string' },
                          score: { type: 'number', minimum: 0, maximum: 100 },
                          feedback: { type: 'string' },
                        },
                        required: ['grade', 'score', 'feedback'],
                      },
                      execution: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                          grade: { type: 'string' },
                          score: { type: 'number', minimum: 0, maximum: 100 },
                          feedback: { type: 'string' },
                        },
                        required: ['grade', 'score', 'feedback'],
                      },
                      risk: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                          grade: { type: 'string' },
                          score: { type: 'number', minimum: 0, maximum: 100 },
                          feedback: { type: 'string' },
                        },
                        required: ['grade', 'score', 'feedback'],
                      },
                      outcome: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                          grade: { type: 'string' },
                          score: { type: 'number', minimum: 0, maximum: 100 },
                          feedback: { type: 'string' },
                        },
                        required: ['grade', 'score', 'feedback'],
                      },
                    },
                    required: ['setup', 'execution', 'risk', 'outcome'],
                  },
                  improvement_tips: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                  pattern_flags: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
                required: ['overall_grade', 'score', 'dimensions', 'improvement_tips', 'pattern_flags'],
              },
            },
          },
        ],
        messages: [
          {
            role: 'system',
            content: [
              'You are an expert trading performance coach.',
              'Grade each trade based on setup quality, risk management, execution quality, discipline, and psychology.',
              'Use only the supplied trade context.',
              'Be specific in the feedback, concise in tips, and objective in scores.',
            ].join(' '),
          },
          {
            role: 'user',
            content: JSON.stringify({
              instruction: 'Grade this trade and call the grade_trade function with your structured result.',
              trade_context: input,
            }),
          },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI request failed with status ${response.status}`)
    }

    const payload = await response.json() as {
      choices?: Array<{
        message?: {
          tool_calls?: Array<{
            type?: string
            function?: {
              name?: string
              arguments?: string
            }
          }>
        }
      }>
    }

    const toolCall = payload.choices?.[0]?.message?.tool_calls?.find(
      (call) => call.type === 'function' && call.function?.name === 'grade_trade',
    )
    const rawArguments = toolCall?.function?.arguments
    if (!rawArguments) {
      throw new Error('Missing grade_trade function response')
    }

    const parsedArguments = JSON.parse(rawArguments) as unknown
    const validated = gptGradeResultSchema.parse(parsedArguments)
    return normalizeGPTGrade(validated)
  } finally {
    clearTimeout(timeoutHandle)
  }
}

function buildSetupDimension(input: TradeGradeInput): TradeGradeDimension {
  let score = 55
  if (input.symbol) score += 8
  if (input.strategy) score += 8
  if (input.entry_price != null && input.direction) score += 10
  if (input.setup_notes && input.setup_notes.trim().length > 24) score += 14
  if (input.stop_loss != null && input.initial_target != null) score += 8

  score = clamp(score, 0, 100)

  let feedback = 'Setup quality needs clearer structure.'
  if (score >= 85) {
    feedback = 'Setup details are well-defined with clear pre-trade intent.'
  } else if (score >= 70) {
    feedback = 'Setup is reasonable but lacks one or two high-quality planning details.'
  }

  return {
    score: round2(score),
    grade: scoreToGrade(score),
    feedback,
  }
}

function buildExecutionDimension(input: TradeGradeInput): TradeGradeDimension {
  let score = 50
  if (input.entry_price != null && input.exit_price != null) score += 20
  if (input.execution_notes && input.execution_notes.trim().length > 24) score += 10

  if (input.mfe_percent != null && input.pnl_percentage != null && input.mfe_percent > 0) {
    const efficiency = input.pnl_percentage / input.mfe_percent
    if (efficiency >= 0.75) score += 20
    else if (efficiency >= 0.5) score += 14
    else if (efficiency >= 0.25) score += 8
    else score -= 6
  } else {
    score += 5
  }

  if (input.mae_percent != null && input.mfe_percent != null && input.mae_percent > input.mfe_percent) {
    score -= 10
  }

  score = clamp(score, 0, 100)

  let feedback = 'Execution timing left measurable edge on the table.'
  if (score >= 85) {
    feedback = 'Execution captured a strong share of available move and respected structure.'
  } else if (score >= 70) {
    feedback = 'Execution was solid but can improve around entry/exit timing consistency.'
  }

  return {
    score: round2(score),
    grade: scoreToGrade(score),
    feedback,
  }
}

function buildRiskDimension(input: TradeGradeInput): TradeGradeDimension {
  let score = 45
  if (input.stop_loss != null) score += 25
  if (input.initial_target != null) score += 10
  if (input.stop_loss != null && input.initial_target != null && input.entry_price != null && input.direction) {
    const risk = input.direction === 'long'
      ? Math.abs(input.entry_price - input.stop_loss)
      : Math.abs(input.stop_loss - input.entry_price)
    const reward = input.direction === 'long'
      ? Math.abs(input.initial_target - input.entry_price)
      : Math.abs(input.entry_price - input.initial_target)
    if (risk > 0) {
      const ratio = reward / risk
      if (ratio >= 2) score += 20
      else if (ratio >= 1.2) score += 12
      else score -= 6
    }
  }
  if (input.mae_percent != null && input.mae_percent > 2.5) score -= 8

  score = clamp(score, 0, 100)

  let feedback = 'Risk controls were incomplete or loosely defined.'
  if (score >= 85) {
    feedback = 'Risk management was disciplined with favorable risk-reward structure.'
  } else if (score >= 70) {
    feedback = 'Risk handling is mostly sound with room to tighten stop and target precision.'
  }

  return {
    score: round2(score),
    grade: scoreToGrade(score),
    feedback,
  }
}

function buildOutcomeDimension(input: TradeGradeInput): TradeGradeDimension {
  let score = 55
  const pnl = input.pnl ?? null
  const pnlPct = input.pnl_percentage ?? null

  if (pnl != null) {
    if (pnl > 0) score += 20
    else if (pnl < 0) score -= 12
  }
  if (pnlPct != null) {
    if (pnlPct > 0.8) score += 12
    else if (pnlPct > 0) score += 6
    else if (pnlPct < -1) score -= 10
  }
  if (input.lessons_learned && input.lessons_learned.trim().length > 24) score += 10

  score = clamp(score, 0, 100)

  let feedback = 'Outcome suggests weak edge capture or poor post-trade reflection.'
  if (score >= 85) {
    feedback = 'Outcome aligns well with plan quality and shows strong edge realization.'
  } else if (score >= 70) {
    feedback = 'Outcome is acceptable with opportunities to improve consistency and review quality.'
  }

  return {
    score: round2(score),
    grade: scoreToGrade(score),
    feedback,
  }
}

/**
 * Grades a trade using the deterministic local scoring model.
 */
export function gradeTradeRuleBased(input: TradeGradeInput): TradeGradeResult {
  const setup = buildSetupDimension(input)
  const execution = buildExecutionDimension(input)
  const risk = buildRiskDimension(input)
  const outcome = buildOutcomeDimension(input)

  const weightedScore = (
    setup.score * 0.25
    + execution.score * 0.25
    + risk.score * 0.25
    + outcome.score * 0.25
  )

  const rounded = round2(weightedScore)
  const tips: string[] = []
  const flags: string[] = []

  if (input.stop_loss == null) {
    tips.push('Define a stop-loss before entry to improve R-multiple consistency.')
    flags.push('missing_stop_loss')
  }
  if (input.initial_target == null) {
    tips.push('Set a target before entry to improve reward/risk decision quality.')
    flags.push('missing_target')
  }
  if (input.mfe_percent != null && input.pnl_percentage != null && input.mfe_percent > 0) {
    const efficiency = input.pnl_percentage / input.mfe_percent
    if (efficiency < 0.35) {
      tips.push('You captured less than 35% of available move; review exit timing rules.')
      flags.push('low_mfe_efficiency')
    }
  }
  if (input.mae_percent != null && input.mae_percent > 3) {
    tips.push('Adverse excursion was high; tighten invalidation level or reduce size.')
    flags.push('high_mae')
  }
  if (!tips.length) {
    tips.push('Maintain current process and review this setup for repeatability.')
  }

  return {
    overall_grade: scoreToGrade(rounded),
    score: rounded,
    dimensions: {
      setup,
      execution,
      risk,
      outcome,
    },
    improvement_tips: tips,
    pattern_flags: flags,
    graded_at: new Date().toISOString(),
    model: 'rule-based-v1-fallback',
  }
}

/**
 * Grades a trade with GPT-4o function calling and falls back to the local model when unavailable.
 */
export async function gradeTrade(input: TradeGradeInput): Promise<TradeGradeResult> {
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    return gradeTradeRuleBased(input)
  }

  try {
    return await gradeTradeWithGPT(input, openaiApiKey)
  } catch {
    return gradeTradeRuleBased(input)
  }
}
