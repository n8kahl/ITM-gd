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
    <div className="glass-card-heavy grid grid-cols-5 gap-1 rounded-xl p-1" data-testid="spx-mobile-panel-tabs">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          data-testid={`spx-mobile-tab-${tab.id}`}
          className={cn(
            'min-h-[44px] rounded-lg text-xs uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-300/60',
            active === tab.id
              ? 'border border-emerald-400/35 bg-emerald-500/20 text-emerald-100'
              : 'border border-white/10 bg-white/[0.02] text-white/75 hover:text-white/90',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
