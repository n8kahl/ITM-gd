'use client'

import { Info } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function InfoTip({
  label,
  children,
  className,
  panelClassName,
}: {
  label: string
  children: ReactNode
  className?: string
  panelClassName?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        title={label}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/60 transition-colors hover:text-emerald-200 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen((prev) => !prev)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <Info className="h-3 w-3" />
      </button>

      {open && (
        <span
          role="tooltip"
          className={cn(
            'absolute right-0 top-6 z-30 w-56 rounded-lg border border-white/15 bg-[#0B0D10]/95 p-2 text-[11px] leading-relaxed text-white/75 shadow-2xl backdrop-blur-xl',
            panelClassName,
          )}
        >
          {children}
        </span>
      )}
    </span>
  )
}

