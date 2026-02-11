'use client'

import Link from 'next/link'
import Image from 'next/image'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BRAND_LOGO_SRC, BRAND_NAME } from '@/lib/brand'

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-[#0f0f10] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="relative w-14 h-14 mx-auto mb-6">
          <Image src={BRAND_LOGO_SRC} alt={BRAND_NAME} fill className="object-contain" />
        </div>

        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Access denied</h1>
        <p className="text-white/60 mb-6">
          Your account is signed in, but it doesn&apos;t have access to the Members area.
        </p>

        <div className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href="/login">Back to login</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/join-discord">Join Discord / Sync roles</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/">Go to homepage</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

