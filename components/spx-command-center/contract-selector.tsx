'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSPXSetupContext } from '@/contexts/spx/SPXSetupContext'
import { InfoTip } from '@/components/ui/info-tip'
import type { ContractRecommendation } from '@/lib/types/spx-command-center'
import { ContractCard } from '@/components/spx-command-center/contract-card'

const CONTRACT_RECOMMENDATION_COOLDOWN_MS = 12_000
const CONTRACT_RECOMMENDATION_DEBOUNCE_MS = 250

function contractSignature(contract: ContractRecommendation | null | undefined): string | null {
  if (!contract) return null
  return [contract.type, contract.strike, contract.expiry, contract.description].join('|')
}

function toRecommendationCandidates(recommendation: ContractRecommendation): ContractRecommendation[] {
  const alternatives = Array.isArray(recommendation.alternatives)
    ? recommendation.alternatives.map((alternative) => ({
      ...alternative,
      gamma: recommendation.gamma,
      theta: recommendation.theta,
      vega: recommendation.vega,
      riskReward: recommendation.riskReward,
      expectedPnlAtTarget1: recommendation.expectedPnlAtTarget1,
      expectedPnlAtTarget2: recommendation.expectedPnlAtTarget2,
      reasoning: alternative.tradeoff || recommendation.reasoning,
      premiumMid: ((alternative.bid + alternative.ask) / 2) * 100,
      premiumAsk: alternative.ask * 100,
    } as ContractRecommendation))
    : []
  return [recommendation, ...alternatives]
}

