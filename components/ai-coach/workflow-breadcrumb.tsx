'use client'

import { cn } from '@/lib/utils'
import type { WorkflowStep } from '@/contexts/AICoachWorkflowContext'

interface WorkflowBreadcrumbProps {
  path: WorkflowStep[]
  onStepClick: (index: number) => void
  onClear: () => void
}

export function WorkflowBreadcrumb({ path, onStepClick, onClear }: WorkflowBreadcrumbProps) {
  if (path.length === 0) return null

  return (
    <div className="border-b border-white/5 px-3 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
      {path.map((step, index) => (
        <button
          key={step.id}
          onClick={() => onStepClick(index)}
          className={cn(
            'text-[10px] px-2 py-1 rounded border whitespace-nowrap transition-colors',
            index === path.length - 1
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-white/10 bg-white/5 text-white/45 hover:text-white/65',
          )}
        >
          {step.label}
        </button>
      ))}
      <button
        onClick={onClear}
        className="text-[10px] px-2 py-1 rounded border border-white/10 bg-white/5 text-white/35 hover:text-white/60 transition-colors whitespace-nowrap"
      >
        Clear
      </button>
    </div>
  )
}

