'use client'

import { startTransition, useCallback, useEffect, useMemo, useState } from 'react'
import { Radar, RefreshCw, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/members/page-header'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DossierPanel } from '@/components/swing-sniper/dossier-panel'
import { OpportunityBoard } from '@/components/swing-sniper/opportunity-board'
import { SwingSniperMemoRail } from '@/components/swing-sniper/swing-sniper-memo-rail'
import type {
  SwingSniperBacktestPayload,
  SwingSniperBriefPayload,
  SwingSniperDossierPayload,
  SwingSniperHealthPayload,
  SwingSniperMonitoringPayload,
  SwingSniperUniversePayload,
  SwingSniperWatchlistPayload,
  SwingSniperWatchlistSavePayload,
} from '@/lib/swing-sniper/types'

type HealthState = 'checking' | 'ready' | 'error'

type DossierTab = 'Thesis' | 'Vol Map' | 'Catalysts' | 'Structure' | 'Risk'

interface SaveWatchlistResponse {
  success: boolean
  data: SwingSniperWatchlistPayload
}

async function parseJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>
}

function shellTone(status: SwingSniperHealthPayload['status'] | 'checking' | 'error'): {
  badge: string
  title: string
  body: string
} {
  if (status === 'ready') {
    return {
      badge: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200',
      title: 'Research stack ready',
      body: 'Massive core checks passed and Swing Sniper can render the ranked board, dossier, and memo rail.',
    }
  }

  if (status === 'degraded') {
    return {
      badge: 'border-amber-500/25 bg-amber-500/10 text-amber-100',
      title: 'Research stack degraded',
      body: 'The tab remains usable, but one or more upstream services are soft-failing and some enrichments may be thinner.',
    }
  }

  if (status === 'checking') {
    return {
      badge: 'border-white/10 bg-white/5 text-white/70',
      title: 'Running preflight',
      body: 'Checking Massive connectivity, options reference access, and optional catalyst feeds.',
    }
  }

  return {
    badge: 'border-red-500/25 bg-red-500/10 text-red-100',
    title: 'Research stack unavailable',
    body: 'The shell loaded, but the health endpoint could not be reached.',
  }
}

