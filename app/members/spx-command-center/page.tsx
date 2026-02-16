'use client'

import { useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { motion, useReducedMotion } from 'framer-motion'
import { SPXCommandCenterProvider, useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { SPXHeader } from '@/components/spx-command-center/spx-header'
import { SetupFeed } from '@/components/spx-command-center/setup-feed'
import { LevelMatrix } from '@/components/spx-command-center/level-matrix'
import { SPXChart } from '@/components/spx-command-center/spx-chart'
import { RegimeBar } from '@/components/spx-command-center/regime-bar'
import { FlowTicker } from '@/components/spx-command-center/flow-ticker'
import { AICoachFeed } from '@/components/spx-command-center/ai-coach-feed'
import { ContractSelector } from '@/components/spx-command-center/contract-selector'
import { BasisIndicator } from '@/components/spx-command-center/basis-indicator'
import { GEXLandscape } from '@/components/spx-command-center/gex-landscape'
import { GEXHeatmap } from '@/components/spx-command-center/gex-heatmap'
import { MobilePanelTabs, type MobilePanelTab } from '@/components/spx-command-center/mobile-panel-tabs'
import { SPXPanelSkeleton, SPXSkeleton } from '@/components/spx-command-center/spx-skeleton'
import { FADE_UP_VARIANT, STAGGER_CHILDREN } from '@/lib/motion-primitives'

function SPXCommandCenterContent() {
  const isMobile = useIsMobile(768)
  const prefersReducedMotion = useReducedMotion()
  const {
    isLoading,
    error,
    basis,
    regime,
    prediction,
    gexProfile,
    activeSetups,
    levels,
  } = useSPXCommandCenter()

  const [mobileTab, setMobileTab] = useState<MobilePanelTab>('chart')
  const rootVariants = prefersReducedMotion ? undefined : STAGGER_CHILDREN
  const itemVariants = prefersReducedMotion ? undefined : FADE_UP_VARIANT

  if (isLoading && activeSetups.length === 0 && levels.length === 0) {
    return <SPXSkeleton />
  }

  return (
    <motion.div
      variants={rootVariants}
      initial={prefersReducedMotion ? false : 'initial'}
      animate={prefersReducedMotion ? false : 'animate'}
      className="space-y-4"
    >
      <motion.div variants={itemVariants}>
        <SPXHeader />
      </motion.div>

      {error && (
        <motion.div
          variants={itemVariants}
          className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100"
        >
          SPX Command Center is running with degraded data: {error.message}
        </motion.div>
      )}

      {isMobile ? (
        <motion.div variants={itemVariants} className="space-y-3">
          <div className="rounded-lg border border-champagne/25 bg-champagne/10 px-3 py-2 text-[11px] text-champagne/90">
            Mobile mode is read-only for monitoring. Use desktop for contract execution and interactive coaching.
          </div>
          <MobilePanelTabs active={mobileTab} onChange={setMobileTab} />

          {mobileTab === 'chart' && (
            <>
              <RegimeBar
                regime={regime}
                direction={prediction ? (prediction.direction.bullish >= prediction.direction.bearish ? 'bullish' : 'bearish') : null}
                confidence={prediction?.confidence || null}
                prediction={prediction}
              />
              <SPXChart />
              <FlowTicker />
            </>
          )}

          {mobileTab === 'setups' && (
            <div className="space-y-3">
              <SetupFeed readOnly />
              <ContractSelector readOnly />
            </div>
          )}

          {mobileTab === 'coach' && (
            <div className="space-y-3">
              <AICoachFeed readOnly />
              <BasisIndicator basis={basis} />
            </div>
          )}

          {mobileTab === 'levels' && (
            <div className="space-y-3">
              <LevelMatrix />
              <details className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <summary className="cursor-pointer list-none text-[11px] uppercase tracking-[0.1em] text-white/60">
                  Show Advanced GEX Analytics
                </summary>
                <div className="mt-3 space-y-3">
                  <GEXLandscape profile={gexProfile?.combined || null} />
                  <GEXHeatmap spx={gexProfile?.spx || null} spy={gexProfile?.spy || null} />
                </div>
              </details>
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div variants={itemVariants}>
          {isLoading && levels.length === 0 ? (
            <SPXPanelSkeleton />
          ) : (
            <PanelGroup direction="horizontal" className="min-h-[72vh]">
              <Panel defaultSize={25} minSize={20}>
                <div className="h-full space-y-3 pr-1">
                  <SetupFeed />
                  <LevelMatrix />
                </div>
              </Panel>

              <PanelResizeHandle className="w-2.5 bg-transparent hover:bg-emerald-500/15 active:bg-emerald-500/25 transition-colors cursor-col-resize relative group" />

              <Panel defaultSize={50} minSize={35}>
                <div className="h-full px-1 space-y-3">
                  <RegimeBar
                    regime={regime}
                    direction={prediction ? (prediction.direction.bullish >= prediction.direction.bearish ? 'bullish' : 'bearish') : null}
                    confidence={prediction?.confidence || null}
                    prediction={prediction}
                  />
                  <SPXChart />
                  <FlowTicker />
                </div>
              </Panel>

              <PanelResizeHandle className="w-2.5 bg-transparent hover:bg-emerald-500/15 active:bg-emerald-500/25 transition-colors cursor-col-resize relative group" />

              <Panel defaultSize={25} minSize={20}>
                <div className="h-full space-y-3 pl-1">
                  <AICoachFeed />
                  <ContractSelector />
                  <BasisIndicator basis={basis} />
                  <details className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <summary className="cursor-pointer list-none text-[11px] uppercase tracking-[0.1em] text-white/60">
                      Show Advanced GEX Analytics
                    </summary>
                    <div className="mt-3 space-y-3">
                      <GEXLandscape profile={gexProfile?.combined || null} />
                      <GEXHeatmap spx={gexProfile?.spx || null} spy={gexProfile?.spy || null} />
                    </div>
                  </details>
                </div>
              </Panel>
            </PanelGroup>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}

export default function SPXCommandCenterPage() {
  return (
    <SPXCommandCenterProvider>
      <SPXCommandCenterContent />
    </SPXCommandCenterProvider>
  )
}
