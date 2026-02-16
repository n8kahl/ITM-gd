'use client'

import { useEffect, useState } from 'react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import { InfoTip } from '@/components/ui/info-tip'
import type { ContractRecommendation } from '@/lib/types/spx-command-center'
import { ContractCard } from '@/components/spx-command-center/contract-card'

export function ContractSelector({ readOnly = false }: { readOnly?: boolean }) {
  const { selectedSetup, requestContractRecommendation } = useSPXCommandCenter()
  const [contract, setContract] = useState<ContractRecommendation | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let isCancelled = false

    async function run() {
      if (!selectedSetup) {
        setContract(null)
        return
      }
      if (readOnly) {
        setContract(null)
        return
      }
      if (selectedSetup.status !== 'ready' && selectedSetup.status !== 'triggered') {
        setContract(null)
        return
      }

      setIsLoading(true)
      try {
        const rec = await requestContractRecommendation(selectedSetup.id)
        if (!isCancelled) {
          setContract(rec)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void run()

    return () => {
      isCancelled = true
    }
  }, [readOnly, requestContractRecommendation, selectedSetup])

  return (
    <section className="glass-card-heavy relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.02] to-champagne/5 p-3 md:p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm uppercase tracking-[0.14em] text-white/70">Contract Selector</h3>
        <InfoTip label="What contract selector does">
          Evaluates strike, Greeks, spread and expected payoff against the active setup to reduce contract-selection guesswork.
        </InfoTip>
      </div>

      <div className="mt-3">
        {readOnly ? (
          <p className="text-xs text-white/55">
            Mobile read-only mode: contract execution analytics are available on desktop.
          </p>
        ) : !selectedSetup ? (
          <p className="text-xs text-white/55">Select a setup to generate a contract recommendation.</p>
        ) : isLoading ? (
          <p className="text-xs text-white/55">Computing recommendation...</p>
        ) : !contract ? (
          <p className="text-xs text-white/55">No recommendation available for this setup yet.</p>
        ) : (
          <ContractCard contract={contract} />
        )}
      </div>
    </section>
  )
}
