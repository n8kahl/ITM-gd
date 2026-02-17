'use client'

import { useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { motion, useReducedMotion } from 'framer-motion'
import { SPXCommandCenterProvider, useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { SPXHeader } from '@/components/spx-command-center/spx-header'
import { ActionStrip } from '@/components/spx-command-center/action-strip'
import { SetupFeed } from '@/components/spx-command-center/setup-feed'
import { LevelMatrix } from '@/components/spx-command-center/level-matrix'
import { SPXChart } from '@/components/spx-command-center/spx-chart'
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
    dataHealth,
    dataHealthMessage,
    basis,
    gexProfile,
    activeSetups,
    levels,
  } = useSPXCommandCenter()

  const [mobileTab, setMobileTab] = useState<MobilePanelTab>('chart')
  const [showDesktopLevelOverlay, setShowDesktopLevelOverlay] = useState(false)
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

      {dataHealth !== 'healthy' && (
        <motion.div
          variants={itemVariants}
          className={
            dataHealth === 'degraded'
              ? 'rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100'
              : 'rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100'
          }
        >
          SPX Command Center data health: {dataHealth}. {dataHealthMessage || 'Recovering data feeds in background.'}
        </motion.div>
      )}

      <motion.div variants={itemVariants}>
        <ActionStrip />
      </motion.div>

      {isMobile ? (
        <motion.div variants={itemVariants} className="space-y-3">
          <div className="rounded-lg border border-champagne/25 bg-champagne/10 px-3 py-2 text-[11px] text-champagne/90">
            Mobile mode is read-only for monitoring. Use desktop for contract execution and interactive coaching.
          </div>
          <MobilePanelTabs active={mobileTab} onChange={setMobileTab} />

          {mobileTab === 'chart' && (
            <>
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
              <details open className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
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
              <Panel defaultSize={62} minSize={45}>
                <div className="relative h-full space-y-3 pr-1">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowDesktopLevelOverlay(true)}
                      className="rounded-lg border border-white/15 bg-white/[0.03] px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] text-white/70 hover:text-white"
                    >
                      Open Level Matrix
                    </button>
                  </div>
                  <SPXChart />
                  <FlowTicker />

                  {showDesktopLevelOverlay && (
                    <div className="absolute inset-0 z-20 flex items-start justify-end bg-black/45 p-3 backdrop-blur-[2px]">
                      <div className="max-h-full w-[440px] overflow-auto rounded-xl border border-white/15 bg-[#090B0F]/95 p-3 shadow-2xl">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-[11px] uppercase tracking-[0.12em] text-white/65">Level Matrix</p>
                          <button
                            type="button"
                            onClick={() => setShowDesktopLevelOverlay(false)}
                            className="rounded border border-white/15 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-white/65 hover:text-white"
                          >
                            Close
                          </button>
                        </div>
                        <LevelMatrix />
                      </div>
                    </div>
                  )}
                </div>
              </Panel>

              <PanelResizeHandle className="w-2.5 bg-transparent hover:bg-emerald-500/15 active:bg-emerald-500/25 transition-colors cursor-col-resize relative group" />

              <Panel defaultSize={38} minSize={28}>
                <div className="h-full space-y-3 pl-1">
                  <SetupFeed />
                  <ContractSelector />
                  <AICoachFeed />
                  <details open className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <summary className="cursor-pointer list-none text-[11px] uppercase tracking-[0.1em] text-white/60">
                      Show Advanced GEX Analytics
                    </summary>
                    <div className="mt-3 space-y-3">
                      <BasisIndicator basis={basis} />
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
