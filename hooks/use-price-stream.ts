'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ============================================
// TYPES
// ============================================

export interface PriceUpdate {
  symbol: string
  price: number
  change: number
  changePct: number
  volume: number
  timestamp: string
}

export interface MarketStatusUpdate {
  status: 'open' | 'pre-market' | 'after-hours' | 'closed'
  session: string
  message: string
}

interface PriceStreamState {
  prices: Map<string, PriceUpdate>
  marketStatus: MarketStatusUpdate | null
  isConnected: boolean
  error: string | null
}

// ============================================
// HOOK
// ============================================

/**
 * Hook for connecting to the WebSocket price stream.
 * Automatically reconnects on disconnect with exponential backoff.
 *
 * @param symbols - Array of symbols to subscribe to (e.g. ['SPX', 'NDX'])
 * @param enabled - Whether the connection should be active
 */
export function usePriceStream(symbols: string[], enabled: boolean = true) {
  const [state, setState] = useState<PriceStreamState>({
    prices: new Map(),
    marketStatus: null,
    isConnected: false,
    error: null,
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const symbolsRef = useRef(symbols)
  symbolsRef.current = symbols

  const connect = useCallback(() => {
    if (!enabled) return

    // Build WebSocket URL from current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || ''
    let wsUrl: string

    if (backendUrl) {
      // Use configured backend URL
      const url = new URL(backendUrl)
      wsUrl = `${protocol}//${url.host}/ws/prices`
    } else {
      wsUrl = `${protocol}//${window.location.host}/ws/prices`
    }

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        reconnectAttemptRef.current = 0
        setState(prev => ({ ...prev, isConnected: true, error: null }))

        // Subscribe to symbols
        if (symbolsRef.current.length > 0) {
          ws.send(JSON.stringify({ type: 'subscribe', symbols: symbolsRef.current }))
        }
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)

          if (msg.type === 'price') {
            setState(prev => {
              const newPrices = new Map(prev.prices)
              newPrices.set(msg.symbol, {
                symbol: msg.symbol,
                price: msg.price,
                change: msg.change,
                changePct: msg.changePct,
                volume: msg.volume,
                timestamp: msg.timestamp,
              })
              return { ...prev, prices: newPrices }
            })
          } else if (msg.type === 'status') {
            setState(prev => ({
              ...prev,
              marketStatus: {
                status: msg.status,
                session: msg.session,
                message: msg.message,
              },
            }))
          }
          // Ignore pong, error handled below
        } catch {
          // Ignore parse errors
        }
      }

      ws.onclose = () => {
        wsRef.current = null
        setState(prev => ({ ...prev, isConnected: false }))

        // Reconnect with exponential backoff (max 30 seconds)
        if (enabled) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000)
          reconnectAttemptRef.current++
          reconnectTimerRef.current = setTimeout(connect, delay)
        }
      }

      ws.onerror = () => {
        setState(prev => ({ ...prev, error: 'WebSocket connection error' }))
      }
    } catch {
      setState(prev => ({ ...prev, error: 'Failed to create WebSocket connection' }))
    }
  }, [enabled])

  // Connect/disconnect based on enabled flag
  useEffect(() => {
    if (enabled) {
      connect()
    }

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [enabled, connect])

  // Update subscriptions when symbols change
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && symbols.length > 0) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', symbols }))
    }
  }, [symbols])

  // Helper to get price for a specific symbol
  const getPrice = useCallback((symbol: string): PriceUpdate | undefined => {
    return state.prices.get(symbol)
  }, [state.prices])

  return {
    prices: state.prices,
    marketStatus: state.marketStatus,
    isConnected: state.isConnected,
    error: state.error,
    getPrice,
  }
}
