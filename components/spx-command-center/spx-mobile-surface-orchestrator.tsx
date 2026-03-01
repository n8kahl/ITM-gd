'use client'

import { AICoachFeed } from '@/components/spx-command-center/ai-coach-feed'
import { CoachBottomSheet } from '@/components/spx-command-center/coach-bottom-sheet'
import { CoachDock } from '@/components/spx-command-center/coach-dock'
import { ContractSelector } from '@/components/spx-command-center/contract-selector'
import { DecisionContext } from '@/components/spx-command-center/decision-context'
import { FlowTicker } from '@/components/spx-command-center/flow-ticker'
import { GEXAmbientGlow } from '@/components/spx-command-center/gex-ambient-glow'
import { GEXHeatmap } from '@/components/spx-command-center/gex-heatmap'
import { GEXLandscape } from '@/components/spx-command-center/gex-landscape'
import { LevelMatrix } from '@/components/spx-command-center/level-matrix'
import { MobileBriefPanel } from '@/components/spx-command-center/mobile-brief-panel'
import { MobilePanelTabs } from '@/components/spx-command-center/mobile-panel-tabs'
import { SPXOptimizerScorecardPanel } from '@/components/spx-command-center/optimizer-scorecard-panel'
import { PostTradePanel } from '@/components/spx-command-center/post-trade-panel'
import { SetupFeed } from '@/components/spx-command-center/setup-feed'
import { SPXChart } from '@/components/spx-command-center/spx-chart'
import { SPXSettingsSheet } from '@/components/spx-command-center/spx-settings-sheet'
import type { SPXCommandController } from '@/hooks/use-spx-command-controller'
import { formatSPXFeedFallbackReasonCode, formatSPXFeedFallbackStage } from '@/lib/spx/feed-health'
import { cn } from '@/lib/utils'
import { Settings2 } from 'lucide-react'

export type SPXMobileSurfaceOrchestratorProps = {
  dataHealth: SPXCommandController['dataHealth']
  dataHealthMessage: SPXCommandController['dataHealthMessage']
  feedFallbackReasonCode: SPXCommandController['feedFallbackReasonCode']
  feedFallbackStage: SPXCommandController['feedFallbackStage']
  mobileSmartStackEnabled: boolean
  coachDockEnabled: boolean
  layoutMode: SPXCommandController['layoutMode']
  mobileReadOnly: boolean
  showGEXGlow: boolean
  showAllRelevantLevels: boolean
  onDisplayedLevelsChange: SPXCommandController['handleDisplayedLevelsChange']
  onLatestBarTimeChange: SPXCommandController['handleLatestChartBarTimeChange']
  gexProfile: SPXCommandController['gexProfile']
  mobileTab: SPXCommandController['mobileTab']
  onMobileTabChange: SPXCommandController['handleMobileTabChange']
  showMobileCoachSheet: boolean
  onMobileCoachSheetChange: SPXCommandController['handleMobileCoachSheetChange']
  focusMode: SPXCommandController['focusMode']
  replayEnabled: SPXCommandController['replayEnabled']
  replayPlaying: SPXCommandController['replayPlaying']
  replayWindowMinutes: SPXCommandController['replayWindowMinutes']
  replaySpeed: SPXCommandController['replaySpeed']
  primaryActionMode: SPXCommandController['primaryActionMode']
  primaryActionLabel: string
  primaryActionEnabled: boolean
  primaryActionBlockedReason: string | null
  onPrimaryAction: () => void
  onOpenSettings: () => void
  showSettingsPanel: boolean
  onSettingsPanelChange: (next: boolean) => void
}

