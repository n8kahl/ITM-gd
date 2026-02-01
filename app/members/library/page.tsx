'use client'

import { BookOpen, Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default function LibraryPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="bg-[#0a0a0b] border-white/10 max-w-lg w-full">
        <CardContent className="py-16 px-8 text-center">
          <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 flex items-center justify-center">
            <BookOpen className="w-12 h-12 text-[#D4AF37]" />
          </div>

          <h1 className="text-3xl font-bold text-white mb-3">
            Coming Soon
          </h1>

          <p className="text-white/60 text-lg mb-6">
            The course library is currently under development.
          </p>

          <div className="flex items-center justify-center gap-2 text-white/40">
            <Lock className="w-4 h-4" />
            <span className="text-sm">Premium trading education coming soon</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
