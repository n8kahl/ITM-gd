'use client'

import Image from 'next/image'
import { BRAND_LOGO_SRC, BRAND_NAME } from '@/lib/brand'

export function SPXSkeleton() {
  return (
    <section className="space-y-3">
      <div className="glass-card-heavy rounded-xl border border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 animate-pulse">
            <Image src={BRAND_LOGO_SRC} alt={BRAND_NAME} fill sizes="40px" className="object-contain" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.12em] text-white/55">SPX Command Center</p>
            <p className="text-sm text-white/70">Loading market snapshot and decision surfaces...</p>
          </div>
        </div>
      </div>
      <SPXPanelSkeleton />
    </section>
  )
}

export function SPXPanelSkeleton() {
  return (
    <div className="grid h-[68vh] grid-cols-1 gap-3 lg:grid-cols-[1.2fr_2fr]">
      <div className="space-y-3">
        <div className="glass-card-heavy rounded-2xl p-4 space-y-3">
          <div className="h-5 w-44 bg-white/10 rounded animate-pulse" />
          <div className="h-28 bg-white/5 rounded-xl animate-pulse" />
        </div>
        <div className="glass-card-heavy rounded-2xl p-4 space-y-3">
          <div className="h-5 w-40 bg-white/10 rounded animate-pulse" />
          <div className="h-36 bg-white/5 rounded-xl animate-pulse" />
        </div>
        <div className="glass-card-heavy rounded-2xl p-4 space-y-3">
          <div className="h-5 w-36 bg-white/10 rounded animate-pulse" />
          <div className="h-24 bg-white/5 rounded-xl animate-pulse" />
        </div>
      </div>
      <div className="glass-card-heavy rounded-2xl p-4 space-y-4">
        <div className="h-5 w-40 bg-white/10 rounded animate-pulse" />
        <div className="h-[520px] shimmer-surface rounded-2xl" />
        <div className="h-10 bg-white/5 rounded-xl animate-pulse" />
      </div>
    </div>
  )
}
