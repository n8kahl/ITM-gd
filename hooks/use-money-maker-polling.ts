'use client'

import { useEffect, useRef } from 'react'
import { useMoneyMaker } from '@/components/money-maker/money-maker-provider'
import { useMemberAuth } from '@/contexts/MemberAuthContext'

const POLLING_INTERVAL_MS = 60 * 1000 // Every 1 minute

export function useMoneyMakerPolling() {
    const { session } = useMemberAuth()
    const { state, setSymbols, setIsLoading, setError, setLastUpdated } = useMoneyMaker()
    const hasInitialFetch = useRef(false)

    // 1. Fetch Watchlist on mount
    useEffect(() => {
        if (!session?.access_token || hasInitialFetch.current) return

        const fetchWatchlist = async () => {
            try {
                const res = await fetch('/api/money-maker/watchlist', {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                })

                if (!res.ok) throw new Error('Failed to load watchlist')

                const data = await res.json()
                const symbols = data.watchlists?.map((w: any) => w.symbol) || ['SPY', 'QQQ', 'IWM']
                setSymbols(symbols)
            } catch (err: any) {
                console.error('Watchlist fetch error:', err)
                // Fallback silently to defaults
            }
        }

        fetchWatchlist()
        hasInitialFetch.current = true
    }, [session, setSymbols])

    // 2. Poll Snapshot
    useEffect(() => {
        if (!session?.access_token) return

        const fetchSnapshot = async () => {
            setIsLoading(true)
            try {
                const res = await fetch('/api/money-maker/snapshot', {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                })

                if (!res.ok) throw new Error('Failed to load market snapshot')

                const data = await res.json()

                // Context will be expanded to store signals. For now we just mark success.
                setLastUpdated(data.timestamp || Date.now())
                setError(null)
            } catch (err: any) {
                setError(err.message || 'Unknown polling error')
            } finally {
                setIsLoading(false)
            }
        }

        fetchSnapshot()
        const interval = setInterval(fetchSnapshot, POLLING_INTERVAL_MS)

        return () => clearInterval(interval)
    }, [session, setIsLoading, setError, setLastUpdated])
}
