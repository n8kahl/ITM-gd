'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookmarkCheck, Radar, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DossierPanel } from '@/components/swing-sniper/dossier-panel'
import { MandateDrawer } from '@/components/swing-sniper/mandate-drawer'
import { OpportunityBoard } from '@/components/swing-sniper/opportunity-board'
import { SavedThesesDrawer } from '@/components/swing-sniper/saved-theses-drawer'
import { SwingSniperMemoRail } from '@/components/swing-sniper/swing-sniper-memo-rail'
import type {
  SwingSniperBoardIdea,
  SwingSniperBoardPayload,
  SwingSniperDirection,
  SwingSniperDossierPayload,
  SwingSniperMemoPayload,
  SwingSniperMonitoringPayload,
  SwingSniperStructureStrategy,
  SwingSniperWatchlistPayload,
  SwingSniperWatchlistSavePayload,
} from '@/lib/swing-sniper/types'

type DossierTab = 'Thesis' | 'Vol Map' | 'Catalysts' | 'Structure' | 'Risk'

interface SaveWatchlistResponse {
  success: boolean
  data: SwingSniperWatchlistPayload
}

type SavedThesisPayload = NonNullable<SwingSniperWatchlistSavePayload['thesis']>

const DEFAULT_PREFERRED_SETUPS: SwingSniperStructureStrategy[] = [
  'call_debit_spread',
  'put_debit_spread',
  'call_calendar',
  'put_calendar',
  'call_diagonal',
  'put_diagonal',
  'call_butterfly',
  'put_butterfly',
]

const ADVANCED_SETUPS = new Set<SwingSniperStructureStrategy>([
  'long_call',
  'long_put',
  'long_straddle',
  'long_strangle',
])

async function loadJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error('request_failed')
  }

  return response.json() as Promise<T>
}

function toDirection(view: SwingSniperDossierPayload['view'] | SwingSniperBoardIdea['view']): SwingSniperDirection {
  if (view === 'Long vol') return 'long_vol'
  if (view === 'Short vol') return 'short_vol'
  return 'neutral'
}

function updatedLabel(generatedAt: string | null): string | null {
  if (!generatedAt) return null
  const deltaMs = Date.now() - new Date(generatedAt).getTime()
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return null
  const minutes = Math.floor(deltaMs / 60_000)
  if (minutes <= 0) return 'Updated just now'
  return `Updated ${minutes} min ago`
}

function parseRetryAfterMs(value: string | null): number {
  if (!value) return 30_000

  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.max(1_000, Math.round(seconds * 1_000))
  }

  const retryAt = Date.parse(value)
  if (Number.isFinite(retryAt)) {
    return Math.max(1_000, retryAt - Date.now())
  }

  return 30_000
}

function buildDossierThesisPayload(dossier: SwingSniperDossierPayload): SavedThesisPayload {
  return {
    symbol: dossier.symbol,
    score: dossier.orc_score,
    setupLabel: `${dossier.view} · ${dossier.catalyst_label}`,
    direction: toDirection(dossier.view),
    thesis: dossier.headline,
    ivRankAtSave: dossier.vol_map.iv_rank,
    catalystLabel: dossier.catalyst_label,
    catalystDate: dossier.catalysts[0]?.date || null,
    monitorNote: dossier.risk.exit_framework,
  }
}

function buildBoardThesisPayload(idea: SwingSniperBoardIdea): SavedThesisPayload {
  return {
    symbol: idea.symbol,
    score: idea.orc_score,
    setupLabel: `${idea.view} · ${idea.catalyst_label}`,
    direction: toDirection(idea.view),
    thesis: idea.blurb,
    ivRankAtSave: null,
    catalystLabel: idea.catalyst_label,
    catalystDate: null,
    monitorNote: 'Saved from the ranked board. Refresh the dossier to monitor thesis drift.',
  }
}

