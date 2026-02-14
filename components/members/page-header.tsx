'use client'

import type { ReactNode } from 'react'
import { Breadcrumb, type BreadcrumbItem } from '@/components/ui/breadcrumb'

interface PageHeaderProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  breadcrumbs?: BreadcrumbItem[]
  actions?: ReactNode
}

export function PageHeader({
  title,
  subtitle,
  icon,
  breadcrumbs = [],
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="flex items-center gap-2.5 text-xl font-medium tracking-tight text-ivory lg:text-2xl">
          {icon}
          {title}
        </h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
        {breadcrumbs.length > 0 ? <Breadcrumb className="mt-2" items={breadcrumbs} /> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}
