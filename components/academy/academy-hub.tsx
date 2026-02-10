'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  BookOpen,
  TrendingUp,
  Award,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { ContinueLearningCard } from '@/components/academy/continue-learning-card'
import { CourseCard, type CourseCardData } from '@/components/academy/course-card'
import { XpDisplay } from '@/components/academy/xp-display'
import { StreakCalendar } from '@/components/academy/streak-calendar'
import { AchievementCard } from '@/components/academy/achievement-card'
import { ProgressRing } from '@/components/academy/progress-ring'

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
  recommendedCourses,
  recentAchievements,
  username,
  className,
}: AcademyHubProps) {
  const overallProgress =
    stats.totalLessons > 0
      ? Math.round((stats.lessonsCompleted / stats.totalLessons) * 100)
      : 0

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

      {/* Desktop: 2-column layout (70/30) / Mobile: stack */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* ======== LEFT COLUMN (70%) ======== */}
        <div className="space-y-5">
          {/* Continue learning */}
          {currentLesson && (
            <motion.div variants={itemVariants}>
              <ContinueLearningCard
                lessonId={currentLesson.lessonId}
                lessonTitle={currentLesson.lessonTitle}
                courseTitle={currentLesson.courseTitle}
                courseSlug={currentLesson.courseSlug}
                progress={currentLesson.progress}
                totalLessons={currentLesson.totalLessons}
                currentLesson={currentLesson.currentLesson}
              />
            </motion.div>
          )}

          {/* Stats grid */}
          <motion.div variants={itemVariants}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatBox
                label="Courses"
                value={`${stats.coursesCompleted}/${stats.totalCourses}`}
                icon={<BookOpen className="w-4 h-4 text-emerald-400" />}
              />
              <StatBox
                label="Lessons"
                value={`${stats.lessonsCompleted}`}
                icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
              />
              <StatBox
                label="Quizzes Passed"
                value={`${stats.quizzesPassed}`}
                icon={<Award className="w-4 h-4 text-emerald-400" />}
              />
              <StatBox
                label="Overall"
                value={
                  <ProgressRing
                    progress={overallProgress}
                    size={36}
                    strokeWidth={3}
                  />
                }
              />
            </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
              {recommendedCourses.slice(0, 4).map((course) => (
                <CourseCard key={course.slug} course={course} />
              ))}
            </div>
          </motion.div>
        </div>

        {/* ======== RIGHT COLUMN (30%) ======== */}
        <div className="space-y-5">
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

// ============================================
// STAT BOX
// ============================================

function StatBox({
  label,
  value,
  icon,
}: {
  label: string
  value: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-xl p-3',
        'bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-white/40 uppercase tracking-wider">
          {label}
        </span>
        {icon}
      </div>
      {typeof value === 'string' || typeof value === 'number' ? (
        <p className="text-lg font-semibold text-white">{value}</p>
      ) : (
        value
      )}
    </div>
  )
}
