'use client'

import Link from 'next/link'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: string
  href?: string
  onClick?: () => void
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

function CrumbLink({
  item,
  active,
  className,
}: {
  item: BreadcrumbItem
  active?: boolean
  className?: string
}) {
  const content = (
    <span
      className={cn(
        'text-xs lg:text-sm transition-colors',
        active ? 'text-ivory font-medium' : 'text-white/55 hover:text-white/75',
        className,
      )}
    >
      {item.label}
    </span>
  )

  if (item.onClick) {
    return (
      <button type="button" onClick={item.onClick}>
        {content}
      </button>
    )
  }

  if (item.href) {
    return <Link href={item.href}>{content}</Link>
  }

  return content
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  if (!items.length) return null

  const current = items[items.length - 1]
  const previous = items.length > 1 ? items[items.length - 2] : null

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center min-h-[28px]', className)}
    >
      <div className="hidden md:flex items-center gap-1.5">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1
          return (
            <div key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 && (
                <ChevronRight className="w-3.5 h-3.5 text-white/20" aria-hidden="true" />
              )}
              <CrumbLink item={item} active={isCurrent} />
            </div>
          )
        })}
      </div>

      <div className="md:hidden flex items-center gap-1.5">
        {previous ? (
          previous.href ? (
            <Link href={previous.href} className="inline-flex items-center gap-1 text-xs text-white/55 hover:text-white/75">
              <ArrowLeft className="w-3.5 h-3.5" />
              {previous.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={previous.onClick}
              className="inline-flex items-center gap-1 text-xs text-white/55 hover:text-white/75"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {previous.label}
            </button>
          )
        ) : null}
        {previous ? <ChevronRight className="w-3.5 h-3.5 text-white/20" aria-hidden="true" /> : null}
        <CrumbLink item={current} active />
      </div>
    </nav>
  )
}
