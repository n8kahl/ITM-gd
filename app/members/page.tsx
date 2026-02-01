'use client'

import { Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import SparkleLog from '@/components/ui/sparkle-logo'

export default function MemberDashboard() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="bg-[#0a0a0b] border-white/10 max-w-lg w-full">
        <CardContent className="py-16 px-8 text-center">
          <div className="mx-auto mb-8 flex justify-center">
            <SparkleLog
              src="/logo.png"
              alt="TradeITM"
              width={96}
              height={96}
              sparkleCount={10}
              enableFloat={true}
              enableGlow={true}
              glowIntensity="medium"
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Coming Soon</h1>
          <p className="text-white/60 text-lg mb-6">
            The member area is currently under development.
          </p>
          <div className="flex items-center justify-center gap-2 text-white/40">
            <Lock className="w-4 h-4" />
            <span className="text-sm">Exclusive content launching soon</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
