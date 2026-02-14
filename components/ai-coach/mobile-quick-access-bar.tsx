'use client'

import { useState } from 'react'
import {
  Bell,
  BookOpen,
  Calculator,
  Calendar,
  CandlestickChart,
  Clock,
  Globe,
  Grid3X3,
  List,
  ListChecks,
  Search,
  Settings,
  Sunrise,
  TableProperties,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { MobileToolView } from '@/hooks/use-mobile-tool-sheet'

interface MobileQuickAccessBarProps {
  onOpenSheet: (view: MobileToolView) => void
  hasActiveChart?: boolean
}

const PRIMARY_TOOLS: Array<{ view: MobileToolView; icon: typeof CandlestickChart; label: string }> = [
  { view: 'chart', icon: CandlestickChart, label: 'Chart' },
  { view: 'options', icon: TableProperties, label: 'Options' },
  { view: 'scanner', icon: Search, label: 'Scanner' },
  { view: 'brief', icon: Sunrise, label: 'Brief' },
  { view: 'journal', icon: BookOpen, label: 'Journal' },
]

const ALL_TOOLS: Array<{
  group: string
  items: Array<{ view: MobileToolView; icon: typeof CandlestickChart; label: string }>
}> = [
  {
    group: 'Analyze',
    items: [
      { view: 'chart', icon: CandlestickChart, label: 'Live Chart' },
      { view: 'options', icon: TableProperties, label: 'Options Chain' },
      { view: 'position', icon: Calculator, label: 'Position Analyzer' },
      { view: 'scanner', icon: Search, label: 'Opportunity Scanner' },
    ],
  },
  {
    group: 'Portfolio',
    items: [
      { view: 'journal', icon: BookOpen, label: 'Trade Journal' },
      { view: 'tracked', icon: ListChecks, label: 'Tracked Setups' },
    ],
  },
  {
    group: 'Monitor',
    items: [
      { view: 'alerts', icon: Bell, label: 'Alerts' },
      { view: 'watchlist', icon: List, label: 'Watchlist' },
      { view: 'brief', icon: Sunrise, label: 'Daily Brief' },
    ],
  },
  {
    group: 'Research',
    items: [
      { view: 'leaps', icon: Clock, label: 'LEAPS' },
      { view: 'earnings', icon: Calendar, label: 'Earnings' },
      { view: 'macro', icon: Globe, label: 'Macro Context' },
    ],
  },
]

export function MobileQuickAccessBar({ onOpenSheet, hasActiveChart = false }: MobileQuickAccessBarProps) {
  const [showMore, setShowMore] = useState(false)

  return (
    <>
      <div className="lg:hidden flex items-center gap-1 px-3 py-1.5 border-t border-white/5" role="toolbar" aria-label="Quick tools">
        {PRIMARY_TOOLS.map(({ view, icon: Icon, label }) => (
          <button
            key={view}
            onClick={() => onOpenSheet(view)}
            className="relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-white/40 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
            aria-label={label}
            title={label}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="text-[10px]">{label}</span>
            {hasActiveChart && view === 'chart' && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>
        ))}
        <button
          onClick={() => setShowMore((current) => !current)}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors ml-auto',
            showMore
              ? 'text-emerald-300 bg-emerald-500/10'
              : 'text-white/40 hover:text-white/60',
          )}
          aria-label="More tools"
          aria-expanded={showMore}
        >
          <Grid3X3 className="w-3.5 h-3.5" />
        </button>
      </div>

      <AnimatePresence>
        {showMore && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden overflow-hidden border-t border-white/5"
          >
            <div className="px-3 py-3 space-y-3 max-h-[40vh] overflow-y-auto">
              {ALL_TOOLS.map(({ group, items }) => (
                <div key={group}>
                  <p className="text-[9px] uppercase tracking-[0.12em] text-white/25 mb-1.5">{group}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map(({ view, icon: Icon, label }) => (
                      <button
                        key={view}
                        onClick={() => {
                          onOpenSheet(view)
                          setShowMore(false)
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/5 bg-white/3 text-white/60 hover:text-white hover:bg-white/5 hover:border-emerald-500/20 transition-all text-left"
                      >
                        <Icon className="w-3.5 h-3.5 text-emerald-400/60" />
                        <span className="text-xs">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button
                onClick={() => {
                  onOpenSheet('preferences')
                  setShowMore(false)
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/5 bg-white/3 text-white/40 hover:text-white transition-all w-full text-left"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="text-xs">Settings</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
