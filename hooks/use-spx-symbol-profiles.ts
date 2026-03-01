'use client'

import { useCallback, useMemo, useState } from 'react'
import { useSPXQuery } from '@/hooks/use-spx-api'

export interface SPXSymbolProfileSummary {
  symbol: string
  displayName: string
  isActive: boolean
  massiveTicker: string
  crossSymbol: string
  updatedAt: string | null
}

export interface SPXSymbolProfile {
  symbol: string
  displayName: string
  level: {
    roundNumberInterval: number
    openingRangeMinutes: number
    clusterRadiusPoints: number
  }
  gex: {
    scalingFactor: number
    crossSymbol: string
    strikeWindowPoints: number
  }
  flow: {
    minPremium: number
    minVolume: number
    directionalMinPremium: number
  }
  multiTF: {
    emaFast: number
    emaSlow: number
    weight1h: number
    weight15m: number
    weight5m: number
    weight1m: number
  }
  regime: {
    breakoutThreshold: number
    compressionThreshold: number
  }
  tickers: {
    massiveTicker: string
    massiveOptionsTicker: string | null
  }
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
}

interface SPXSymbolProfileListResponse {
  profiles: SPXSymbolProfileSummary[]
  count: number
  includeInactive: boolean
  generatedAt: string
}

interface SPXSymbolProfileDetailResponse {
  profile: SPXSymbolProfile
  summary: SPXSymbolProfileSummary
}

export function useSPXSymbolProfiles() {
  const [selectedSymbolOverride, setSelectedSymbolOverride] = useState<string | null>(null)

  const listQuery = useSPXQuery<SPXSymbolProfileListResponse>('/api/spx/symbol-profiles?includeInactive=true', {
    refreshInterval: 120_000,
    revalidateOnFocus: false,
    errorRetryCount: 0,
  })

  const symbols = useMemo(() => {
    const rows = listQuery.data?.profiles || []
    return rows.map((profile) => profile.symbol)
  }, [listQuery.data?.profiles])

  const selectedSymbol = useMemo(() => {
    if (symbols.length === 0) return null
    if (selectedSymbolOverride && symbols.includes(selectedSymbolOverride)) return selectedSymbolOverride
    return symbols[0]
  }, [selectedSymbolOverride, symbols])

  const setSelectedSymbol = useCallback((symbol: string | null) => {
    setSelectedSymbolOverride(symbol)
  }, [])

  const detailEndpoint = selectedSymbol
    ? `/api/spx/symbol-profiles/${encodeURIComponent(selectedSymbol)}`
    : null

  const detailQuery = useSPXQuery<SPXSymbolProfileDetailResponse>(detailEndpoint, {
    refreshInterval: 120_000,
    revalidateOnFocus: false,
    errorRetryCount: 0,
  })

  return {
    profiles: listQuery.data?.profiles || [],
    selectedSymbol,
    setSelectedSymbol,
    selectedProfile: detailQuery.data?.profile || null,
    selectedSummary: detailQuery.data?.summary || null,
    isLoadingList: listQuery.isLoading,
    isLoadingDetail: detailQuery.isLoading,
    listError: listQuery.error,
    detailError: detailQuery.error,
    refreshList: listQuery.mutate,
    refreshDetail: detailQuery.mutate,
  }
}
