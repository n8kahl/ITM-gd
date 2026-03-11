'use client'

import { MoneyMakerAccessGate } from '@/components/money-maker/money-maker-access-gate'
import { MoneyMakerProvider } from '@/components/money-maker/money-maker-provider'
import { MoneyMakerShell } from '@/components/money-maker/money-maker-shell'
import { SetupGrid } from '@/components/money-maker/setup-grid'

export default function MoneyMakerPage() {
    return (
        <MoneyMakerAccessGate>
            <MoneyMakerProvider>
                <MoneyMakerShell>
                    <SetupGrid />
                </MoneyMakerShell>
            </MoneyMakerProvider>
        </MoneyMakerAccessGate>
    )
}
