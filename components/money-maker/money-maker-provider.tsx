'use client'

import React, { createContext, useContext, ReactNode, useState, useCallback } from 'react'
import { MoneyMakerSignal } from '@/lib/money-maker/types'

const DEFAULT_SYMBOLS = ['SPY', 'TSLA', 'AAPL', 'NVDA', 'META']

export interface MoneyMakerState {
    symbols: string[]
    signals: MoneyMakerSignal[]
    isLoading: boolean
    isRefreshing: boolean
    lastUpdated: number | null
    error: string | null
}

export interface MoneyMakerContextType {
    state: MoneyMakerState
    setSymbols: (symbols: string[]) => void
    setSignals: (signals: MoneyMakerSignal[]) => void
    setIsLoading: (loading: boolean) => void
    setIsRefreshing: (refreshing: boolean) => void
    setError: (error: string | null) => void
    setLastUpdated: (timestamp: number) => void
}

const MoneyMakerContext = createContext<MoneyMakerContextType | undefined>(undefined)

export function MoneyMakerProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<MoneyMakerState>({
        symbols: DEFAULT_SYMBOLS,
        signals: [],
        isLoading: true,
        isRefreshing: false,
        lastUpdated: null,
        error: null,
    })

    const setSymbols = useCallback((symbols: string[]) => {
        setState(prev => ({ ...prev, symbols }))
    }, [])

    const setSignals = useCallback((signals: MoneyMakerSignal[]) => {
        setState(prev => ({ ...prev, signals }))
    }, [])

    const setIsLoading = useCallback((isLoading: boolean) => {
        setState(prev => ({ ...prev, isLoading }))
    }, [])

    const setIsRefreshing = useCallback((isRefreshing: boolean) => {
        setState(prev => ({ ...prev, isRefreshing }))
    }, [])

    const setError = useCallback((error: string | null) => {
        setState(prev => ({ ...prev, error }))
    }, [])

    const setLastUpdated = useCallback((lastUpdated: number) => {
        setState(prev => ({ ...prev, lastUpdated }))
    }, [])

    return (
        <MoneyMakerContext.Provider
            value={{
                state,
                setSymbols,
                setSignals,
                setIsLoading,
                setIsRefreshing,
                setError,
                setLastUpdated,
            }}
        >
            {children}
        </MoneyMakerContext.Provider>
    )
}

export function useMoneyMaker() {
    const context = useContext(MoneyMakerContext)
    if (context === undefined) {
        throw new Error('useMoneyMaker must be used within a MoneyMakerProvider')
    }
    return context
}
