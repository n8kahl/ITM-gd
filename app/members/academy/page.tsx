'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useMemberAuth } from '@/contexts/MemberAuthContext'
import { AcademyHub } from '@/components/academy/academy-hub'
import { BRAND_LOGO_SRC, BRAND_NAME } from '@/lib/brand'

// ============================================
// TYPES
// ============================================

interface OnboardingStatus {
  success: boolean
  data?: {
    completed: boolean
  }
}

interface DashboardData {
  stats: {
    coursesCompleted: number
    totalCourses: number
    lessonsCompleted: number
    totalLessons: number
    quizzesPassed: number
    currentXp: number
    currentStreak: number
    activeDays: string[]
  }
  currentLesson: {
    lessonId: string
    lessonTitle: string
    courseTitle: string
    courseSlug: string
    progress: number
    totalLessons: number
    currentLesson: number
  } | null
  resumeInsight?: {
    message: string
    source: string
  } | null
  recommendedCourses: Array<{
    slug: string
    title: string
    description: string
    thumbnailUrl: string | null
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    path: string
    totalLessons: number
    completedLessons: number
    estimatedMinutes: number
  }>
  recentAchievements: Array<{
    id: string
    title: string
    description: string
    icon?: string
    earnedAt: string | null
    category?: string
  }>
}

interface DashboardResponse {
  success: boolean
  data?: DashboardData
}

type PageState = 'loading' | 'dashboard' | 'redirecting'

// ============================================
// SKELETON LOADER
// ============================================

function AcademySkeleton() {
  return (
    <div className="space-y-6">
      {/* Pulsing logo */}
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4 animate-pulse">
            <Image src={BRAND_LOGO_SRC} alt={BRAND_NAME} fill sizes="48px" className="object-contain" />
          </div>
          <p className="text-sm text-white/40">Loading Academy...</p>
        </div>
      </div>

      {/* Skeleton blocks */}
      <div className="space-y-4">
        <div className="h-24 rounded-xl bg-emerald-500/5 animate-pulse border border-white/5" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-xl bg-emerald-500/5 animate-pulse border border-white/5"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-xl bg-emerald-500/5 animate-pulse border border-white/5"
              />
            ))}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-xl bg-emerald-500/5 animate-pulse border border-white/5"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function AcademyPage() {
  const router = useRouter()
  const { profile } = useMemberAuth()
  const [pageState, setPageState] = useState<PageState>('loading')
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)

  const checkOnboardingAndLoadDashboard = useCallback(async () => {
    try {
      // Step 1: Check onboarding status
      const onboardingRes = await fetch('/api/academy/onboarding-status')
      if (!onboardingRes.ok) {
        throw new Error('Failed to check onboarding status')
      }

      const onboardingData: OnboardingStatus = await onboardingRes.json()
      const isComplete = !!onboardingData.data?.completed

      if (!isComplete) {
        setPageState('redirecting')
        router.push('/members/academy/onboarding')
        return
      }

      // Step 2: Fetch dashboard data
      const dashboardRes = await fetch('/api/academy/dashboard')
      if (!dashboardRes.ok) {
        throw new Error('Failed to load dashboard')
      }

      const dashboardPayload: DashboardResponse = await dashboardRes.json()
      if (!dashboardPayload.success || !dashboardPayload.data) {
        throw new Error('Dashboard payload invalid')
      }

      setDashboardData(dashboardPayload.data)
      setPageState('dashboard')
    } catch (error) {
      console.error('Academy page error:', error)
      // Show dashboard with fallback data
      setDashboardData({
        stats: {
          coursesCompleted: 0,
          totalCourses: 0,
          lessonsCompleted: 0,
          totalLessons: 0,
          quizzesPassed: 0,
          currentXp: 0,
          currentStreak: 0,
          activeDays: [],
        },
        currentLesson: null,
        resumeInsight: null,
        recommendedCourses: [],
        recentAchievements: [],
      })
      setPageState('dashboard')
    }
  }, [router])

  useEffect(() => {
    checkOnboardingAndLoadDashboard()
  }, [checkOnboardingAndLoadDashboard])

  if (pageState === 'loading' || pageState === 'redirecting') {
    return <AcademySkeleton />
  }

  if (!dashboardData) {
    return <AcademySkeleton />
  }

  const username =
    profile?.discord_username || profile?.email?.split('@')[0] || 'Trader'

  return (
    <AcademyHub
      stats={dashboardData.stats}
      currentLesson={dashboardData.currentLesson}
      resumeInsight={dashboardData.resumeInsight || null}
      recommendedCourses={dashboardData.recommendedCourses}
      recentAchievements={dashboardData.recentAchievements}
      username={username}
    />
  )
}
