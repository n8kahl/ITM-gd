'use client'

import { useCallback, useEffect, useRef } from 'react'
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
    const requestRef = useRef<Promise<void> | null>(null)

    const loadWorkspace = useCallback(async (symbol: string) => {
        if (!session?.access_token || !symbol) return
        if (requestRef.current) {
            return requestRef.current
        }

        const requestPromise = (async () => {
            setIsWorkspaceLoading(true)
            setWorkspaceError(null)

            try {
                const response = await fetch(`${WORKSPACE_ENDPOINT}?symbol=${encodeURIComponent(symbol)}`, {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                    cache: 'no-store',
                })

                if (!response.ok) {
                    throw new Error(await readErrorMessage(response, 'Failed to load Money Maker workspace'))
                }

                const payload = await response.json()
                setWorkspace(payload)
            } catch (error: any) {
                setWorkspaceError(error?.message || 'Failed to load Money Maker workspace')
            } finally {
                setIsWorkspaceLoading(false)
                requestRef.current = null
            }
        })()

        requestRef.current = requestPromise
        return requestPromise
    }, [session?.access_token, setIsWorkspaceLoading, setWorkspace, setWorkspaceError])

    useEffect(() => {
        if (!state.isWorkspaceOpen || !state.workspaceSymbol || !session?.access_token) {
            return
        }

        const currentSymbol = state.workspace?.symbolSnapshot.symbol
        if (currentSymbol === state.workspaceSymbol && !state.workspaceError) {
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

    return {
        refreshWorkspace: () => state.workspaceSymbol ? loadWorkspace(state.workspaceSymbol) : Promise.resolve(),
    }
}
