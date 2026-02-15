'use client'

import { useMemo } from 'react'
import { useSPXQuery } from '@/hooks/use-spx-api'
import type { ClusterZone, SPXLevel } from '@/lib/types/spx-command-center'

interface LevelsResponse {
  levels: SPXLevel[]
  generatedAt: string
}

interface ClustersResponse {
  zones: ClusterZone[]
  generatedAt: string
}

export function useSPXLevels() {
  const levelsQuery = useSPXQuery<LevelsResponse>('/api/spx/levels', {
    refreshInterval: 30_000,
  })

  const clustersQuery = useSPXQuery<ClustersResponse>('/api/spx/clusters', {
    refreshInterval: 30_000,
  })

  const isLoading = levelsQuery.isLoading || clustersQuery.isLoading
  const error = levelsQuery.error || clustersQuery.error

  const generatedAt = useMemo(() => {
    return levelsQuery.data?.generatedAt || clustersQuery.data?.generatedAt || null
  }, [clustersQuery.data?.generatedAt, levelsQuery.data?.generatedAt])

  return {
    levels: levelsQuery.data?.levels || [],
    clusterZones: clustersQuery.data?.zones || [],
    generatedAt,
    isLoading,
    error,
    mutate: async () => {
      await Promise.all([levelsQuery.mutate(), clustersQuery.mutate()])
    },
  }
}
