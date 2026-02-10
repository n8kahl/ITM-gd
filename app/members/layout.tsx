'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MemberAuthProvider, useMemberAuth } from '@/contexts/MemberAuthContext'
import { MemberSidebar } from '@/components/members/member-sidebar'
import { MobileTopBar } from '@/components/members/mobile-top-bar'
import { MemberBottomNav } from '@/components/members/mobile-bottom-nav'
import { BRAND_LOGO_SRC, BRAND_NAME } from '@/lib/brand'

// ============================================
// PAGE TRANSITION VARIANTS
// ============================================

const pageVariants = {
  initial: { opacity: 0, y: 8, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -4, filter: 'blur(2px)' },
}

const pageTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8,
}

// ============================================
// LAYOUT WRAPPER WITH PROVIDER
// ============================================

export default function MembersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MemberAuthProvider>
      <MembersLayoutContent>{children}</MembersLayoutContent>
    </MemberAuthProvider>
  )
}

// ============================================
// LAYOUT CONTENT
// ============================================

function MembersLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const prefersReducedMotion = useReducedMotion()

  const {
    isLoading,
    isAuthenticated,
    isNotMember,
  } = useMemberAuth()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/members')
    }
  }, [isLoading, isAuthenticated, router])

  // Redirect to join-discord if not a member
  useEffect(() => {
    if (!isLoading && isAuthenticated && isNotMember) {
      router.push('/join-discord')
    }
  }, [isLoading, isAuthenticated, isNotMember, router])

  // Loading state — pulsing logo
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4 animate-pulse">
            <Image src={BRAND_LOGO_SRC} alt={BRAND_NAME} fill className="object-contain" />
          </div>
          <p className="text-muted-foreground text-sm">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  // Not authenticated (redirecting)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4 animate-pulse">
            <Image src={BRAND_LOGO_SRC} alt={BRAND_NAME} fill className="object-contain" />
          </div>
          <p className="text-muted-foreground text-sm">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  // Not a member (redirecting)
  if (isNotMember) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Redirecting to join Discord...</p>
        </div>
      </div>
    )
  }

  const reducedMotionVariants = prefersReducedMotion
    ? {
        initial: { opacity: 1, y: 0, filter: 'none' },
        animate: { opacity: 1, y: 0, filter: 'none' },
        exit: { opacity: 1, y: 0, filter: 'none' },
      }
    : pageVariants

  const reducedMotionTransition = prefersReducedMotion
    ? { duration: 0 }
    : pageTransition

  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      {/* Desktop Sidebar */}
      <MemberSidebar />

      {/* Mobile Top Bar */}
      <MobileTopBar />

      {/* Main Content Area */}
      <div className={cn(
        'min-h-screen',
        'lg:pl-[280px]', // offset for sidebar
      )}>
        <main className="px-4 py-4 lg:px-8 lg:py-6 pb-28 lg:pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              variants={reducedMotionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={reducedMotionTransition}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <MemberBottomNav />
    </div>
  )
}
