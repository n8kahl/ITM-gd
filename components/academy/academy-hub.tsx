'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  Award,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { CourseCard, type CourseCardData } from '@/components/academy/course-card'
import { XpDisplay } from '@/components/academy/xp-display'
import { StreakCalendar } from '@/components/academy/streak-calendar'
import { AchievementCard } from '@/components/academy/achievement-card'
import { MasteryArc } from '@/components/academy/mastery-arc'
import { AIResumeCard } from '@/components/academy/ai-resume-card'

// ============================================
// TYPES
// ============================================

interface DashboardStats {
  coursesCompleted: number
  totalCourses: number
  lessonsCompleted: number
  totalLessons: number
  quizzesPassed: number
  currentXp: number
  currentStreak: number
  activeDays: string[]
}

interface CurrentLesson {
  lessonId: string
  lessonTitle: string
  courseTitle: string
  courseSlug: string
  progress: number
  totalLessons: number
  currentLesson: number
}

interface ResumeInsight {
  message: string
  source: string
}

interface CompetencyScores {
  market_context: number
  entry_validation: number
  position_sizing: number
  trade_management: number
  exit_discipline: number
  review_reflection: number
}

interface Achievement {
  id: string
  title: string
  description: string
  icon?: string
  earnedAt: string | null
  category?: string
}

interface AcademyHubProps {
  stats: DashboardStats
  currentLesson: CurrentLesson | null
  resumeInsight?: ResumeInsight | null
  recommendedCourses: CourseCardData[]
  recentAchievements: Achievement[]
  username: string
  className?: string
}

// ============================================
// COMPONENT
// ============================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
}

export function AcademyHub({
  stats,
  currentLesson,
  resumeInsight,
  recommendedCourses,
  recentAchievements,
  username,
  className,
}: AcademyHubProps) {
  const [competencyScores, setCompetencyScores] = useState<CompetencyScores>({
    market_context: 0,
    entry_validation: 0,
    position_sizing: 0,
    trade_management: 0,
    exit_discipline: 0,
    review_reflection: 0,
  })

  useEffect(() => {
    let mounted = true

    const loadCompetencyScores = async () => {
      try {
        const response = await fetch('/api/academy/competency-scores')
        if (!response.ok) return
        const payload = await response.json()
        const nextScores = payload?.data?.scores
        if (!mounted || !nextScores) return
        setCompetencyScores((previous) => ({
          ...previous,
          ...nextScores,
        }))
      } catch {
        // Keep zeroed scores on load failure.
      }
    }

    loadCompetencyScores()

    return () => {
      mounted = false
    }
  }, [])

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn('space-y-6', className)}
    >
      {/* Welcome header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-xl lg:text-2xl font-semibold text-white">
          Welcome back, {username}
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Continue your trading education journey.
        </p>
      </motion.div>

      {/* Desktop: 2-column layout / Mobile: stack */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
        {/* ======== LEFT COLUMN (70%) ======== */}
        <div className="space-y-5">
          {/* AI resume */}
          <motion.div variants={itemVariants}>
            <AIResumeCard
              currentLesson={currentLesson ? {
                id: currentLesson.lessonId,
                title: currentLesson.lessonTitle,
                courseTitle: currentLesson.courseTitle,
                position: currentLesson.currentLesson,
                totalLessons: currentLesson.totalLessons,
                progress: currentLesson.progress,
              } : null}
              insight={resumeInsight || null}
            />
          </motion.div>

          {/* Recommended courses */}
          <motion.div variants={itemVariants} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                Recommended Courses
              </h2>
              <Link
                href="/members/academy/courses"
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                View all
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {recommendedCourses.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
                {recommendedCourses.slice(0, 4).map((course) => (
                  <CourseCard key={course.slug} course={course} />
                ))}
              </div>
            ) : (
              <div
                className={cn(
                  'rounded-xl p-5',
                  'bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5'
                )}
              >
                <p className="text-sm text-white/70">
                  No courses are available yet.
                </p>
                <p className="text-xs text-white/40 mt-1">
                  If this is unexpected, the Academy curriculum database seed may not have been applied.
                </p>
                <Link
                  href="/members/academy/courses"
                  className="inline-flex items-center gap-2 mt-3 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Open course catalog
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </motion.div>
        </div>

        {/* ======== RIGHT COLUMN (30%) ======== */}
        <div className="space-y-5">
          {/* Mastery arc */}
          <motion.div variants={itemVariants}>
            <MasteryArc scores={competencyScores} className="h-full" />
          </motion.div>

          {/* XP Display */}
          <motion.div
            variants={itemVariants}
            className={cn(
              'rounded-xl p-4',
              'bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5'
            )}
          >
            <XpDisplay currentXp={stats.currentXp} />
          </motion.div>

          {/* Streak Calendar */}
          <motion.div
            variants={itemVariants}
            className={cn(
              'rounded-xl p-4',
              'bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5'
            )}
          >
            <StreakCalendar
              activeDays={stats.activeDays}
              currentStreak={stats.currentStreak}
            />
          </motion.div>

          {/* Recent Achievements */}
          {recentAchievements.length > 0 && (
            <motion.div variants={itemVariants} className="space-y-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-[var(--champagne-hex)]" />
                Recent Achievements
              </h2>
              <div className="space-y-2">
                {recentAchievements.slice(0, 3).map((achievement) => (
                  <AchievementCard
                    key={achievement.id}
                    id={achievement.id}
                    title={achievement.title}
                    description={achievement.description}
                    icon={achievement.icon}
                    earnedAt={achievement.earnedAt}
                    category={achievement.category}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
