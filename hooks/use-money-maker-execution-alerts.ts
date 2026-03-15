'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useMoneyMaker } from '@/components/money-maker/money-maker-provider'
import {
    buildMoneyMakerExecutionAlertCandidates,
    collectMoneyMakerExecutionAlerts,
} from '@/lib/money-maker/transition-alerts'

export function useMoneyMakerExecutionAlerts() {
    const { state } = useMoneyMaker()
    const fingerprintsRef = useRef<Record<string, string>>({})
    const hasHydratedRef = useRef(false)

    useEffect(() => {
        const candidates = buildMoneyMakerExecutionAlertCandidates(
            state.signals,
            state.symbolSnapshots,
            Date.now(),
        )
        const { alerts, nextFingerprints } = collectMoneyMakerExecutionAlerts({
            candidates,
            previousFingerprints: fingerprintsRef.current,
            suppressInitialAlerts: !hasHydratedRef.current,
        })

        fingerprintsRef.current = nextFingerprints
        hasHydratedRef.current = true

        for (const alert of alerts) {
            toast(alert.title, {
                description: alert.description,
            })
        }
    }, [state.lastUpdated, state.signals, state.symbolSnapshots])
}