export function ContractSelector({ readOnly = false }: { readOnly?: boolean }) {
  const {
    selectedSetup,
    selectedSetupContract,
    requestContractRecommendation,
    setSetupContractChoice,
  } = useSPXSetupContext()
  const [contract, setContract] = useState<ContractRecommendation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const requestSequenceRef = useRef(0)
  const recommendationCacheRef = useRef<Map<string, { recommendation: ContractRecommendation; fetchedAt: number }>>(new Map())
  const selectedSetupRef = useRef(selectedSetup)
  const selectedSetupContractRef = useRef<ContractRecommendation | null>(selectedSetupContract || null)
  const selectedRecommendedContractRef = useRef<ContractRecommendation | null>(selectedSetup?.recommendedContract || null)

  const selectedSetupId = selectedSetup?.id || null
  const selectedSetupStatus = selectedSetup?.status || null
  const selectedSetupVersion = selectedSetup?.statusUpdatedAt || selectedSetup?.triggeredAt || selectedSetup?.createdAt || null
  const selectedSetupContractSignature = contractSignature(selectedSetupContract)
  const selectedRecommendedContract = selectedSetup?.recommendedContract || null
  const selectedRecommendedSignature = useMemo(() => {
    if (!selectedRecommendedContract) return null
    return [
      selectedRecommendedContract.description,
      selectedRecommendedContract.expiry,
      selectedRecommendedContract.strike,
      selectedRecommendedContract.bid,
      selectedRecommendedContract.ask,
      selectedRecommendedContract.riskReward,
      selectedRecommendedContract.maxLoss,
    ].join('|')
  }, [selectedRecommendedContract])

  useEffect(() => {
    selectedSetupRef.current = selectedSetup
    selectedSetupContractRef.current = selectedSetupContract || null
    selectedRecommendedContractRef.current = selectedSetup?.recommendedContract || null
  }, [selectedSetup, selectedSetupContract])

  useEffect(() => {
    let isCancelled = false
    const requestSequence = ++requestSequenceRef.current
    const setupId = selectedSetupId
    let requestTimer: number | null = null

    function run() {
      const setupForRequest = selectedSetupRef.current
      const selectedContract = selectedSetupContractRef.current
      const recommendedFromSnapshot = selectedRecommendedContractRef.current
      const cached = recommendationCacheRef.current.get(setupId || '')

      if (!setupId || !setupForRequest) {
        setContract(null)
        setIsLoading(false)
        setIsRefreshing(false)
        setErrorMessage(null)
        return
      }
      if (readOnly) {
        setContract(null)
        setIsLoading(false)
        setIsRefreshing(false)
        setErrorMessage(null)
        return
      }
      if (selectedSetupStatus !== 'ready' && selectedSetupStatus !== 'triggered') {
        setContract(null)
        setIsLoading(false)
        setIsRefreshing(false)
        setErrorMessage(null)
        return
      }

      if (recommendedFromSnapshot) {
        recommendationCacheRef.current.set(setupId, {
          recommendation: recommendedFromSnapshot,
          fetchedAt: Date.now(),
        })
        setContract(recommendedFromSnapshot)
        if (!selectedContract) {
          setSetupContractChoice(setupForRequest, recommendedFromSnapshot)
        }
        setIsLoading(false)
        setIsRefreshing(false)
        setErrorMessage(null)
        return
      }
      if (selectedContract) {
        if (cached) {
          setContract(cached.recommendation)
        } else {
          recommendationCacheRef.current.set(setupId, {
            recommendation: selectedContract,
            fetchedAt: Date.now(),
          })
          setContract(selectedContract)
        }
        setIsLoading(false)
        setIsRefreshing(false)
        setErrorMessage(null)
        return
      }

      if (cached) {
        setContract(cached.recommendation)
      } else {
        setContract(null)
      }

      const shouldRefresh = !cached || (Date.now() - cached.fetchedAt) > CONTRACT_RECOMMENDATION_COOLDOWN_MS
      if (!shouldRefresh) {
        setIsLoading(false)
        setIsRefreshing(false)
        setErrorMessage(null)
        return
      }

      if (cached) {
        setIsRefreshing(true)
        setIsLoading(false)
      } else {
        setIsLoading(true)
        setIsRefreshing(false)
      }
      setErrorMessage(null)
      requestTimer = window.setTimeout(async () => {
        try {
          const rec = await requestContractRecommendation(setupForRequest)
          if (isCancelled || requestSequence !== requestSequenceRef.current) return

          if (rec) {
            const preferredSignature = contractSignature(selectedSetupContractRef.current)
            const matched = preferredSignature
              ? toRecommendationCandidates(rec).find((candidate) => contractSignature(candidate) === preferredSignature) || null
              : null
            const nextSelectedContract = matched || rec
            recommendationCacheRef.current.set(setupId, {
              recommendation: rec,
              fetchedAt: Date.now(),
            })
            setContract(rec)
            setSetupContractChoice(setupForRequest, nextSelectedContract)
            setErrorMessage(null)
          } else if (!cached) {
            setContract(null)
            setErrorMessage('Recommendation service unavailable. Try again in a moment.')
          } else {
            setErrorMessage('Recommendation service slow. Showing last known contract.')
          }
        } catch (error) {
          if (isCancelled || requestSequence !== requestSequenceRef.current) return
          if (!cached) {
            setContract(null)
            setErrorMessage(error instanceof Error ? error.message : 'Recommendation request failed.')
          } else {
            setErrorMessage('Live refresh failed. Showing last known contract.')
          }
        } finally {
          if (isCancelled || requestSequence !== requestSequenceRef.current) return
          setIsLoading(false)
          setIsRefreshing(false)
        }
      }, CONTRACT_RECOMMENDATION_DEBOUNCE_MS)
    }

    run()

    return () => {
      isCancelled = true
      if (requestTimer != null) {
        window.clearTimeout(requestTimer)
      }
    }
  }, [
    readOnly,
    requestContractRecommendation,
    selectedSetupContract,
    selectedSetupContractSignature,
    selectedRecommendedSignature,
    selectedSetupId,
    selectedSetupStatus,
    selectedSetupVersion,
    setSetupContractChoice,
  ])

  return (
    <section className="glass-card-heavy relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.02] to-champagne/5 p-3 md:p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm uppercase tracking-[0.14em] text-white/70">Contract Selector</h3>
        <InfoTip label="What contract selector does">
          Evaluates strike, Greeks, spread and expected payoff against the active setup to reduce contract-selection guesswork.
        </InfoTip>
      </div>

      <div className="mt-3 min-h-[180px]">
        {readOnly ? (
          <p className="text-xs text-white/55">
            Mobile read-only mode: contract execution analytics are available on desktop.
          </p>
        ) : !selectedSetup ? (
          <p className="text-xs text-white/55">Select a setup to generate a contract recommendation.</p>
        ) : isLoading && !contract ? (
          <p className="text-xs text-white/55">Computing recommendation...</p>
        ) : !contract ? (
          <p className="text-xs text-white/55">{errorMessage || 'No recommendation available for this setup yet.'}</p>
        ) : (
          <div className="space-y-2">
            <ContractCard
              contract={contract}
              selectedContractSignature={selectedSetupContractSignature}
              onSelectContract={(nextContract) => {
                if (!selectedSetup) return
                setSetupContractChoice(selectedSetup, nextContract)
              }}
            />
            {isRefreshing && (
              <p className="text-[10px] text-white/45">Refreshing contract against latest levels...</p>
            )}
            {errorMessage && (
              <p className="text-[10px] text-amber-200">{errorMessage}</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
