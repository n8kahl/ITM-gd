'use client'

import Link from 'next/link'
import { Plus, Bot, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function QuickActions() {
  return (
    <div className="glass-card-heavy rounded-2xl p-4 lg:p-6 flex flex-col h-full">
      <h3 className="text-sm font-medium text-ivory mb-4">Quick Actions</h3>

      <div className="flex flex-col gap-2 flex-1">
        {/* Log Trade */}
        <Link
          href="/members/journal?new=1"
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(16,185,129,0.3)]"
        >
          <Plus className="w-4 h-4" />
          Log Trade
        </Link>

        {/* Ask AI Coach */}
        <Link
          href="/members/ai-coach"
          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 text-ivory text-sm font-medium hover:bg-white/[0.04] hover:border-white/[0.16] transition-all duration-200"
        >
          <Bot className="w-4 h-4 text-champagne" />
          Ask AI Coach
        </Link>

        {/* Share Last Win */}
        <button
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-muted-foreground text-sm font-medium hover:text-ivory hover:bg-white/[0.06] transition-all duration-200"
        >
          <Share2 className="w-4 h-4" />
          Share Last Win
        </button>
      </div>
    </div>
  )
}
