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
import { DecisionContext } from '@/components/spx-command-center/decision-context'
import { MobileBriefPanel } from '@/components/spx-command-center/mobile-brief-panel'
import { FADE_UP_VARIANT, STAGGER_CHILDREN } from '@/lib/motion-primitives'
import { SPX_TELEMETRY_EVENT, trackSPXTelemetryEvent } from '@/lib/spx/telemetry'

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
  const [showLevelOverlay, setShowLevelOverlay] = useState(false)
  const rootVariants = prefersReducedMotion ? undefined : STAGGER_CHILDREN
  const itemVariants = prefersReducedMotion ? undefined : FADE_UP_VARIANT
  const handleMobileTabChange = (next: MobilePanelTab) => {
    setMobileTab(next)
    trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
      surface: 'mobile_tabs',
      tab: next,
    })
  }

  if (isLoading && activeSetups.length === 0 && levels.length === 0) {
    return <SPXSkeleton />
  }

  return (
    <motion.div
      variants={rootVariants}
      initial={prefersReducedMotion ? false : 'initial'}
      animate={prefersReducedMotion ? false : 'animate'}
      className="space-y-2.5"
    >
      {/* ─── TIER 1: Sniper Briefing ─── */}
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
          SPX data health: {dataHealth}. {dataHealthMessage || 'Recovering feeds.'}
        </motion.div>
      )}

      <motion.div variants={itemVariants}>
        <ActionStrip />
      </motion.div>

      {/* ─── TIER 2: Battlefield ─── */}
      {isMobile ? (
        <motion.div variants={itemVariants} className="space-y-2.5">
          <div className="rounded-lg border border-champagne/25 bg-champagne/10 px-3 py-2 text-[11px] text-champagne/90">
            Mobile mode is read-only for monitoring. Use desktop for contract execution and interactive coaching.
          </div>
          <MobilePanelTabs active={mobileTab} onChange={handleMobileTabChange} />

          {mobileTab === 'brief' && <MobileBriefPanel />}

          {mobileTab === 'chart' && (
            <>
              <SPXChart />
              <FlowTicker />
              <DecisionContext />
            </>
          )}

          {mobileTab === 'setups' && (
            <div className="space-y-2.5">
              <SetupFeed readOnly />
              <ContractSelector readOnly />
            </div>
          )}

          {mobileTab === 'coach' && (
            <div className="space-y-2.5">
              <AICoachFeed readOnly />
              <BasisIndicator basis={basis} />
            </div>
          )}

          {mobileTab === 'levels' && (
            <div className="space-y-2.5">
              <LevelMatrix />
              <GEXLandscape profile={gexProfile?.combined || null} />
              <GEXHeatmap spx={gexProfile?.spx || null} spy={gexProfile?.spy || null} />
            </div>
          )}
        </motion.div>
      ) : (
        <motion.div variants={itemVariants}>
          {isLoading && levels.length === 0 ? (
            <SPXPanelSkeleton />
          ) : (
            <PanelGroup direction="horizontal" className="min-h-[68vh]">
              {/* ─── LEFT: Battlefield (chart + flow + context) ─── */}
              <Panel defaultSize={60} minSize={45}>
                <div className="relative h-full space-y-2.5 pr-1">
                  <SPXChart />
                  <FlowTicker />
                  <DecisionContext />

                  {/* Level matrix overlay */}
                  {showLevelOverlay && (
                    <div className="absolute inset-0 z-20 flex items-start justify-end bg-black/50 p-3 backdrop-blur-[2px]">
                      <div className="max-h-full w-[460px] overflow-auto rounded-xl border border-white/15 bg-[#090B0F]/95 p-3 shadow-2xl">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-[11px] uppercase tracking-[0.12em] text-white/65">Level Matrix</p>
                          <button
                            type="button"
                            onClick={() => {
                              setShowLevelOverlay(false)
                              trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.LEVEL_MAP_INTERACTION, {
                                action: 'overlay_close',
                                surface: 'desktop',
                              })
                            }}
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

              <PanelResizeHandle className="w-2 bg-transparent hover:bg-emerald-500/15 active:bg-emerald-500/25 transition-colors cursor-col-resize" />

              {/* ─── RIGHT: Setups + Contract + Coach ─── */}
              <Panel defaultSize={40} minSize={30}>
                <div className="h-full space-y-2.5 pl-1 overflow-auto">
                  <SetupFeed />
                  <ContractSelector />
                  <AICoachFeed />

                  {/* Advanced analytics — collapsed by default */}
                  <details
                    className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2"
                    onToggle={(event) => {
                      const expanded = (event.currentTarget as HTMLDetailsElement).open
                      trackSPXTelemetryEvent(SPX_TELEMETRY_EVENT.HEADER_ACTION_CLICK, {
                        surface: 'advanced_analytics',
                        action: expanded ? 'expand' : 'collapse',
                      })
                    }}
                  >
                    <summary className="cursor-pointer list-none text-[10px] uppercase tracking-[0.1em] text-white/50 hover:text-white/70">
                      Advanced GEX · Basis · Analytics
                    </summary>
                    <div className="mt-2.5 space-y-2.5">
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
