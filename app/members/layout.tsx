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
import { useIsMobile } from '@/hooks/use-is-mobile'

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
  const isMobile = useIsMobile(1024)
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

  // Custom route transitions can bypass the default scroll reset.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  // Loading state — pulsing logo
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4 animate-pulse">
            <Image src={BRAND_LOGO_SRC} alt={BRAND_NAME} fill sizes="48px" className="object-contain" />
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
            <Image src={BRAND_LOGO_SRC} alt={BRAND_NAME} fill sizes="48px" className="object-contain" />
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

  const contentVariants = prefersReducedMotion
    ? {
        initial: { opacity: 1, x: 0, y: 0, scale: 1, filter: 'none' },
        animate: { opacity: 1, x: 0, y: 0, scale: 1, filter: 'none' },
        exit: { opacity: 1, x: 0, y: 0, scale: 1, filter: 'none' },
      }
    : isMobile
      ? {
          initial: { opacity: 0.85, x: 28, y: 0, scale: 1, filter: 'blur(2px)' },
          animate: { opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)' },
          exit: { opacity: 0, x: -18, y: 0, scale: 1 },
        }
      : {
          initial: { opacity: 0, x: 0, y: 10, scale: 0.99, filter: 'blur(4px)' },
          animate: { opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)' },
          exit: { opacity: 0, x: 0, y: -6, scale: 1 },
        }

  // Tween with fixed duration — spring + blur on exit caused AnimatePresence
  // mode="wait" to stall indefinitely, blocking incoming page navigation.
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: 'tween' as const, duration: 0.2, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] }

  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      {/* Desktop Sidebar */}
      <MemberSidebar />

      {/* Mobile Top Bar */}
      <MobileTopBar />

      {/* Main Content Area */}
      <div className={cn(
        'min-h-screen relative overflow-hidden',
        'lg:pl-[280px]', // offset for sidebar
      )}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(55% 42% at 8% 0%, rgba(16,185,129,0.09), transparent 70%)',
          }}
        />

        <main className="px-4 py-4 lg:px-8 lg:py-6 pb-28 lg:pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              variants={contentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transition}
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
