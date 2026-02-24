'use client'

import Image from 'next/image'
import {
  BookOpen,
  Zap,
  Target,
  Lightbulb,
  PenLine,
  BarChart2,
  Activity,
  GitBranch,
  Layers,
  FlipHorizontal,
  Timer,
  Tag,
  ShoppingCart,
  AlertTriangle,
  FileText,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
} from 'lucide-react'
import { AcademyMarkdown } from '@/components/academy-v3/shared/academy-markdown'
import type { AcademyLessonBlock, AcademyBlockType } from '@/lib/academy-v3/contracts/domain'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBlockTypeLabel(blockType: string): string {
  return blockType.replaceAll('_', ' ')
}

function getBlockMarkdown(contentJson: Record<string, unknown>): string {
  if (typeof contentJson['markdown'] === 'string') return contentJson['markdown']
  if (typeof contentJson['body'] === 'string') return contentJson['body']
  if (typeof contentJson['content'] === 'string') return contentJson['content']
  if (typeof contentJson['text'] === 'string') return contentJson['text']
  return ''
}

function getStringField(
  contentJson: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    if (typeof contentJson[key] === 'string' && (contentJson[key] as string).length > 0) {
      return contentJson[key] as string
    }
  }
  return ''
}

function getArrayField<T>(
  contentJson: Record<string, unknown>,
  key: string
): T[] {
  const val = contentJson[key]
  return Array.isArray(val) ? (val as T[]) : []
}

// ---------------------------------------------------------------------------
// Block type metadata
// ---------------------------------------------------------------------------

type BlockMeta = {
  label: string
  colorClasses: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
}

const BLOCK_META: Record<AcademyBlockType, BlockMeta> = {
  hook: {
    label: 'Hook',
    colorClasses: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
    Icon: Zap,
  },
  concept_explanation: {
    label: 'Concept',
    colorClasses: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
    Icon: BookOpen,
  },
  worked_example: {
    label: 'Worked Example',
    colorClasses: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
    Icon: TrendingUp,
  },
  guided_practice: {
    label: 'Guided Practice',
    colorClasses: 'text-sky-300 border-sky-400/30 bg-sky-400/10',
    Icon: Target,
  },
  independent_practice: {
    label: 'Independent Practice',
    colorClasses: 'text-fuchsia-300 border-fuchsia-400/30 bg-fuchsia-400/10',
    Icon: PenLine,
  },
  reflection: {
    label: 'Reflection',
    colorClasses: 'text-zinc-300 border-white/20 bg-white/5',
    Icon: Lightbulb,
  },
  options_chain_simulator: {
    label: 'Options Chain Simulator',
    colorClasses: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
    Icon: BarChart2,
  },
  payoff_diagram_builder: {
    label: 'Payoff Diagram Builder',
    colorClasses: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
    Icon: Activity,
  },
  greeks_dashboard: {
    label: 'Greeks Dashboard',
    colorClasses: 'text-sky-300 border-sky-400/30 bg-sky-400/10',
    Icon: BarChart2,
  },
  trade_scenario_tree: {
    label: 'Trade Scenario Tree',
    colorClasses: 'text-fuchsia-300 border-fuchsia-400/30 bg-fuchsia-400/10',
    Icon: GitBranch,
  },
  strategy_matcher: {
    label: 'Strategy Matcher',
    colorClasses: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
    Icon: Layers,
  },
  position_builder: {
    label: 'Position Builder',
    colorClasses: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
    Icon: Layers,
  },
  flashcard_deck: {
    label: 'Flashcard Deck',
    colorClasses: 'text-sky-300 border-sky-400/30 bg-sky-400/10',
    Icon: FlipHorizontal,
  },
  timed_challenge: {
    label: 'Timed Challenge',
    colorClasses: 'text-rose-300 border-rose-400/30 bg-rose-400/10',
    Icon: Timer,
  },
  market_context_tagger: {
    label: 'Market Context Tagger',
    colorClasses: 'text-sky-300 border-sky-400/30 bg-sky-400/10',
    Icon: Tag,
  },
  order_entry_simulator: {
    label: 'Order Entry Simulator',
    colorClasses: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
    Icon: ShoppingCart,
  },
  what_went_wrong: {
    label: 'What Went Wrong',
    colorClasses: 'text-rose-300 border-rose-400/30 bg-rose-400/10',
    Icon: AlertTriangle,
  },
  journal_prompt: {
    label: 'Journal Prompt',
    colorClasses: 'text-zinc-300 border-white/20 bg-white/5',
    Icon: FileText,
  },
}

