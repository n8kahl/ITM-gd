'use client'

import { cn } from '@/lib/utils'
import { type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'premium' | 'outline' | 'glass'
  }
  className?: string
}

/**
 * V3 Redesign: Empty state component for zero-data scenarios.
 * Matches the "Quiet Luxury" aesthetic with glassmorphism and emerald accents.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const buttonVariants = {
    premium: 'bg-emerald-500 hover:bg-emerald-600 text-white',
    outline: 'border border-champagne/30 text-champagne hover:bg-champagne/10',
    glass: 'bg-white/5 border border-white/10 text-ivory hover:bg-white/10',
  }

  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-16 px-6 text-center',
      className
    )}>
      {/* Icon */}
      {Icon && (
        <div className="mb-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          <Icon className="w-8 h-8 text-muted-foreground/50" strokeWidth={1.5} />
        </div>
      )}

      {/* Title */}
      <h3 className="text-base font-medium text-ivory mb-1">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          {description}
        </p>
      )}

      {/* CTA */}
      {action && (
        <button
          onClick={action.onClick}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
            buttonVariants[action.variant || 'premium']
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
