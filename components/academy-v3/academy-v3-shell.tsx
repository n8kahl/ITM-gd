import type { ReactNode } from 'react'

export function AcademyV3Shell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="space-y-6">
      <header className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-6">
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-300">{description}</p>
      </header>
      {children}
    </section>
  )
}

export function AcademyPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#111318] p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-zinc-300">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}
