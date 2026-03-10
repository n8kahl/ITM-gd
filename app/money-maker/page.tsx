import { MoneyMakerProvider } from '@/components/money-maker/money-maker-provider'
import { MoneyMakerShell } from '@/components/money-maker/money-maker-shell'
import { SetupGrid } from '@/components/money-maker/setup-grid'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: "Money Maker | Don Kahl's Trading",
    description: 'High-Precision Strategy Signals',
}

export default function MoneyMakerPage() {
    return (
        <MoneyMakerProvider>
            <MoneyMakerShell>
                <SetupGrid />
            </MoneyMakerShell>
        </MoneyMakerProvider>
    )
}