export function SwingSniperShell() {
  const [healthState, setHealthState] = useState<HealthState>('checking')
  const [health, setHealth] = useState<SwingSniperHealthPayload | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [universe, setUniverse] = useState<SwingSniperUniversePayload | null>(null)
  const [universeError, setUniverseError] = useState<string | null>(null)
  const [brief, setBrief] = useState<SwingSniperBriefPayload | null>(null)
  const [briefError, setBriefError] = useState<string | null>(null)
  const [briefLoading, setBriefLoading] = useState(true)
  const [monitoring, setMonitoring] = useState<SwingSniperMonitoringPayload | null>(null)
  const [monitoringError, setMonitoringError] = useState<string | null>(null)
  const [monitoringLoading, setMonitoringLoading] = useState(true)
  const [backtest, setBacktest] = useState<SwingSniperBacktestPayload | null>(null)
  const [backtestError, setBacktestError] = useState<string | null>(null)
  const [backtestLoading, setBacktestLoading] = useState(false)
  const [watchlist, setWatchlist] = useState<SwingSniperWatchlistPayload | null>(null)
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<DossierTab>('Thesis')
  const [dossier, setDossier] = useState<SwingSniperDossierPayload | null>(null)
  const [dossierLoading, setDossierLoading] = useState(false)
  const [dossierError, setDossierError] = useState<string | null>(null)
  const [savePending, setSavePending] = useState(false)
  const [filters, setFilters] = useState<SwingSniperWatchlistPayload['filters']>({
    preset: 'all',
    minScore: 0,
  })

  const loadHealth = useCallback(async () => {
    setHealthState('checking')
    setHealthError(null)

    try {
      const response = await fetch('/api/members/swing-sniper/health', {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(payload?.message || `Health check failed (${response.status})`)
      }

      const payload = await parseJson<SwingSniperHealthPayload>(response)
      setHealth(payload)
      setHealthState('ready')
    } catch (error) {
      setHealth(null)
      setHealthState('error')
      setHealthError(error instanceof Error ? error.message : 'Unable to load Swing Sniper health.')
    }
  }, [])

  const loadUniverse = useCallback(async () => {
    setUniverseError(null)
    try {
      const response = await fetch('/api/members/swing-sniper/universe', {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(payload?.message || `Universe load failed (${response.status})`)
      }

      const payload = await parseJson<SwingSniperUniversePayload>(response)
      setUniverse(payload)
    } catch (error) {
      setUniverse(null)
      setUniverseError(error instanceof Error ? error.message : 'Unable to load the opportunity board.')
    }
  }, [])

  const loadBrief = useCallback(async () => {
    setBriefLoading(true)
    setBriefError(null)
    try {
      const response = await fetch('/api/members/swing-sniper/brief', {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(payload?.message || `Brief load failed (${response.status})`)
      }

      const payload = await parseJson<SwingSniperBriefPayload>(response)
      setBrief(payload)
    } catch (error) {
      setBrief(null)
      setBriefError(error instanceof Error ? error.message : 'Unable to load the Swing Sniper memo.')
    } finally {
      setBriefLoading(false)
    }
  }, [])

  const loadMonitoring = useCallback(async () => {
    setMonitoringLoading(true)
    setMonitoringError(null)
    try {
      const response = await fetch('/api/members/swing-sniper/monitoring', {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(payload?.message || `Monitoring load failed (${response.status})`)
      }

      const payload = await parseJson<SwingSniperMonitoringPayload>(response)
      setMonitoring(payload)
    } catch (error) {
      setMonitoring(null)
      setMonitoringError(error instanceof Error ? error.message : 'Unable to load Risk Sentinel monitoring.')
    } finally {
      setMonitoringLoading(false)
    }
  }, [])

  const loadWatchlist = useCallback(async () => {
    try {
      const response = await fetch('/api/members/swing-sniper/watchlist', {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(payload?.message || `Watchlist load failed (${response.status})`)
      }

      const payload = await parseJson<SwingSniperWatchlistPayload>(response)
      setWatchlist(payload)
      setFilters(payload.filters)
      if (payload.selectedSymbol) {
        setActiveSymbol(payload.selectedSymbol)
      }
    } catch {
      setWatchlist(null)
    }
  }, [])

  const loadDossier = useCallback(async (symbol: string) => {
    setDossierLoading(true)
    setDossierError(null)

    try {
      const response = await fetch(`/api/members/swing-sniper/dossier/${encodeURIComponent(symbol)}`, {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(payload?.message || `Dossier load failed (${response.status})`)
      }

      const payload = await parseJson<SwingSniperDossierPayload>(response)
      setDossier(payload)
    } catch (error) {
      setDossier(null)
      setDossierError(error instanceof Error ? error.message : 'Unable to load the selected dossier.')
    } finally {
      setDossierLoading(false)
    }
  }, [])

  const loadBacktest = useCallback(async (symbol: string) => {
    setBacktestLoading(true)
    setBacktestError(null)

    try {
      const response = await fetch(`/api/members/swing-sniper/backtest/${encodeURIComponent(symbol)}`, {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(payload?.message || `Backtest load failed (${response.status})`)
      }

      const payload = await parseJson<SwingSniperBacktestPayload>(response)
      setBacktest(payload)
    } catch (error) {
      setBacktest(null)
      setBacktestError(error instanceof Error ? error.message : 'Unable to load adaptive confidence context.')
    } finally {
      setBacktestLoading(false)
    }
  }, [])

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadHealth(),
      loadUniverse(),
      loadBrief(),
      loadMonitoring(),
      loadWatchlist(),
    ])
  }, [loadBrief, loadHealth, loadMonitoring, loadUniverse, loadWatchlist])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  useEffect(() => {
    if (!activeSymbol && universe?.opportunities.length) {
      setActiveSymbol(watchlist?.selectedSymbol || universe.opportunities[0].symbol)
    }
  }, [activeSymbol, universe, watchlist])

  useEffect(() => {
    if (!activeSymbol) return
    void Promise.all([
      loadDossier(activeSymbol),
      loadBacktest(activeSymbol),
    ])
  }, [activeSymbol, loadBacktest, loadDossier])

  const preflightTone = useMemo(
    () => shellTone(healthState === 'ready' ? health?.status ?? 'degraded' : healthState),
    [health, healthState],
  )

  const handleSelectSymbol = (symbol: string) => {
    setActiveTab('Thesis')
    startTransition(() => {
      setActiveSymbol(symbol)
    })
  }

  const handleSaveThesis = async () => {
    if (!dossier) return

    setSavePending(true)

    const payload: SwingSniperWatchlistSavePayload = {
      selectedSymbol: dossier.symbol,
      symbols: watchlist?.symbols || [],
      filters,
      thesis: {
        symbol: dossier.symbol,
        score: dossier.score,
        setupLabel: dossier.setupLabel,
        direction: dossier.direction,
        thesis: dossier.thesis,
        ivRankAtSave: dossier.volMap.ivRank,
        catalystLabel: dossier.catalysts.events[0]?.title || null,
        catalystDate: dossier.catalysts.events[0]?.date || null,
        monitorNote: dossier.risk.watchItems[0] || 'Waiting for refreshed volatility context.',
      },
    }

    try {
      const response = await fetch('/api/members/swing-sniper/watchlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(errorPayload?.message || `Save thesis failed (${response.status})`)
      }

      const saved = await parseJson<SaveWatchlistResponse>(response)
      setWatchlist(saved.data)
      setDossier((current) => (current ? { ...current, saved: true } : current))
      setUniverse((current) => current ? {
        ...current,
        opportunities: current.opportunities.map((item) => (
          item.symbol === dossier.symbol ? { ...item, saved: true } : item
        )),
      } : current)
      void loadBrief()
    } catch (error) {
      setBriefError(error instanceof Error ? error.message : 'Unable to save the current thesis.')
    } finally {
      setSavePending(false)
    }
  }

  return (
    <div data-testid="swing-sniper-shell" className="space-y-6">
      <PageHeader
        title="Swing Sniper"
        subtitle="Options research workspace for volatility mispricing, catalyst convergence, and exact structure planning."
        icon={<Radar className="h-5 w-5 text-emerald-300" strokeWidth={1.5} />}
        actions={(
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refreshAll()}
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', healthState === 'checking' && 'animate-spin')} />
            Refresh research
          </Button>
        )}
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
        <div className="glass-card-heavy rounded-2xl border border-white/10 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <span className={cn('inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]', preflightTone.badge)}>
                {preflightTone.title}
              </span>
              <h2 className="text-xl font-semibold text-white">Research engine live inside the member center</h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {preflightTone.body}
              </p>
            </div>

            <div className="grid min-w-[220px] gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Route status</span>
                <span className="font-medium text-white">Risk Sentinel + Backtest live</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Launch universe target</span>
                <span className="font-medium text-white">{health?.launchUniverseTarget ?? 150} symbols</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Board scanned</span>
                <span className="font-medium text-white">{universe?.symbolsScanned ?? 0}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card-heavy rounded-2xl border border-white/10 p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-champagne" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/80">What landed</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {[
              ['Exact contract picks', 'Structure cards now include concrete strikes, expiries, and leg-level quote quality for top setups.'],
              ['Risk Sentinel', 'Saved theses now carry health scoring, exit bias, and portfolio-fit context in the same workspace.'],
              ['Adaptive confidence', 'Backtest replay now reweights thesis confidence from archived setup outcomes and sample quality.'],
              ['IV vs RV overlay', 'Vol Map now makes the premium gap visual instead of forcing users to infer it from stats.'],
              ['Catalyst density strip', 'Event clustering is rendered as a timeline so compressed windows stand out immediately.'],
              ['Scenario distributions', 'Each recommendation includes deterministic payoff scenarios with probability-weighted distribution bands.'],
            ].map(([label, detail]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">{label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)_320px]">
        <OpportunityBoard
          opportunities={universe?.opportunities || []}
          activeSymbol={activeSymbol}
          filters={filters}
          onFilterChange={(preset) => setFilters((current) => ({ ...current, preset }))}
          onSelect={handleSelectSymbol}
          notes={universe?.notes}
          symbolsScanned={universe?.symbolsScanned}
        />

        <DossierPanel
          dossier={dossier}
          monitoring={monitoring}
          monitoringLoading={monitoringLoading}
          monitoringError={monitoringError}
          backtest={backtest}
          backtestLoading={backtestLoading}
          backtestError={backtestError}
          loading={dossierLoading}
          error={dossierError || universeError}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onSaveThesis={() => void handleSaveThesis()}
          savePending={savePending}
        />

        <SwingSniperMemoRail
          brief={brief}
          briefLoading={briefLoading}
          briefError={briefError}
          monitoring={monitoring}
          monitoringLoading={monitoringLoading}
          monitoringError={monitoringError}
          backtest={backtest}
          backtestLoading={backtestLoading}
          backtestError={backtestError}
          health={health}
          healthState={healthState}
          healthError={healthError}
        />
      </div>
    </div>
  )
}
