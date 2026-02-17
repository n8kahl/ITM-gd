'use client'

import { cn } from '@/lib/utils'

export type MobilePanelTab = 'brief' | 'chart' | 'setups' | 'coach' | 'levels'

const TABS: Array<{ id: MobilePanelTab; label: string }> = [
  { id: 'brief', label: 'Brief' },
  { id: 'chart', label: 'Chart' },
  { id: 'setups', label: 'Setups' },
  { id: 'coach', label: 'Coach' },
  { id: 'levels', label: 'Levels' },
]

export function MobilePanelTabs({
  active,
  onChange,
}: {
  active: MobilePanelTab
  onChange: (next: MobilePanelTab) => void
}) {
  return (
    <div className="glass-card-heavy grid grid-cols-5 gap-1 rounded-xl p-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            'min-h-[44px] rounded-lg text-xs uppercase tracking-[0.12em] transition-colors',
            active === tab.id
              ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
              : 'bg-transparent text-white/60 border border-transparent',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
