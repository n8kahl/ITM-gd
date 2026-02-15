'use client'

import { useEffect, useState } from 'react'
import { useSPXCommandCenter } from '@/contexts/SPXCommandCenterContext'
import type { ContractRecommendation } from '@/lib/types/spx-command-center'
import { ContractCard } from '@/components/spx-command-center/contract-card'

export function ContractSelector() {
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
  }, [requestContractRecommendation, selectedSetup])

  return (
    <section className="glass-card-heavy rounded-2xl p-3 md:p-4">
      <h3 className="text-sm uppercase tracking-[0.14em] text-white/70">Contract Selector</h3>

      <div className="mt-3">
        {!selectedSetup ? (
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