export function SPXMobileSurfaceOrchestrator({
  dataHealth,
  dataHealthMessage,
  feedFallbackReasonCode,
  feedFallbackStage,
  mobileSmartStackEnabled,
  coachDockEnabled,
  layoutMode,
  mobileReadOnly,
  showGEXGlow,
  showAllRelevantLevels,
  onDisplayedLevelsChange,
  onLatestBarTimeChange,
  gexProfile,
  mobileTab,
  onMobileTabChange,
  showMobileCoachSheet,
  onMobileCoachSheetChange,
  focusMode,
  replayEnabled,
  replayPlaying,
  replayWindowMinutes,
  replaySpeed,
  primaryActionMode,
  primaryActionLabel,
  primaryActionEnabled,
  primaryActionBlockedReason,
  onPrimaryAction,
  onOpenSettings,
  showSettingsPanel,
  onSettingsPanelChange,
}: SPXMobileSurfaceOrchestratorProps) {
  const primaryActionTone = primaryActionMode === 'in_trade'
    ? 'border-rose-300/40 bg-rose-500/16 text-rose-100 hover:bg-rose-500/24'
    : primaryActionMode === 'evaluate'
      ? 'border-emerald-300/40 bg-emerald-500/16 text-emerald-100 hover:bg-emerald-500/24'
      : 'border-champagne/40 bg-champagne/14 text-champagne hover:bg-champagne/20'

  const primaryActionRail = (
    <section
      data-testid="spx-mobile-primary-cta"
      className="rounded-xl border border-white/12 bg-[#0A0C10]/88 px-3 py-2.5 backdrop-blur"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.1em] text-white/55">Primary Action Rail</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenSettings}
            data-testid="spx-mobile-settings-trigger"
            className="inline-flex min-h-[28px] items-center gap-1 rounded-md border border-emerald-300/25 bg-emerald-500/[0.08] px-2 py-0.5 text-[9px] uppercase tracking-[0.08em] text-emerald-100"
          >
            <Settings2 className="h-3 w-3" />
            Settings
          </button>
          <span
            data-testid="spx-mobile-primary-action-mode-chip"
            className="rounded border border-white/15 bg-white/[0.04] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-white/70"
          >
            {primaryActionMode.replace('_', ' ')}
          </span>
          <span className="rounded border border-emerald-400/25 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-emerald-200">
            {focusMode.replace('_', ' ')}
          </span>
          {replayEnabled && (
            <span className="rounded border border-champagne/35 bg-champagne/12 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-champagne">
              Replay {replayPlaying ? `${replaySpeed}x` : `Paused · ${replayWindowMinutes}m`}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        data-testid="spx-mobile-primary-cta-button"
        disabled={!primaryActionEnabled}
        onClick={onPrimaryAction}
        title={!primaryActionEnabled ? (primaryActionBlockedReason || 'Action unavailable') : undefined}
        className={cn(
          'min-h-[44px] w-full rounded-lg border px-3 py-2 text-[11px] uppercase tracking-[0.09em] transition-colors disabled:cursor-not-allowed disabled:opacity-40',
          primaryActionTone,
        )}
      >
        {primaryActionLabel}
      </button>
      {!primaryActionEnabled && primaryActionBlockedReason && (
        <p data-testid="spx-mobile-primary-cta-blocked-reason" className="mt-2 text-[10px] uppercase tracking-[0.08em] text-amber-200">
          {primaryActionBlockedReason}
        </p>
      )}
    </section>
  )

  return (
    <>
      {dataHealth !== 'healthy' && (
        <div
          className={
            dataHealth === 'degraded'
              ? 'rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100'
              : 'rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100'
          }
          data-testid="spx-mobile-feed-health-banner"
        >
          SPX data health: {dataHealth} ({formatSPXFeedFallbackStage(feedFallbackStage)}).
          {' '}
          {dataHealthMessage || 'Recovering feeds.'}
          {feedFallbackReasonCode !== 'none'
            ? ` Reason: ${formatSPXFeedFallbackReasonCode(feedFallbackReasonCode)}.`
            : ''}
        </div>
      )}

      {mobileSmartStackEnabled ? (
        <div
          className={cn('space-y-2.5', coachDockEnabled && 'pb-24')}
          data-testid="spx-mobile-smart-stack"
        >
          <div className="sticky top-2 z-10 flex items-center justify-between rounded-xl border border-white/10 bg-[#0A0C10]/90 px-3.5 py-2.5 backdrop-blur">
            <p className="text-[11px] uppercase tracking-[0.1em] text-white/68">Mobile Command Stack</p>
            <span
              data-testid="spx-mobile-layout-mode-chip"
              className="rounded border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.08em] text-emerald-200"
            >
              {layoutMode.replace('_', ' ')}
            </span>
          </div>
          {primaryActionRail}
          <MobileBriefPanel readOnly={mobileReadOnly} />
          <SetupFeed readOnly={mobileReadOnly} suppressLocalPrimaryCta />
          {!coachDockEnabled && <AICoachFeed readOnly={mobileReadOnly} />}
          {(layoutMode === 'evaluate' || layoutMode === 'in_trade') && (
            <ContractSelector readOnly={mobileReadOnly} />
          )}
          <div className="relative">
            {showGEXGlow && <GEXAmbientGlow />}
            <SPXChart
              showAllRelevantLevels={showAllRelevantLevels}
              mobileExpanded
              onDisplayedLevelsChange={onDisplayedLevelsChange}
              onLatestBarTimeChange={onLatestBarTimeChange}
              focusMode={focusMode}
              replayEnabled={replayEnabled}
              replayPlaying={replayPlaying}
              replayWindowMinutes={replayWindowMinutes}
              replaySpeed={replaySpeed}
            />
          </div>
          <FlowTicker />
          {layoutMode !== 'in_trade' && <DecisionContext />}
          <details className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
            <summary className="flex min-h-[40px] cursor-pointer list-none items-center text-[10px] uppercase tracking-[0.1em] text-white/55 hover:text-white/75">
              Deep Analytics
            </summary>
            <div className="mt-2.5 space-y-2.5">
              <SPXOptimizerScorecardPanel compact />
              <LevelMatrix />
              <GEXLandscape profile={gexProfile?.combined || null} />
              <GEXHeatmap spx={gexProfile?.spx || null} spy={gexProfile?.spy || null} />
            </div>
          </details>
          <PostTradePanel compact />
        </div>
      ) : (
        <>
          <MobilePanelTabs active={mobileTab} onChange={onMobileTabChange} />
          <div className="mt-2.5">{primaryActionRail}</div>

          {mobileTab === 'brief' && <MobileBriefPanel readOnly={mobileReadOnly} />}

          {mobileTab === 'chart' && (
            <>
              <div className="relative">
                {showGEXGlow && <GEXAmbientGlow />}
                <SPXChart
                  showAllRelevantLevels={showAllRelevantLevels}
                  mobileExpanded
                  onDisplayedLevelsChange={onDisplayedLevelsChange}
                  onLatestBarTimeChange={onLatestBarTimeChange}
                  focusMode={focusMode}
                  replayEnabled={replayEnabled}
                  replayPlaying={replayPlaying}
                  replayWindowMinutes={replayWindowMinutes}
                  replaySpeed={replaySpeed}
                />
              </div>
              <FlowTicker />
              <DecisionContext />
            </>
          )}

          {mobileTab === 'setups' && (
            <div className="space-y-2.5">
              <SetupFeed readOnly={mobileReadOnly} suppressLocalPrimaryCta />
              <ContractSelector readOnly={mobileReadOnly} />
            </div>
          )}

          {mobileTab === 'coach' && (
            <div
              className="space-y-2.5"
              aria-hidden={false}
            >
              <AICoachFeed readOnly={mobileReadOnly} />
            </div>
          )}

          {mobileTab === 'levels' && (
            <div className="space-y-2.5">
              <SPXOptimizerScorecardPanel compact />
              <LevelMatrix />
              <GEXLandscape profile={gexProfile?.combined || null} />
              <GEXHeatmap spx={gexProfile?.spx || null} spy={gexProfile?.spy || null} />
              <PostTradePanel compact />
            </div>
          )}
        </>
      )}

      {mobileSmartStackEnabled && coachDockEnabled && (
        <>
          <div className="pointer-events-none fixed inset-x-2 bottom-2 z-[68]">
            <div className="pointer-events-auto">
              <CoachDock
                surface="mobile"
                isOpen={showMobileCoachSheet}
                onToggle={() => onMobileCoachSheetChange(!showMobileCoachSheet)}
              />
            </div>
          </div>
          <CoachBottomSheet
            open={showMobileCoachSheet}
            onOpenChange={onMobileCoachSheetChange}
          >
            <AICoachFeed readOnly={mobileReadOnly} />
          </CoachBottomSheet>
        </>
      )}

      <SPXSettingsSheet open={showSettingsPanel} onOpenChange={onSettingsPanelChange} />
    </>
  )
}
