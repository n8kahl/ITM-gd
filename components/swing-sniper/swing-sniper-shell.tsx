'use client'

import { startTransition, useCallback, useEffect, useMemo, useState } from 'react'
import { Radar, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/members/page-header'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DossierPanel } from '@/components/swing-sniper/dossier-panel'
import { OpportunityBoard } from '@/components/swing-sniper/opportunity-board'
import { SwingSniperMemoRail } from '@/components/swing-sniper/swing-sniper-memo-rail'
import type {
  SwingSniperBoardPayload,
  SwingSniperDirection,
  SwingSniperDossierPayload,
  SwingSniperMemoPayload,
  SwingSniperMonitoringPayload,
  SwingSniperWatchlistPayload,
  SwingSniperWatchlistSavePayload,
} from '@/lib/swing-sniper/types'

type DossierTab = 'Thesis' | 'Vol Map' | 'Catalysts' | 'Structure' | 'Risk'

interface SaveWatchlistResponse {
  success: boolean
  data: SwingSniperWatchlistPayload
}

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

function toDirection(view: SwingSniperDossierPayload['view']): SwingSniperDirection {
  if (view === 'Long vol') return 'long_vol'
  if (view === 'Short vol') return 'short_vol'
  return 'neutral'
}

function staleLabel(generatedAt: string | null): string | null {
  if (!generatedAt) return null
  const deltaMs = Date.now() - new Date(generatedAt).getTime()
  if (!Number.isFinite(deltaMs) || deltaMs < 60_000) return null
  const minutes = Math.floor(deltaMs / 60_000)
  return `Updated ${minutes} min ago`
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

  const [savePending, setSavePending] = useState(false)
  const [filters, setFilters] = useState<SwingSniperWatchlistPayload['filters']>({
    preset: 'all',
    minScore: 0,
  })

  const loadBoard = useCallback(async (refresh: boolean = false) => {
    if (!board) setBoardLoading(true)

    try {
      const query = refresh ? '?refresh=1' : ''
      const payload = await loadJson<SwingSniperBoardPayload>(`/api/members/swing-sniper/board${query}`)
      setBoard(payload)
      setBoardFailureCount(0)
    } catch {
      if (!board) {
        setBoardFailureCount((current) => current + 1)
      }
    } finally {
      setBoardLoading(false)
    }
  }, [board])

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

  const loadDossier = useCallback(async (symbol: string) => {
    setDossierLoading(true)
    setDossierError(false)

    try {
      const response = await fetch(`/api/members/swing-sniper/dossier/${encodeURIComponent(symbol)}`, {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error('dossier_failed')
      }

      const payload = await response.json() as SwingSniperDossierPayload
      setDossier(payload)
    } catch {
      setDossier(null)
      setDossierError(true)
    } finally {
      setDossierLoading(false)
    }
  }, [])

  const refreshAll = useCallback(async (refreshBoard: boolean = false) => {
    await Promise.all([
      loadBoard(refreshBoard),
      loadMemo(),
      loadMonitoring(),
      loadWatchlist(),
    ])
  }, [loadBoard, loadMemo, loadMonitoring, loadWatchlist])

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
    if (!activeSymbol) return
    void loadDossier(activeSymbol)
  }, [activeSymbol, loadDossier])

  const handleSelectSymbol = (symbol: string) => {
    setActiveTab('Thesis')
    startTransition(() => {
      setActiveSymbol(symbol)
    })
  }

  const handleSaveThesis = useCallback(async () => {
    if (!dossier) return

    setSavePending(true)

    const payload: SwingSniperWatchlistSavePayload = {
      selectedSymbol: dossier.symbol,
      symbols: watchlist?.symbols || [],
      filters,
      thesis: {
        symbol: dossier.symbol,
        score: dossier.orc_score,
        setupLabel: `${dossier.view} · ${dossier.catalyst_label}`,
        direction: toDirection(dossier.view),
        thesis: dossier.headline,
        ivRankAtSave: dossier.vol_map.iv_rank,
        catalystLabel: dossier.catalyst_label,
        catalystDate: dossier.catalysts[0]?.date || null,
        monitorNote: dossier.risk.exit_framework,
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
        throw new Error('save_failed')
      }

      const saved = await response.json() as SaveWatchlistResponse
      setWatchlist(saved.data)
      await Promise.all([
        loadMemo(),
        loadMonitoring(),
      ])
    } finally {
      setSavePending(false)
    }
  }, [dossier, filters, loadMemo, loadMonitoring, watchlist])

  const stale = useMemo(() => staleLabel(board?.generated_at ?? null), [board])

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
    <div data-testid="swing-sniper-shell" className="space-y-5">
      <PageHeader
        title="Swing Sniper"
        subtitle=""
        icon={<Radar className="h-5 w-5 text-emerald-300" strokeWidth={1.5} />}
        actions={(
          <div className="flex items-center gap-2">
            {stale ? (
              <span className="text-xs text-muted-foreground">{stale}</span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refreshAll(true)}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', boardLoading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        )}
      />

      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_320px]">
        <OpportunityBoard
          ideas={board?.ideas || []}
          loading={boardLoading}
          activeSymbol={activeSymbol}
          preset={filters.preset}
          onFilterChange={(preset) => setFilters((current) => ({ ...current, preset }))}
          onSelect={handleSelectSymbol}
        />

        <DossierPanel
          dossier={dossier}
          monitoring={monitoring}
          loading={dossierLoading}
          error={dossierError}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onSaveThesis={() => void handleSaveThesis()}
          onAddToWatchlist={() => void handleSaveThesis()}
          savePending={savePending}
        />

        <div className="lg:col-span-2 xl:col-span-1">
          <SwingSniperMemoRail
            memo={memo}
            memoLoading={memoLoading}
            monitoring={monitoring}
          />
        </div>
      </div>
    </div>
  )
}
