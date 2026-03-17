'use client'

import { useCallback, useEffect, useRef } from 'react'
import { MoneyMakerWorkspaceResponse } from '@/lib/money-maker/types'
import { useMoneyMaker } from '@/components/money-maker/money-maker-provider'
import { useMemberSession } from '@/contexts/MemberAuthContext'

const WORKSPACE_ENDPOINT = '/api/members/money-maker/workspace'

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
        // Ignore parse failures and fall back to the default string below.
    }

    return fallback
}

export function useMoneyMakerWorkspace() {
    const { session } = useMemberSession()
    const {
        state,
        setWorkspace,
        setWorkspaceError,
        setIsWorkspaceLoading,
    } = useMoneyMaker()
    const activeRequestRef = useRef<{ id: number; controller: AbortController } | null>(null)
    const requestSequenceRef = useRef(0)

    const loadWorkspace = useCallback(async (symbol: string) => {
        if (!session?.access_token || !symbol) return
        const requestId = requestSequenceRef.current + 1
        requestSequenceRef.current = requestId

        activeRequestRef.current?.controller.abort()
        const controller = new AbortController()
        activeRequestRef.current = {
            id: requestId,
            controller,
        }

        setIsWorkspaceLoading(true)
        setWorkspaceError(null)

        try {
            const response = await fetch(`${WORKSPACE_ENDPOINT}?symbol=${encodeURIComponent(symbol)}`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
                cache: 'no-store',
                signal: controller.signal,
            })

            if (!response.ok) {
                throw new Error(await readErrorMessage(response, 'Failed to load Money Maker workspace'))
            }

            const payload = await response.json() as MoneyMakerWorkspaceResponse
            if (activeRequestRef.current?.id !== requestId) {
                return
            }

            setWorkspace(payload)
        } catch (error: any) {
            if (controller.signal.aborted || activeRequestRef.current?.id !== requestId) {
                return
            }

            setWorkspaceError(error?.message || 'Failed to load Money Maker workspace')
        } finally {
            if (activeRequestRef.current?.id === requestId) {
                setIsWorkspaceLoading(false)
                activeRequestRef.current = null
            }
        }
    }, [session?.access_token, setIsWorkspaceLoading, setWorkspace, setWorkspaceError])

    useEffect(() => {
        if (!state.isWorkspaceOpen || !state.workspaceSymbol || !session?.access_token) {
            return
        }

        const currentSymbol = state.workspace?.symbolSnapshot.symbol
        if (state.workspace && currentSymbol === state.workspaceSymbol && !state.workspaceError) {
            return
        }

        void loadWorkspace(state.workspaceSymbol)
    }, [
        loadWorkspace,
        session?.access_token,
        state.isWorkspaceOpen,
        state.workspace,
        state.workspaceError,
        state.workspaceSymbol,
    ])

    useEffect(() => {
        if (state.isWorkspaceOpen) {
            return
        }

        activeRequestRef.current?.controller.abort()
        activeRequestRef.current = null
    }, [state.isWorkspaceOpen])

    useEffect(() => {
        return () => {
            activeRequestRef.current?.controller.abort()
            activeRequestRef.current = null
        }
    }, [])

    return {
        refreshWorkspace: () => state.workspaceSymbol ? loadWorkspace(state.workspaceSymbol) : Promise.resolve(),
    }
}