const FALLBACK_BLOCK_META: BlockMeta = {
  label: 'Content Block',
  colorClasses: 'text-zinc-300 border-white/20 bg-white/5',
  Icon: BookOpen,
}

// ---------------------------------------------------------------------------
// Block type badge
// ---------------------------------------------------------------------------

function BlockTypeBadge({ blockType }: { blockType: string }) {
  const meta = BLOCK_META[blockType as AcademyBlockType] ?? FALLBACK_BLOCK_META
  const { Icon, label, colorClasses } = meta

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${colorClasses}`}
    >
      <Icon className="h-3 w-3" strokeWidth={1.5} />
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Standard content block (text-rich blocks)
// ---------------------------------------------------------------------------

function StandardContentBlock({
  block,
  onComplete,
}: {
  block: AcademyLessonBlock
  onComplete: (blockId: string) => void
}) {
  const markdown = getBlockMarkdown(block.contentJson)
  const imageUrl = getStringField(block.contentJson, 'imageUrl', 'image_url', 'coverImageUrl')
  const caption = getStringField(block.contentJson, 'caption', 'imageCaption')

  return (
    <div className="space-y-5">
      {imageUrl && (
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0f1117]">
          <div className="relative aspect-[16/9]">
            <Image
              src={imageUrl}
              alt={block.title ?? 'Block image'}
              fill
              className="object-contain p-2"
              sizes="(max-width: 1024px) 100vw, 768px"
            />
          </div>
          {caption && (
            <p className="border-t border-white/10 px-4 py-2 text-center text-xs text-white/50">
              {caption}
            </p>
          )}
        </div>
      )}

      {markdown && (
        <AcademyMarkdown className="academy-markdown-readable">{markdown}</AcademyMarkdown>
      )}

      {!markdown && !imageUrl && (
        <p className="text-sm text-white/50">No content available for this block.</p>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={() => onComplete(block.id)}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25"
        >
          <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
          Mark Complete
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hook block
// ---------------------------------------------------------------------------

function HookBlock({
  block,
  onComplete,
}: {
  block: AcademyLessonBlock
  onComplete: (blockId: string) => void
}) {
  const markdown = getBlockMarkdown(block.contentJson)
  const hook = getStringField(block.contentJson, 'hook', 'hookText', 'prompt')

  return (
    <div className="space-y-5">
      {(hook || markdown) && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
              Consider this...
            </span>
          </div>
          <AcademyMarkdown>{hook || markdown}</AcademyMarkdown>
        </div>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onComplete(block.id)}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          Continue
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Reflection block
// ---------------------------------------------------------------------------

function ReflectionBlock({
  block,
  onComplete,
}: {
  block: AcademyLessonBlock
  onComplete: (blockId: string) => void
}) {
  const prompt = getStringField(block.contentJson, 'prompt', 'question', 'reflectionPrompt')
  const markdown = getBlockMarkdown(block.contentJson)

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/15 bg-white/5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-white/60" strokeWidth={1.5} />
          <span className="text-xs font-semibold uppercase tracking-widest text-white/60">
            Reflect
          </span>
        </div>
        {prompt ? (
          <p className="text-base text-white/85 leading-relaxed">{prompt}</p>
        ) : (
          <AcademyMarkdown>{markdown}</AcademyMarkdown>
        )}
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <label className="mb-2 block text-xs font-medium text-white/50">
          Your notes (optional — not submitted)
        </label>
        <textarea
          className="w-full resize-none rounded-lg border border-white/10 bg-transparent p-3 text-sm text-white/85 placeholder-white/30 outline-none focus:border-emerald-500/40 focus:ring-0"
          rows={4}
          placeholder="Write your thoughts here..."
          aria-label="Reflection notes"
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onComplete(block.id)}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25"
        >
          <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
          Done Reflecting
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Journal prompt block
// ---------------------------------------------------------------------------

function JournalPromptBlock({
  block,
  onComplete,
}: {
  block: AcademyLessonBlock
  onComplete: (blockId: string) => void
}) {
  const prompt = getStringField(block.contentJson, 'prompt', 'journalPrompt', 'question')
  const markdown = getBlockMarkdown(block.contentJson)

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/15 bg-white/5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-white/60" strokeWidth={1.5} />
          <span className="text-xs font-semibold uppercase tracking-widest text-white/60">
            Journal Prompt
          </span>
        </div>
        {prompt ? (
          <p className="text-base text-white/85 leading-relaxed">{prompt}</p>
        ) : (
          <AcademyMarkdown>{markdown}</AcademyMarkdown>
        )}
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <label className="mb-2 block text-xs font-medium text-white/50">
          Your journal entry
        </label>
        <textarea
          className="w-full resize-none rounded-lg border border-white/10 bg-transparent p-3 text-sm text-white/85 placeholder-white/30 outline-none focus:border-emerald-500/40"
          rows={5}
          placeholder="Respond to the prompt..."
          aria-label="Journal entry"
        />
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onComplete(block.id)}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25"
        >
          <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
          Save & Continue
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Flashcard deck block
// ---------------------------------------------------------------------------

function FlashcardDeckBlock({
  block,
  onComplete,
}: {
  block: AcademyLessonBlock
  onComplete: (blockId: string) => void
}) {
  type FlashcardItem = { front?: string; back?: string; term?: string; definition?: string }
  const cards = getArrayField<FlashcardItem>(block.contentJson, 'cards')
  const markdown = getBlockMarkdown(block.contentJson)

  if (cards.length === 0) {
    return (
      <div className="space-y-4">
        {markdown && <AcademyMarkdown>{markdown}</AcademyMarkdown>}
        <InteractivePlaceholder
          block={block}
          instructions="This flashcard deck will let you review key terms and definitions. Use arrow keys or swipe to flip through cards."
          Icon={FlipHorizontal}
          onComplete={onComplete}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card, index) => {
          const front = card.front ?? card.term ?? ''
          const back = card.back ?? card.definition ?? ''
          return (
            <div
              key={index}
              className="rounded-xl border border-white/10 bg-white/5 p-4 hover:border-emerald-500/30 transition-colors"
            >
              <p className="text-sm font-semibold text-white">{front}</p>
              {back && <p className="mt-2 text-sm text-white/60">{back}</p>}
            </div>
          )
        })}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onComplete(block.id)}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25"
        >
          <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
          Complete Review
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Interactive placeholder (for simulator-type blocks)
// ---------------------------------------------------------------------------

function InteractivePlaceholder({
  block,
  instructions,
  Icon,
  onComplete,
}: {
  block: AcademyLessonBlock
  instructions: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  onComplete: (blockId: string) => void
}) {
  const meta = BLOCK_META[block.blockType as AcademyBlockType] ?? FALLBACK_BLOCK_META

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-10 text-center">
        <div className={`rounded-xl border p-4 ${meta.colorClasses}`}>
          <Icon className="h-8 w-8" strokeWidth={1.5} />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-white">{meta.label}</p>
          <p className="max-w-sm text-sm text-white/55 leading-relaxed">{instructions}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/40">
          Interactive module — launching soon
        </span>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onComplete(block.id)}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25"
        >
          <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
          Mark Complete
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Timed challenge block
// ---------------------------------------------------------------------------

function TimedChallengeBlock({
  block,
  onComplete,
}: {
  block: AcademyLessonBlock
  onComplete: (blockId: string) => void
}) {
  const timeLimit = block.contentJson['timeLimitSeconds']
  const timeLimitDisplay =
    typeof timeLimit === 'number'
      ? `${Math.floor(timeLimit / 60)}:${String(timeLimit % 60).padStart(2, '0')}`
      : null
  const markdown = getBlockMarkdown(block.contentJson)

  return (
    <div className="space-y-4">
      {timeLimitDisplay && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-400/20 bg-rose-400/10 px-4 py-2.5">
          <Timer className="h-4 w-4 text-rose-400" strokeWidth={1.5} />
          <span className="text-sm font-semibold text-rose-300">
            Time Limit: {timeLimitDisplay}
          </span>
        </div>
      )}
      {markdown && <AcademyMarkdown>{markdown}</AcademyMarkdown>}
      <InteractivePlaceholder
        block={block}
        instructions="Complete this timed challenge to test your knowledge under time pressure."
        Icon={Timer}
        onComplete={onComplete}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// What Went Wrong block
// ---------------------------------------------------------------------------

function WhatWentWrongBlock({
  block,
  onComplete,
}: {
  block: AcademyLessonBlock
  onComplete: (blockId: string) => void
}) {
  const scenario = getStringField(block.contentJson, 'scenario', 'description', 'tradeScenario')
  const errors = getArrayField<string>(block.contentJson, 'errors')
  const markdown = getBlockMarkdown(block.contentJson)

  return (
    <div className="space-y-5">
      {scenario && (
        <div className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-5">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400" strokeWidth={1.5} />
            <span className="text-xs font-semibold uppercase tracking-widest text-rose-400">
              Scenario
            </span>
          </div>
          <p className="text-sm text-white/85 leading-relaxed">{scenario}</p>
        </div>
      )}

      {errors.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
            Identified Errors
          </p>
          {errors.map((err, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-xs font-semibold text-rose-400">
                {idx + 1}
              </span>
              <p className="text-sm text-white/75">{err}</p>
            </div>
          ))}
        </div>
      )}

      {!scenario && !errors.length && markdown && <AcademyMarkdown>{markdown}</AcademyMarkdown>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onComplete(block.id)}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25"
        >
          <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
          Understood
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main block renderer
// ---------------------------------------------------------------------------

export interface AcademyBlockRendererProps {
  block: AcademyLessonBlock
  onComplete: (blockId: string) => void
  isCompleted?: boolean
}

export function AcademyBlockRenderer({
  block,
  onComplete,
  isCompleted = false,
}: AcademyBlockRendererProps) {
  const meta = BLOCK_META[block.blockType as AcademyBlockType] ?? FALLBACK_BLOCK_META

  return (
    <div className="space-y-4">
      {/* Block header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <BlockTypeBadge blockType={block.blockType} />
        {isCompleted && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-400">
            <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} />
            Completed
          </span>
        )}
      </div>

      {block.title && (
        <h3 className="text-lg font-semibold text-white leading-snug">{block.title}</h3>
      )}

      {/* Block body — dispatches by blockType */}
      {block.blockType === 'hook' && (
        <HookBlock block={block} onComplete={onComplete} />
      )}

      {block.blockType === 'reflection' && (
        <ReflectionBlock block={block} onComplete={onComplete} />
      )}

      {block.blockType === 'journal_prompt' && (
        <JournalPromptBlock block={block} onComplete={onComplete} />
      )}

      {block.blockType === 'flashcard_deck' && (
        <FlashcardDeckBlock block={block} onComplete={onComplete} />
      )}

      {block.blockType === 'timed_challenge' && (
        <TimedChallengeBlock block={block} onComplete={onComplete} />
      )}

      {block.blockType === 'what_went_wrong' && (
        <WhatWentWrongBlock block={block} onComplete={onComplete} />
      )}

      {(block.blockType === 'concept_explanation' ||
        block.blockType === 'worked_example' ||
        block.blockType === 'guided_practice' ||
        block.blockType === 'independent_practice') && (
        <StandardContentBlock block={block} onComplete={onComplete} />
      )}

      {/* Interactive simulator blocks — placeholder renderers */}
      {block.blockType === 'options_chain_simulator' && (
        <InteractivePlaceholder
          block={block}
          instructions="Explore a live-style options chain. Select strikes, expiries, and strategies to see how pricing and greeks change in real time."
          Icon={meta.Icon}
          onComplete={onComplete}
        />
      )}

      {block.blockType === 'payoff_diagram_builder' && (
        <InteractivePlaceholder
          block={block}
          instructions="Build and visualize strategy payoff diagrams. Add legs to see P&L curves at expiration across a range of underlying prices."
          Icon={meta.Icon}
          onComplete={onComplete}
        />
      )}

      {block.blockType === 'greeks_dashboard' && (
        <InteractivePlaceholder
          block={block}
          instructions="Interact with a live Greeks dashboard. Adjust delta, gamma, theta, vega, and rho sliders to understand sensitivity in real time."
          Icon={meta.Icon}
          onComplete={onComplete}
        />
      )}

      {block.blockType === 'trade_scenario_tree' && (
        <InteractivePlaceholder
          block={block}
          instructions="Navigate a branching trade scenario. Your decisions at each node determine the outcome — think through your plan before acting."
          Icon={meta.Icon}
          onComplete={onComplete}
        />
      )}

      {block.blockType === 'strategy_matcher' && (
        <InteractivePlaceholder
          block={block}
          instructions="Match market conditions to optimal options strategies. Drag-and-drop setups into the correct market regime categories."
          Icon={meta.Icon}
          onComplete={onComplete}
        />
      )}

      {block.blockType === 'position_builder' && (
        <InteractivePlaceholder
          block={block}
          instructions="Construct multi-leg positions from scratch. Add calls, puts, and stock to build spreads, condors, straddles, and more."
          Icon={meta.Icon}
          onComplete={onComplete}
        />
      )}

      {block.blockType === 'market_context_tagger' && (
        <InteractivePlaceholder
          block={block}
          instructions="Tag a set of market conditions using the correct regime labels. Identify volatility environment, trend, and skew characteristics."
          Icon={meta.Icon}
          onComplete={onComplete}
        />
      )}

      {block.blockType === 'order_entry_simulator' && (
        <InteractivePlaceholder
          block={block}
          instructions="Practice entering orders in a simulated broker interface. Select order type, quantity, and limit price with full feedback on execution."
          Icon={meta.Icon}
          onComplete={onComplete}
        />
      )}
    </div>
  )
}
