'use client'

import { useMemo } from 'react'
import type { ChatMessageResponse } from '@/lib/api/ai-coach'
import { getActiveChartSymbol } from '@/lib/ai-coach-chart-context'

type FunctionCall = NonNullable<ChatMessageResponse['functionCalls']>[number]

type FollowUpChip = {
  label: string
  prompt: string
}

const SYMBOL_PATTERN = /\b[A-Z]{2,5}\b/g
const SYMBOL_BLACKLIST = new Set([
  'THE', 'WITH', 'FROM', 'THIS', 'THAT', 'YOUR', 'WHAT', 'WHEN', 'OPEN', 'CLOSE', 'RISK', 'PLAN',
  'HERE', 'THERE', 'THESE', 'THOSE',
])

function extractPrimarySymbol(
  content: string,
  functionCalls?: ChatMessageResponse['functionCalls'],
): string {
  if (functionCalls) {
    for (const call of functionCalls) {
      const fromArgs = call.arguments?.symbol
      if (typeof fromArgs === 'string' && /^[A-Z0-9._:-]{1,10}$/.test(fromArgs.toUpperCase())) {
        return fromArgs.toUpperCase()
      }

      const result = call.result
      if (result && typeof result === 'object' && 'symbol' in result) {
        const value = (result as { symbol?: unknown }).symbol
        if (typeof value === 'string' && /^[A-Z0-9._:-]{1,10}$/.test(value.toUpperCase())) {
          return value.toUpperCase()
        }
      }
    }
  }

  const matches = content.toUpperCase().match(SYMBOL_PATTERN) || []
  const firstSymbol = matches.find((candidate) => !SYMBOL_BLACKLIST.has(candidate))
  return firstSymbol || getActiveChartSymbol('SPX')
}

function hasSchemaField(content: string, fieldPattern: string): boolean {
  return new RegExp(
    `(?:^|\\n|\\r)\\s*(?:[#>*-]|\\d+[.)])?\\s*\\*{0,2}${fieldPattern}\\*{0,2}(?:\\s*[:\\-]|\\b)`,
    'im',
  ).test(content)
}

function hasStructuredTradeSchema(content: string): boolean {
  const fields = [
    'bias',
    'setup',
    'entry',
    'stop(?:\\s*\\/\\s*invalidation)?',
    'targets?',
    'invalidation',
    'risk',
    'confidence',
  ]
  return fields.every((field) => hasSchemaField(content, field))
}

