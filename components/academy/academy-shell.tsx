import type { ReactNode } from 'react'

export function AcademyShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
  /** @deprecated No longer constrains width — kept for call-site compat */
  maxWidthClassName?: string
}) {
  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        <p className="text-sm text-zinc-400">{description}</p>
      </header>
      <div className="w-full">{children}</div>
    </section>
  )
}

export function AcademyCard({
  title,
  children,
  className = '',
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`glass-card-heavy rounded-xl border border-white/10 p-4 ${className}`}>
      {title ? <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-zinc-300">{title}</h2> : null}
      <div className={title ? 'mt-3' : ''}>{children}</div>
    </section>
  )
}
