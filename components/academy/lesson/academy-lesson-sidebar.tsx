'use client'

import {
  CheckCircle2,
  Circle,
  Target,
  Clock,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Block type display helpers
// ---------------------------------------------------------------------------

function formatBlockTypeLabel(blockType: string): string {
  return blockType.replaceAll('_', ' ')
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SidebarBlock {
  id: string
  blockType: string
  title?: string
  completed: boolean
}

export interface LessonSidebarProps {
  blocks: SidebarBlock[]
  currentBlockId: string
  onBlockSelect: (blockId: string) => void
  objectives: string[]
  estimatedMinutes: number
  isOpen: boolean
  onToggle: () => void
}

// ---------------------------------------------------------------------------
// Time remaining estimate
// ---------------------------------------------------------------------------

function estimateRemainingMinutes(
  blocks: SidebarBlock[],
  currentBlockId: string,
  totalMinutes: number
): number {
  if (blocks.length === 0) return totalMinutes

  const currentIndex = blocks.findIndex((b) => b.id === currentBlockId)
  if (currentIndex < 0) return totalMinutes

  const completedCount = blocks.filter((b) => b.completed).length
  const remainingBlocks = blocks.length - completedCount
  const minutesPerBlock = totalMinutes / blocks.length

  return Math.max(0, Math.round(remainingBlocks * minutesPerBlock))
}

// ---------------------------------------------------------------------------
// Sidebar outline item
// ---------------------------------------------------------------------------

function SidebarBlockItem({
  block,
  isActive,
  onClick,
  index,
}: {
  block: SidebarBlock
  isActive: boolean
  onClick: () => void
  index: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'true' : undefined}
      className={`group w-full rounded-lg border px-3 py-2.5 text-left transition-all ${
        isActive
          ? 'border-emerald-500/40 bg-emerald-500/10'
          : block.completed
            ? 'border-white/10 bg-white/[0.03] hover:border-white/15 hover:bg-white/5'
            : 'border-transparent hover:border-white/10 hover:bg-white/[0.03]'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0">
          {block.completed ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" strokeWidth={1.5} />
          ) : isActive ? (
            <Circle className="h-4 w-4 text-emerald-500/60" strokeWidth={1.5} />
          ) : (
            <Circle className="h-4 w-4 text-white/20" strokeWidth={1.5} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <span
            className={`block text-xs font-medium leading-snug ${
              isActive
                ? 'text-emerald-300'
                : block.completed
                  ? 'text-white/60'
                  : 'text-white/50'
            }`}
          >
            {index + 1}. {block.title || formatBlockTypeLabel(block.blockType)}
          </span>
          <span className="mt-0.5 block text-[10px] uppercase tracking-wider text-white/30">
            {formatBlockTypeLabel(block.blockType)}
          </span>
        </div>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main sidebar component
// ---------------------------------------------------------------------------

export function LessonSidebar({
  blocks,
  currentBlockId,
  onBlockSelect,
  objectives,
  estimatedMinutes,
  isOpen,
  onToggle,
}: LessonSidebarProps) {
  const completedCount = blocks.filter((b) => b.completed).length
  const remainingMinutes = estimateRemainingMinutes(blocks, currentBlockId, estimatedMinutes)

  return (
    <>
      {/* Toggle button — mobile only */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={isOpen ? 'Close lesson outline' : 'Open lesson outline'}
        aria-expanded={isOpen}
        className="fixed right-4 top-[calc(var(--members-topbar-h)+0.75rem)] z-40 flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-[#0f1117] text-white/60 shadow-lg transition-colors hover:border-white/25 hover:text-white md:hidden"
      >
        {isOpen ? (
          <PanelLeftClose className="h-4 w-4" strokeWidth={1.5} />
        ) : (
          <PanelLeft className="h-4 w-4" strokeWidth={1.5} />
        )}
      </button>

      {/* Sidebar panel */}
      <aside
        data-open={isOpen}
        data-testid="academy-lesson-sidebar"
        className={cn(
          'glass-card-heavy fixed right-4 top-[calc(var(--members-topbar-h)+0.75rem)] bottom-[calc(var(--members-bottomnav-h)+0.75rem)] z-30 flex w-[min(88vw,20rem)] max-w-[20rem] flex-col rounded-2xl border border-white/10 shadow-2xl transition-all duration-300 md:inset-auto md:static md:z-auto md:h-full md:max-w-none md:rounded-xl md:shadow-none',
          isOpen
            ? 'translate-x-0 opacity-100 md:w-72 md:opacity-100'
            : 'pointer-events-none translate-x-[calc(100%+1.25rem)] opacity-0 md:w-0 md:translate-x-0 md:overflow-hidden md:opacity-0'
        )}
        aria-label="Lesson outline"
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-white/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white">Lesson Outline</h2>
            <button
              type="button"
              onClick={onToggle}
              aria-label="Close lesson outline"
              className="text-white/40 transition-colors hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="shrink-0 border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.5} />
              <span className="text-xs text-white/60">
                {completedCount}/{blocks.length} done
              </span>
            </div>
            {remainingMinutes > 0 && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-white/40" strokeWidth={1.5} />
                <span className="text-xs text-white/50">~{remainingMinutes} min left</span>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 space-y-1 overflow-y-auto overscroll-contain p-3">
          {/* Block list */}
          {blocks.map((block, index) => (
            <SidebarBlockItem
              key={block.id}
              block={block}
              isActive={block.id === currentBlockId}
              onClick={() => onBlockSelect(block.id)}
              index={index}
            />
          ))}
        </div>

        {/* Objectives section */}
        {objectives.length > 0 && (
          <div className="shrink-0 border-t border-white/10 p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-emerald-400/70" strokeWidth={1.5} />
              <span className="text-xs font-semibold uppercase tracking-widest text-white/40">
                Objectives
              </span>
            </div>
            <ul className="space-y-2">
              {objectives.map((objective, index) => (
                <li key={index} className="flex items-start gap-2">
                  <ChevronRight
                    className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500/50"
                    strokeWidth={1.5}
                  />
                  <span className="text-xs text-white/50 leading-snug">{objective}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </>
  )
}

// ---------------------------------------------------------------------------
// Mobile overlay backdrop
// ---------------------------------------------------------------------------

export function LessonSidebarBackdrop({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  if (!isOpen) return null

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
    />
  )
}
