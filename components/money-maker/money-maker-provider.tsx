'use client'

import React, { createContext, useContext, ReactNode, useState, useCallback } from 'react'
import { MoneyMakerSignal, MoneyMakerSymbolSnapshot, MoneyMakerWorkspaceResponse } from '@/lib/money-maker/types'

const DEFAULT_SYMBOLS = ['SPY', 'TSLA', 'AAPL', 'NVDA', 'META']

export interface MoneyMakerState {
    symbols: string[]
    signals: MoneyMakerSignal[]
    symbolSnapshots: MoneyMakerSymbolSnapshot[]
    isLoading: boolean
    isRefreshing: boolean
    lastUpdated: number | null
    error: string | null
    isWorkspaceOpen: boolean
    workspaceSymbol: string | null
    workspace: MoneyMakerWorkspaceResponse | null
    isWorkspaceLoading: boolean
    workspaceError: string | null
}

export interface MoneyMakerContextType {
    state: MoneyMakerState
    setSymbols: (symbols: string[]) => void
    setSignals: (signals: MoneyMakerSignal[]) => void
    setSymbolSnapshots: (snapshots: MoneyMakerSymbolSnapshot[]) => void
    setIsLoading: (loading: boolean) => void
    setIsRefreshing: (refreshing: boolean) => void
    setError: (error: string | null) => void
    setLastUpdated: (timestamp: number) => void
    openWorkspace: (symbol: string) => void
    closeWorkspace: () => void
    setWorkspace: (workspace: MoneyMakerWorkspaceResponse | null) => void
    setIsWorkspaceLoading: (loading: boolean) => void
    setWorkspaceError: (error: string | null) => void
}

const MoneyMakerContext = createContext<MoneyMakerContextType | undefined>(undefined)

export function MoneyMakerProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<MoneyMakerState>({
        symbols: DEFAULT_SYMBOLS,
        signals: [],
        symbolSnapshots: [],
        isLoading: true,
        isRefreshing: false,
        lastUpdated: null,
        error: null,
        isWorkspaceOpen: false,
        workspaceSymbol: null,
        workspace: null,
        isWorkspaceLoading: false,
        workspaceError: null,
    })

    const setSymbols = useCallback((symbols: string[]) => {
        setState(prev => ({ ...prev, symbols }))
    }, [])

    const setSignals = useCallback((signals: MoneyMakerSignal[]) => {
        setState(prev => ({ ...prev, signals }))
    }, [])

    const setSymbolSnapshots = useCallback((symbolSnapshots: MoneyMakerSymbolSnapshot[]) => {
        setState(prev => ({ ...prev, symbolSnapshots }))
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

    const openWorkspace = useCallback((symbol: string) => {
        setState(prev => ({
            ...prev,
            isWorkspaceOpen: true,
            workspaceSymbol: symbol,
            workspace: null,
            isWorkspaceLoading: true,
            workspaceError: null,
        }))
    }, [])

    const closeWorkspace = useCallback(() => {
        setState(prev => ({
            ...prev,
            isWorkspaceOpen: false,
            workspaceSymbol: null,
            workspace: null,
            isWorkspaceLoading: false,
            workspaceError: null,
        }))
    }, [])

    const setWorkspace = useCallback((workspace: MoneyMakerWorkspaceResponse | null) => {
        setState(prev => ({
            ...prev,
            workspace,
            workspaceSymbol: workspace?.symbolSnapshot.symbol ?? prev.workspaceSymbol,
        }))
    }, [])

    const setIsWorkspaceLoading = useCallback((isWorkspaceLoading: boolean) => {
        setState(prev => ({ ...prev, isWorkspaceLoading }))
    }, [])

    const setWorkspaceError = useCallback((workspaceError: string | null) => {
        setState(prev => ({ ...prev, workspaceError }))
    }, [])

    return (
        <MoneyMakerContext.Provider
            value={{
                state,
                setSymbols,
                setSignals,
                setSymbolSnapshots,
                setIsLoading,
                setIsRefreshing,
                setError,
                setLastUpdated,
                openWorkspace,
                closeWorkspace,
                setWorkspace,
                setIsWorkspaceLoading,
                setWorkspaceError,
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
