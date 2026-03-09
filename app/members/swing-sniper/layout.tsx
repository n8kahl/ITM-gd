import type { ReactNode } from 'react'
import { SwingSniperAccessGate } from '@/components/swing-sniper/swing-sniper-access-gate'

export default function SwingSniperLayout({ children }: { children: ReactNode }) {
  return (
    <SwingSniperAccessGate>
      {children}
    </SwingSniperAccessGate>
  )
}
