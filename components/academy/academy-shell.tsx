import type { ReactNode } from 'react'

export function AcademyShell({
  title,
  description,
  children,
  maxWidthClassName = 'max-w-6xl',
}: {
  title: string
  description: string
  children: ReactNode
  maxWidthClassName?: string
}) {
  return (
    <section className="space-y-5">
      <header className="glass-card-heavy rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-6">
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-2 text-sm text-zinc-300">{description}</p>
      </header>
      <div className={`mx-auto w-full ${maxWidthClassName}`}>{children}</div>
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