export function SwingSniperShell() {
  const [board, setBoard] = useState<SwingSniperBoardPayload | null>(null)
  const [boardLoading, setBoardLoading] = useState(true)
  const [boardFailureCount, setBoardFailureCount] = useState(0)

  const [memo, setMemo] = useState<SwingSniperMemoPayload | null>(null)
  const [memoLoading, setMemoLoading] = useState(true)

  const [monitoring, setMonitoring] = useState<SwingSniperMonitoringPayload | null>(null)
  const [monitoringLoading, setMonitoringLoading] = useState(true)

  const [watchlist, setWatchlist] = useState<SwingSniperWatchlistPayload | null>(null)
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<DossierTab>('Thesis')

  const [dossier, setDossier] = useState<SwingSniperDossierPayload | null>(null)
  const [dossierLoading, setDossierLoading] = useState(false)
  const [dossierError, setDossierError] = useState(false)

  const [thesisPendingSymbol, setThesisPendingSymbol] = useState<string | null>(null)
  const [watchlistPendingSymbol, setWatchlistPendingSymbol] = useState<string | null>(null)
  const [preferencesPending, setPreferencesPending] = useState(false)
  const [mandateOpen, setMandateOpen] = useState(false)
  const [savedDrawerOpen, setSavedDrawerOpen] = useState(false)
  const [filters, setFilters] = useState<SwingSniperWatchlistPayload['filters']>({
    preset: 'all',
    minScore: 0,
    riskMode: 'defined_risk_only',
    swingWindow: 'seven_to_fourteen',
    preferredSetups: [...DEFAULT_PREFERRED_SETUPS],
  })
  const dossierCacheRef = useRef(new Map<string, SwingSniperDossierPayload>())
  const dossierInflightRef = useRef(new Map<string, Promise<SwingSniperDossierPayload | null>>())
  const dossierRateLimitRef = useRef(new Map<string, number>())
  const boardRef = useRef<SwingSniperBoardPayload | null>(null)
  const activeSymbolRef = useRef<string | null>(null)
  const dossierRequestIdRef = useRef(0)
  const activeDossier = useMemo(() => {
    if (!dossier || !activeSymbol) return null
    return dossier.symbol === activeSymbol ? dossier : null
  }, [activeSymbol, dossier])

  const loadBoard = useCallback(async (refresh: boolean = false) => {
    if (!boardRef.current) setBoardLoading(true)

    try {
      const query = refresh ? '?refresh=1' : ''
      const payload = await loadJson<SwingSniperBoardPayload>(`/api/members/swing-sniper/board${query}`)
      setBoard(payload)
      setBoardFailureCount(0)
    } catch {
      if (!boardRef.current) {
        setBoardFailureCount((current) => current + 1)
      }
    } finally {
      setBoardLoading(false)
    }
  }, [])

  const loadMemo = useCallback(async () => {
    setMemoLoading(true)
    try {
      const payload = await loadJson<SwingSniperMemoPayload>('/api/members/swing-sniper/memo')
      setMemo(payload)
    } catch {
      setMemo(null)
    } finally {
      setMemoLoading(false)
    }
  }, [])

  const loadMonitoring = useCallback(async () => {
    setMonitoringLoading(true)
    try {
      const payload = await loadJson<SwingSniperMonitoringPayload>('/api/members/swing-sniper/monitoring')
      setMonitoring(payload)
    } catch {
      setMonitoring(null)
    } finally {
      setMonitoringLoading(false)
    }
  }, [])

  const loadWatchlist = useCallback(async () => {
    try {
      const payload = await loadJson<SwingSniperWatchlistPayload>('/api/members/swing-sniper/watchlist')
      setWatchlist(payload)
      setFilters(payload.filters)
      if (payload.selectedSymbol) {
        setActiveSymbol(payload.selectedSymbol)
      }
    } catch {
      setWatchlist(null)
    }
  }, [])

  const loadDossier = useCallback(async (
    symbol: string,
    options?: {
      force?: boolean
      prefetch?: boolean
    },
  ) => {
    const cached = dossierCacheRef.current.get(symbol)
    const inFlight = dossierInflightRef.current.get(symbol)
    if (inFlight) return inFlight

    if (!options?.force) {
      const retryAt = dossierRateLimitRef.current.get(symbol)
      if (retryAt && retryAt > Date.now()) {
        if (!options?.prefetch && activeSymbolRef.current === symbol) {
          if (cached) {
            setDossier(cached)
            setDossierError(false)
          } else {
            setDossier(null)
            setDossierError(true)
          }
          setDossierLoading(false)
        }
        return cached ?? null
      }
    }

    if (cached && !options?.force) {
      if (!options?.prefetch && activeSymbolRef.current === symbol) {
        setDossier(cached)
        setDossierError(false)
        setDossierLoading(false)
      }
      return cached
    }

    const requestId = options?.prefetch ? dossierRequestIdRef.current : dossierRequestIdRef.current + 1
    if (!options?.prefetch) {
      dossierRequestIdRef.current = requestId
      setDossierLoading(true)
      setDossierError(false)
    }

    const requestPromise = (async () => {
      try {
        const response = await fetch(`/api/members/swing-sniper/dossier/${encodeURIComponent(symbol)}`, {
          method: 'GET',
          cache: 'no-store',
        })

        if (response.status === 429) {
          dossierRateLimitRef.current.set(symbol, Date.now() + parseRetryAfterMs(response.headers.get('retry-after')))
          throw new Error('dossier_rate_limited')
        }

        if (!response.ok) {
          throw new Error('dossier_failed')
        }

        dossierRateLimitRef.current.delete(symbol)

        const payload = await response.json() as SwingSniperDossierPayload
        dossierCacheRef.current.set(symbol, payload)

        if (!options?.prefetch && requestId === dossierRequestIdRef.current && activeSymbolRef.current === symbol) {
          setDossier(payload)
        }

        return payload
      } catch {
        if (!options?.prefetch && requestId === dossierRequestIdRef.current && activeSymbolRef.current === symbol) {
          if (!cached) {
            setDossier(null)
          }
          setDossierError(true)
        }

        return null
      } finally {
        dossierInflightRef.current.delete(symbol)
        if (!options?.prefetch && requestId === dossierRequestIdRef.current && activeSymbolRef.current === symbol) {
          setDossierLoading(false)
        }
      }
    })()

    dossierInflightRef.current.set(symbol, requestPromise)
    return requestPromise
  }, [])

  const refreshAll = useCallback(async (refreshBoard: boolean = false) => {
    if (refreshBoard) {
      dossierCacheRef.current.clear()
      dossierRateLimitRef.current.clear()
    }

    await Promise.all([
      loadBoard(refreshBoard),
      loadMemo(),
      loadMonitoring(),
      loadWatchlist(),
      activeSymbolRef.current ? loadDossier(activeSymbolRef.current, { force: refreshBoard }) : Promise.resolve(null),
    ])
  }, [loadBoard, loadDossier, loadMemo, loadMonitoring, loadWatchlist])

  const persistWatchlistUpdate = useCallback(async (
    payload: SwingSniperWatchlistSavePayload,
    options?: {
      reloadMemo?: boolean
      reloadMonitoring?: boolean
      reloadDossier?: boolean
    },
  ) => {
    const response = await fetch('/api/members/swing-sniper/watchlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error('watchlist_update_failed')
    }

    const saved = await response.json() as SaveWatchlistResponse
    setWatchlist(saved.data)
    setFilters(saved.data.filters)

    const nextTasks: Promise<unknown>[] = []
    if (options?.reloadMemo) nextTasks.push(loadMemo())
    if (options?.reloadMonitoring) nextTasks.push(loadMonitoring())
    if (options?.reloadDossier && activeSymbol) nextTasks.push(loadDossier(activeSymbol, { force: true }))
    if (nextTasks.length > 0) {
      await Promise.all(nextTasks)
    }

    return saved.data
  }, [activeSymbol, loadDossier, loadMemo, loadMonitoring])

  useEffect(() => {
    void refreshAll(false)
  }, [refreshAll])

  useEffect(() => {
    if (board || boardFailureCount === 0 || boardFailureCount >= 3) return
    const timeout = window.setTimeout(() => {
      void loadBoard(false)
    }, 10_000)
    return () => window.clearTimeout(timeout)
  }, [board, boardFailureCount, loadBoard])

  useEffect(() => {
    if (!activeSymbol && board?.ideas.length) {
      const preferred = watchlist?.selectedSymbol
      const preferredAvailable = preferred != null && board.ideas.some((idea) => idea.symbol === preferred)
      setActiveSymbol(preferredAvailable ? preferred : board.ideas[0].symbol)
    }
  }, [activeSymbol, board, watchlist])

  useEffect(() => {
    activeSymbolRef.current = activeSymbol
  }, [activeSymbol])

  useEffect(() => {
    boardRef.current = board
  }, [board])

  useEffect(() => {
    if (!activeSymbol) return
    void loadDossier(activeSymbol)
  }, [activeSymbol, loadDossier])

  useEffect(() => {
    if (!board?.ideas.length) return

    const symbolsToPrefetch = board.ideas
      .slice(0, 5)
      .map((idea) => idea.symbol)
      .filter((symbol) => symbol !== activeSymbol && !dossierCacheRef.current.has(symbol))

    symbolsToPrefetch.forEach((symbol) => {
      void loadDossier(symbol, { prefetch: true })
    })
  }, [activeSymbol, board, loadDossier])

  const handleSelectSymbol = (symbol: string) => {
    if (symbol === activeSymbol) return
    setActiveTab('Thesis')
    setWatchlist((current) => current ? { ...current, selectedSymbol: symbol } : current)
    setActiveSymbol(symbol)
  }

  const handleSaveThesis = useCallback(async (thesisPayload: SavedThesisPayload) => {
    setThesisPendingSymbol(thesisPayload.symbol)

    try {
      await persistWatchlistUpdate({
        selectedSymbol: thesisPayload.symbol,
        symbols: watchlist?.symbols || [],
        filters,
        thesis: thesisPayload,
      }, {
        reloadMemo: true,
        reloadMonitoring: true,
      })
    } catch {
      // Keep the current dossier in place if persistence fails.
    } finally {
      setThesisPendingSymbol(null)
    }
  }, [filters, persistWatchlistUpdate, watchlist])

  const handleRemoveThesis = useCallback(async (symbol: string) => {
    setThesisPendingSymbol(symbol)

    try {
      await persistWatchlistUpdate({
        selectedSymbol: activeSymbol,
        removeThesisSymbol: symbol,
      }, {
        reloadMemo: true,
        reloadMonitoring: true,
      })
    } catch {
      // Preserve current state so the user can retry without losing context.
    } finally {
      setThesisPendingSymbol(null)
    }
  }, [activeSymbol, persistWatchlistUpdate])

  const handleAddToWatchlist = useCallback(async () => {
    if (!activeDossier) return

    setWatchlistPendingSymbol(activeDossier.symbol)

    try {
      await persistWatchlistUpdate({
        selectedSymbol: activeDossier.symbol,
        symbols: Array.from(new Set([...(watchlist?.symbols || []), activeDossier.symbol])),
      })
    } catch {
      // Watchlist add should fail quietly and keep dossier visible.
    } finally {
      setWatchlistPendingSymbol(null)
    }
  }, [activeDossier, persistWatchlistUpdate, watchlist])

  const handleSavePreferences = useCallback(async () => {
    setPreferencesPending(true)

    try {
      await persistWatchlistUpdate({
        filters,
        selectedSymbol: activeSymbol,
      }, {
        reloadDossier: true,
      })
      setMandateOpen(false)
    } catch {
      // Preserve local preference edits for retry when save fails.
    } finally {
      setPreferencesPending(false)
    }
  }, [activeSymbol, filters, persistWatchlistUpdate])

  const savedSymbols = useMemo(
    () => watchlist?.savedTheses.map((item) => item.symbol) || [],
    [watchlist],
  )

  const activeIsSaved = activeDossier ? savedSymbols.includes(activeDossier.symbol) : false
  const stale = useMemo(
    () => updatedLabel(board?.generated_at ?? memo?.generated_at ?? monitoring?.generatedAt ?? null),
    [board, memo, monitoring],
  )

  if (!board && (boardLoading || boardFailureCount < 3)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="glass-card-heavy rounded-2xl border border-white/10 px-6 py-5 text-center">
          <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-300" />
          <p className="mt-3 text-sm text-white/85">Market data is refreshing. This usually takes a few seconds.</p>
        </div>
      </div>
    )
  }

  if (!board && boardFailureCount >= 3) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="glass-card-heavy rounded-2xl border border-white/10 px-6 py-5 text-center">
          <p className="text-sm text-white/85">Market data is temporarily offline. Check back shortly.</p>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="swing-sniper-shell" className="space-y-4">
      <section className="glass-card-heavy rounded-[28px] border border-white/10 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-emerald-500/35 bg-emerald-500/12 p-2">
                <Radar className="h-5 w-5 text-emerald-200" strokeWidth={1.6} />
              </div>
              <div>
                <h1 className="font-[family-name:var(--font-playfair)] text-4xl tracking-[-0.04em] text-white">
                  Swing Sniper
                </h1>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Action-first swing ideas filtered to your mandate.
                </p>
              </div>
            </div>

            {board?.regime ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-champagne/35 bg-champagne/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-champagne">
                  Regime: {board.regime.label} · {board.regime.market_posture}
                </span>
                {board.regime.bias ? (
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/65">
                    {board.regime.bias}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {stale ? (
              <span className="text-xs text-muted-foreground">{stale}</span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMandateOpen(true)}
              className="rounded-full border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]"
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Mandate
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSavedDrawerOpen(true)}
              className="rounded-full border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]"
            >
              <BookmarkCheck className="mr-2 h-4 w-4" />
              Saved
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refreshAll(true)}
              className="rounded-full border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]"
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', boardLoading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      <div className="relative isolate grid items-start gap-5 lg:grid-cols-[336px_minmax(0,1fr)] xl:gap-5 xl:grid-cols-[336px_minmax(0,1fr)_304px] 2xl:gap-6">
        <div className="relative z-20 xl:sticky xl:top-24 xl:self-start">
          <OpportunityBoard
            ideas={board?.ideas || []}
            loading={boardLoading}
            activeSymbol={activeSymbol}
            filters={filters}
            savedSymbols={savedSymbols}
            savingSymbol={thesisPendingSymbol}
            onPresetChange={(preset) => setFilters((current) => ({ ...current, preset }))}
            onOpenMandate={() => setMandateOpen(true)}
            onQuickSave={(idea) => {
              if (savedSymbols.includes(idea.symbol)) return
              void handleSaveThesis(buildBoardThesisPayload(idea))
            }}
            onSelect={handleSelectSymbol}
          />
        </div>

        <div className="relative z-10 min-w-0">
          <DossierPanel
            key={activeSymbol ?? 'none'}
            dossier={activeDossier}
            selectedSymbol={activeSymbol}
            monitoring={monitoring}
            loading={dossierLoading}
            error={dossierError}
            activeTab={activeTab}
            isSaved={activeIsSaved}
            thesisPending={Boolean(activeDossier?.symbol && thesisPendingSymbol === activeDossier.symbol)}
            watchlistPending={Boolean(activeDossier?.symbol && watchlistPendingSymbol === activeDossier.symbol)}
            onTabChange={setActiveTab}
            onSaveThesis={() => {
              if (!activeDossier) return
              void handleSaveThesis(buildDossierThesisPayload(activeDossier))
            }}
            onRemoveThesis={() => {
              if (!activeDossier) return
              void handleRemoveThesis(activeDossier.symbol)
            }}
            onAddToWatchlist={() => void handleAddToWatchlist()}
          />
        </div>

        <div className="relative z-10 lg:col-span-2 xl:col-span-1">
          <SwingSniperMemoRail
            memo={memo}
            memoLoading={memoLoading || monitoringLoading}
            monitoring={monitoring}
            savedTheses={watchlist?.savedTheses || []}
            activeSymbol={activeSymbol}
            onOpenSavedTheses={() => setSavedDrawerOpen(true)}
            onOpenSymbol={(symbol) => handleSelectSymbol(symbol)}
          />
        </div>
      </div>

      <MandateDrawer
        open={mandateOpen}
        onOpenChange={setMandateOpen}
        filters={filters}
        saving={preferencesPending}
        onRiskModeChange={(riskMode) => {
          setFilters((current) => {
            const nextSetups = riskMode === 'defined_risk_only'
              ? current.preferredSetups.filter((setup) => !ADVANCED_SETUPS.has(setup))
              : current.preferredSetups

            return {
              ...current,
              riskMode,
              preferredSetups: nextSetups.length > 0 ? nextSetups : [...DEFAULT_PREFERRED_SETUPS],
            }
          })
        }}
        onSwingWindowChange={(swingWindow) => setFilters((current) => ({ ...current, swingWindow }))}
        onMinScoreChange={(minScore) => setFilters((current) => ({ ...current, minScore }))}
        onToggleSetup={(setup) => {
          setFilters((current) => {
            const isSelected = current.preferredSetups.includes(setup)
            const preferredSetups = isSelected
              ? current.preferredSetups.filter((item) => item !== setup)
              : [...current.preferredSetups, setup]

            return {
              ...current,
              preferredSetups,
            }
          })
        }}
        onSave={() => void handleSavePreferences()}
      />

      <SavedThesesDrawer
        open={savedDrawerOpen}
        onOpenChange={setSavedDrawerOpen}
        savedTheses={watchlist?.savedTheses || []}
        monitoring={monitoring}
        activeSymbol={activeSymbol}
        pendingSymbol={thesisPendingSymbol}
        onOpenSymbol={(symbol) => {
          handleSelectSymbol(symbol)
          setSavedDrawerOpen(false)
        }}
        onRemoveSymbol={(symbol) => void handleRemoveThesis(symbol)}
      />

      {watchlistPendingSymbol ? (
        <div className="sr-only" aria-live="polite">
          Added {watchlistPendingSymbol} to the watchlist.
        </div>
      ) : null}
    </div>
  )
}
