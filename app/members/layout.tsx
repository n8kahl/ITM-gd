'use client'

import { type CSSProperties, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MemberAuthProvider, useMemberAuth } from '@/contexts/MemberAuthContext'
import { MemberSidebar } from '@/components/members/member-sidebar'
import { MobileTopBar } from '@/components/members/mobile-top-bar'
import { MemberBottomNav } from '@/components/members/mobile-bottom-nav'
import { InstallCta } from '@/components/pwa/install-cta'
import { BRAND_LOGO_SRC, BRAND_NAME } from '@/lib/brand'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { getMemberSectionPath } from '@/lib/member-navigation'

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
  const previousSectionPathRef = useRef<string | null>(null)
  const isMobile = useIsMobile(1024)
  const prefersReducedMotion = useReducedMotion()
  const hideMobileNav = pathname.startsWith('/members/spx-command-center')

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

  // Preserve scroll within a feature area; reset only when moving across main sections.
  useEffect(() => {
    const currentSectionPath = getMemberSectionPath(pathname)
    if (previousSectionPathRef.current && previousSectionPathRef.current !== currentSectionPath) {
      window.scrollTo(0, 0)
    }
    previousSectionPathRef.current = currentSectionPath
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

  const enterMotion = prefersReducedMotion
    ? {
        initial: { opacity: 1, x: 0, y: 0, scale: 1, filter: 'none' },
        animate: { opacity: 1, x: 0, y: 0, scale: 1, filter: 'none' },
      }
    : isMobile
      ? {
          initial: { opacity: 0.92, x: 16, y: 0, scale: 1, filter: 'blur(1.5px)' },
          animate: { opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)' },
        }
      : {
          initial: { opacity: 0.94, x: 0, y: 8, scale: 0.995, filter: 'blur(2.5px)' },
          animate: { opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)' },
        }

  // Production reliability: avoid exit/wait orchestration for page shells.
  // Enter-only motion preserves polish without ever blocking route completion.
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: 'tween' as const, duration: 0.16, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] }

  return (
    <div
      className="min-h-screen bg-[#0A0A0B]"
      style={{
        ['--members-topbar-h' as string]: '3.5rem',
        ['--members-bottomnav-h' as string]: '7rem',
        ['--members-subnav-h' as string]: '3.25rem',
      } as CSSProperties}
    >
      {/* Desktop Sidebar */}
      <MemberSidebar />

      {/* Mobile Top Bar */}
      <MobileTopBar />
      <InstallCta immersive={hideMobileNav} />

      {/* Main Content Area */}
      <div className={cn(
        'min-h-screen relative overflow-hidden pb-safe lg:pb-0',
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

        <main
          className={cn(
            'px-4 py-4 lg:px-8 lg:py-6 lg:pb-8',
            hideMobileNav ? 'pb-6' : 'pb-[var(--members-bottomnav-h)]',
          )}
        >
          <motion.div
            key={pathname}
            initial={enterMotion.initial}
            animate={enterMotion.animate}
            transition={transition}
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      {!hideMobileNav ? <MemberBottomNav /> : null}
    </div>
  )
}
