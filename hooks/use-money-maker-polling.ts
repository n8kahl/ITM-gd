'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useMoneyMaker } from '@/components/money-maker/money-maker-provider'
import { useMemberAuth } from '@/contexts/MemberAuthContext'

const WATCHLIST_ENDPOINT = '/api/members/money-maker/watchlist'
const SNAPSHOT_ENDPOINT = '/api/members/money-maker/snapshot'
const POLLING_INTERVAL_MS = 5 * 1000

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
    try {
        const payload = await response.json()
        if (typeof payload?.error === 'string' && payload.error.trim()) {
            return payload.error
        }
        if (typeof payload?.message === 'string' && payload.message.trim()) {
            return payload.message
        }
    } catch {
        // Ignore JSON parse failures and use the fallback message below.
    }

    return fallback
}

export function useMoneyMakerPolling() {
    const { session } = useMemberAuth()
    const {
        setSymbols,
        setSignals,
        setSymbolSnapshots,
        setIsLoading,
        setIsRefreshing,
        setError,
        setLastUpdated,
    } = useMoneyMaker()
    const hasLoadedSnapshot = useRef(false)
    const snapshotRequestRef = useRef<Promise<void> | null>(null)

    const fetchWatchlist = useCallback(async () => {
        if (!session?.access_token) return

        try {
            const response = await fetch(WATCHLIST_ENDPOINT, {
                headers: { Authorization: `Bearer ${session.access_token}` },
                cache: 'no-store',
            })

            if (!response.ok) {
                throw new Error(await readErrorMessage(response, 'Failed to load watchlist'))
            }

            const data = await response.json()
            const symbols = Array.isArray(data.watchlists)
                ? data.watchlists
                    .map((watchlist: { symbol?: unknown }) => watchlist?.symbol)
                    .filter((symbol: unknown): symbol is string => typeof symbol === 'string' && symbol.length > 0)
                : []

            if (symbols.length > 0) {
                setSymbols(symbols)
            }
        } catch (err) {
            console.error('Watchlist fetch error:', err)
        }
    }, [session?.access_token, setSymbols])

    const fetchSnapshot = useCallback(async (mode: 'initial' | 'background' = 'background') => {
        if (!session?.access_token) return
        if (snapshotRequestRef.current) {
            return snapshotRequestRef.current
        }

        const requestPromise = (async () => {
            const isInitialLoad = mode === 'initial' || !hasLoadedSnapshot.current
            if (isInitialLoad) {
                setIsLoading(true)
            } else {
                setIsRefreshing(true)
            }

            try {
                const response = await fetch(SNAPSHOT_ENDPOINT, {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                    cache: 'no-store',
                })

                if (!response.ok) {
                    throw new Error(await readErrorMessage(response, 'Failed to load market snapshot'))
                }

                const data = await response.json()
                const signals = Array.isArray(data.signals) ? data.signals : []
                const symbolSnapshots = Array.isArray(data.symbolSnapshots) ? data.symbolSnapshots : []
                const symbols = symbolSnapshots
                    .map((snapshot: { symbol?: unknown }) => snapshot?.symbol)
                    .filter((symbol: unknown): symbol is string => typeof symbol === 'string' && symbol.length > 0)

                setSignals(signals)
                setSymbolSnapshots(symbolSnapshots)
                if (symbols.length > 0) {
                    setSymbols(symbols)
                }
                setLastUpdated(typeof data.timestamp === 'number' ? data.timestamp : Date.now())
                setError(null)
                hasLoadedSnapshot.current = true
            } catch (err: any) {
                setError(err?.message || 'Unknown polling error')
            } finally {
                setIsLoading(false)
                setIsRefreshing(false)
                snapshotRequestRef.current = null
            }
        })()

        snapshotRequestRef.current = requestPromise
        return requestPromise
    }, [session?.access_token, setError, setIsLoading, setIsRefreshing, setLastUpdated, setSignals, setSymbolSnapshots, setSymbols])

    useEffect(() => {
        hasLoadedSnapshot.current = false

        if (!session?.access_token) {
            setSignals([])
            setSymbolSnapshots([])
            setIsLoading(false)
            setIsRefreshing(false)
            return
        }

        let cancelled = false

        const hydrate = async () => {
            await fetchWatchlist()
            if (!cancelled) {
                await fetchSnapshot('initial')
            }
        }

        void hydrate()

        const interval = window.setInterval(() => {
            void fetchSnapshot('background')
        }, POLLING_INTERVAL_MS)

        return () => {
            cancelled = true
            window.clearInterval(interval)
        }
    }, [session?.access_token, fetchSnapshot, fetchWatchlist, setIsLoading, setIsRefreshing, setSignals, setSymbolSnapshots])

    return {
        refreshSnapshot: () => fetchSnapshot(hasLoadedSnapshot.current ? 'background' : 'initial'),
    }
}
