'use client'

import { useMemo } from 'react'
import type { ChatMessageResponse } from '@/lib/api/ai-coach'

type FunctionCall = NonNullable<ChatMessageResponse['functionCalls']>[number]

type FollowUpChip = {
  label: string
  prompt: string
}

const SYMBOL_PATTERN = /\b[A-Z]{2,5}\b/g
const SYMBOL_BLACKLIST = new Set([
  'THE', 'WITH', 'FROM', 'THIS', 'THAT', 'YOUR', 'WHAT', 'WHEN', 'OPEN', 'CLOSE', 'RISK', 'PLAN',
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
  return firstSymbol || 'SPX'
}

function buildFollowUps(
  content: string,
  functionCalls?: ChatMessageResponse['functionCalls'],
): FollowUpChip[] {
  const lower = content.toLowerCase()
  const symbol = extractPrimarySymbol(content, functionCalls)
  const calledFunctions = new Set((functionCalls || []).map((call) => call.function))

  const mentionsLevels = calledFunctions.has('get_key_levels')
    || /pdh|pdl|pivot|support|resistance|vwap|key level/.test(lower)
  const mentionsOptions = calledFunctions.has('get_options_chain')
    || calledFunctions.has('get_gamma_exposure')
    || calledFunctions.has('get_zero_dte_analysis')
    || calledFunctions.has('get_iv_analysis')
    || /options|greeks|implied vol|iv|gamma|delta|theta|vega/.test(lower)
  const mentionsSPX = /\bspx\b/.test(lower) || symbol === 'SPX'

  const candidates: FollowUpChip[] = []

  if (mentionsSPX) {
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
