'use client'

import Image from 'next/image'
import Link from 'next/link'

import { resolveModuleImage } from '@/components/academy/academy-media'

export function AcademyModuleCard({
  moduleItem,
  trackTitle,
  progressPercent,
}: {
  moduleItem: {
    slug: string
    title: string
    description: string | null
    coverImageUrl: string | null
    estimatedMinutes: number
    lessons: Array<{ id: string }>
  }
  trackTitle: string
  progressPercent?: number
}) {
  const safeProgress = typeof progressPercent === 'number' ? Math.max(0, Math.min(100, progressPercent)) : null

  return (
    <Link
      href={`/members/academy/modules/${moduleItem.slug}`}
      className="group glass-card-heavy block overflow-hidden rounded-xl border border-white/10 transition-all hover:-translate-y-0.5 hover:border-emerald-500/35"
    >
      <div className="relative h-40 overflow-hidden border-b border-white/10 bg-[#0f1117]">
        <Image
          src={resolveModuleImage(moduleItem)}
          alt={`${moduleItem.title} cover`}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      </div>

      <div className="space-y-3 p-4">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.08em] text-emerald-300/80">{trackTitle}</p>
          <h3 className="line-clamp-2 text-base font-semibold text-white">{moduleItem.title}</h3>
          <p className="line-clamp-2 text-sm text-white/60">{moduleItem.description || 'Structured module content and practical drills.'}</p>
        </div>

        <p className="text-xs text-zinc-400">
          {moduleItem.lessons.length} lessons · ~{moduleItem.estimatedMinutes} min
        </p>

        {safeProgress !== null ? (
          <div className="space-y-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-emerald-400" style={{ width: `${safeProgress}%` }} />
            </div>
            <p className="text-[11px] text-zinc-400">{safeProgress}% complete</p>
          </div>
        ) : null}
      </div>
    </Link>
  )
}