function isLowConfidenceResponse(content: string): boolean {
  const confidencePctMatch = content.match(/confidence[^\d]{0,20}(\d{1,3})\s?%/i)
  if (confidencePctMatch) {
    const confidencePct = Number.parseInt(confidencePctMatch[1], 10)
    if (Number.isFinite(confidencePct) && confidencePct <= 59) return true
  }

  return /confidence[^a-z]{0,20}low\b/i.test(content) || /\blow confidence\b/i.test(content)
}
export function buildFollowUps(
  content: string,
  functionCalls?: ChatMessageResponse['functionCalls'],
): FollowUpChip[] {
  const lower = content.toLowerCase()
  const symbol = extractPrimarySymbol(content, functionCalls)
  const calledFunctions = new Set((functionCalls || []).map((call) => call.function))
  const hasTradeSchema = hasStructuredTradeSchema(content)
  const hasLowConfidence = isLowConfidenceResponse(content)

  const mentionsLevels = calledFunctions.has('get_key_levels')
    || /pdh|pdl|pivot|support|resistance|vwap|key level/.test(lower)
  const mentionsOptions = calledFunctions.has('get_options_chain')
    || calledFunctions.has('get_gamma_exposure')
    || calledFunctions.has('get_zero_dte_analysis')
    || calledFunctions.has('get_iv_analysis')
    || /options|greeks|implied vol|iv|gamma|delta|theta|vega/.test(lower)

  const candidates: FollowUpChip[] = []

  if (hasTradeSchema) {
    if (hasLowConfidence) {
      candidates.push({
        label: 'Clarify Before Commit',
        prompt: `Confidence is low on this ${symbol} plan. Ask me 3 clarifying questions (timeframe, risk budget, trigger style) before finalizing the setup.`,
      })
    }

    candidates.push(
      {
        label: 'Refine Entry',
        prompt: `Refine the ${symbol} entry zone from this plan using current volatility and confirmation rules.`,
      },
      {
        label: 'Stress-Test Stop',
        prompt: `Stress-test the ${symbol} stop: show where this stop fails in normal noise and propose one tighter and one wider alternative.`,
      },
      {
        label: 'Adjust Targets',
        prompt: `Recalculate ${symbol} targets (T1/T2) using current ATR and nearest structure levels.`,
      },
      {
        label: 'Position-Size Check',
        prompt: `Convert this ${symbol} plan into position sizing: define max loss, contracts/shares, and slippage-adjusted risk.`,
      },
      {
        label: 'Invalidation Drill',
        prompt: `Walk through the ${symbol} invalidation path step-by-step and tell me what should happen immediately after invalidation.`,
      },
    )
  }

  if (symbol === 'SPX') {
    candidates.push(
      {
        label: 'Explain SPX Simply',
        prompt: 'Explain the SPX context in plain English: trend, nearest support/resistance, and what would invalidate the current idea.',
      },
      {
        label: 'SPX Game Plan',
        prompt: 'Give me the full SPX game plan with key levels, bull and bear triggers, and show it on the chart.',
      },
    )
  } else if (symbol) {
    candidates.push(
      {
        label: `${symbol} Quick Read`,
        prompt: `Explain the ${symbol} context in plain English: trend, nearest support/resistance, and what would invalidate the current idea.`,
      },
      {
        label: `${symbol} Plan`,
        prompt: `Give me a clear ${symbol} plan with key levels, one bull trigger, one bear trigger, and show it on the chart.`,
      },
    )
  }

  if (mentionsLevels) {
    candidates.push(
      {
        label: 'Show on Chart',
        prompt: `Show ${symbol} on the chart and map PDH, PDL, pivot, and VWAP with a quick setup read.`,
      },
      {
        label: 'Explain Levels',
        prompt: `Explain the ${symbol} key levels in plain language and tell me what each level means for risk.`,
      },
      {
        label: 'Build Risk Plan',
        prompt: `Build a simple risk plan for trading ${symbol} around these levels: entry trigger, invalidation, and max loss.`,
      },
    )
  }

  if (mentionsOptions) {
    candidates.push(
      {
        label: 'View Options Chain',
        prompt: `Show the ${symbol} options chain around ATM and summarize the important strikes, flow, and IV context.`,
      },
      {
        label: 'Explain Greeks',
        prompt: `Explain delta, gamma, theta, and IV for this ${symbol} setup in plain language and what to monitor next.`,
      },
    )
  }

  if (candidates.length === 0) {
    candidates.push(
      {
        label: 'Explain in Plain English',
        prompt: `Explain this ${symbol} setup in plain English, then show the chart with the most important levels.`,
      },
      {
        label: 'Show Chart',
        prompt: `Show ${symbol} on the chart and give me a quick read of trend, levels, and key triggers.`,
      },
      {
        label: 'Risk Checklist',
        prompt: `Give me a beginner risk checklist before trading ${symbol} today.`,
      },
    )
  }

  const deduped = new Map<string, FollowUpChip>()
  for (const chip of candidates) {
    if (!deduped.has(chip.label)) {
      deduped.set(chip.label, chip)
    }
  }

  return Array.from(deduped.values()).slice(0, 3)
}

export function FollowUpChips({
  content,
  functionCalls,
  onSelect,
}: {
  content: string
  functionCalls?: ChatMessageResponse['functionCalls']
  onSelect: (prompt: string) => void
}) {
  const chips = useMemo(() => buildFollowUps(content, functionCalls), [content, functionCalls])

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mt-2" role="group" aria-label="Suggested follow-ups">
      {chips.map((chip) => (
        <button
          key={chip.label}
          onClick={() => onSelect(chip.prompt)}
          className="text-xs px-2.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors"
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
}
