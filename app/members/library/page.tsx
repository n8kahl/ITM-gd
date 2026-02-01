'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BookOpen,
  Lock,
  Play,
  Clock,
  ChevronRight,
  Sparkles,
  Crown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LibraryPageSkeleton } from '@/components/ui/skeleton-loader'
import { Course } from '@/lib/types_db'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useMemberAuth } from '@/contexts/MemberAuthContext'

// Tier hierarchy for access checking (higher = more access)
const TIER_HIERARCHY: Record<string, number> = {
  'core': 1,
  'pro': 2,
  'execute': 3,
}

// Map course discord_role_required field to tier names
const COURSE_TIER_MAP: Record<string, string> = {
  'core_sniper': 'core',
  'pro_sniper': 'pro',
  'execute_sniper': 'execute',
}

// Display names for tiers
const TIER_DISPLAY_NAMES: Record<string, string> = {
  'core': 'Core',
  'pro': 'Pro',
  'execute': 'Execute',
}

interface CourseWithMeta extends Course {
  lesson_count: number
  total_duration: number
}

export default function LibraryPage() {
  const { profile, isLoading: authLoading } = useMemberAuth()
  const [courses, setCourses] = useState<CourseWithMeta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCourses()
  }, [])

  const loadCourses = async () => {
    setLoading(true)
    try {
      // Fetch published courses with lesson metadata
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          lessons(id, duration_minutes)
        `)
        .eq('is_published', true)
        .order('display_order', { ascending: true })

      if (data) {
        const coursesWithMeta = data.map(course => ({
          ...course,
          lesson_count: course.lessons?.length || 0,
          total_duration: course.lessons?.reduce((acc: number, l: { duration_minutes: number | null }) =>
            acc + (l.duration_minutes || 0), 0) || 0,
        }))
        setCourses(coursesWithMeta)
      }
    } catch (error) {
      console.error('Failed to load courses:', error)
    } finally {
      setLoading(false)
    }
  }

  // Check if user has access to a course based on membership tier
  const hasAccess = (course: Course): boolean => {
    // Public course - no role required
    if (!course.discord_role_required) return true

    // Get user's tier level
    const userTier = profile?.membership_tier || null
    const userLevel = userTier ? TIER_HIERARCHY[userTier] || 0 : 0

    // Get required tier level for this course
    const requiredTier = COURSE_TIER_MAP[course.discord_role_required]
    const requiredLevel = requiredTier ? TIER_HIERARCHY[requiredTier] || 0 : 0

    // User has access if their tier level >= required level
    return userLevel >= requiredLevel
  }

  // Get the display name for the required tier
  const getRequiredTierDisplay = (roleRequired: string | null): string => {
    if (!roleRequired) return 'Free'
    const tier = COURSE_TIER_MAP[roleRequired]
    return tier ? TIER_DISPLAY_NAMES[tier] || tier : roleRequired
  }

  if (loading || authLoading) {
    return <LibraryPageSkeleton />
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-white">
          Course <span className="text-[#D4AF37]">Library</span>
        </h1>
        <p className="text-white/60 mt-1">
          Master the markets with our premium trading courses
        </p>
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.length === 0 ? (
          <div className="col-span-full text-center py-20">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-white/20" />
            <h3 className="text-xl font-medium text-white/60">No courses available yet</h3>
            <p className="text-white/40 mt-2">Check back soon for new content!</p>
          </div>
        ) : (
          courses.map((course) => {
            const canAccess = hasAccess(course)

            return (
              <CourseCard
                key={course.id}
                course={course}
                canAccess={canAccess}
                requiredTier={getRequiredTierDisplay(course.discord_role_required)}
              />
            )
          })
        )}
      </div>

      {/* Upgrade CTA for locked courses */}
      {courses.some(c => !hasAccess(c)) && (
        <div className="mt-12 p-6 rounded-2xl bg-gradient-to-br from-[#D4AF37]/10 to-transparent border border-[#D4AF37]/20">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-[#D4AF37]/20 flex items-center justify-center">
              <Crown className="w-8 h-8 text-[#D4AF37]" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl font-bold text-white">Unlock All Courses</h3>
              <p className="text-white/60 mt-1">
                Upgrade your membership to access our complete course library and accelerate your trading journey.
              </p>
            </div>
            <Button
              asChild
              className="bg-[#D4AF37] hover:bg-[#B8962E] text-black"
            >
              <Link href="/#pricing">
                <Sparkles className="w-4 h-4 mr-2" />
                View Plans
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Course Card Component
function CourseCard({
  course,
  canAccess,
  requiredTier,
}: {
  course: CourseWithMeta
  canAccess: boolean
  requiredTier: string
}) {
  return (
    <div
      className={cn(
        'group relative rounded-2xl overflow-hidden border transition-all duration-300',
        canAccess
          ? 'border-white/10 hover:border-[#D4AF37]/30 bg-[#0a0a0b]'
          : 'border-white/5 bg-[#0a0a0b]/50'
      )}
    >
      {/* Locked Overlay */}
      {!canAccess && (
        <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-6">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-white/60" />
          </div>
          <p className="text-white/80 font-medium text-center mb-2">
            {requiredTier} Required
          </p>
          <p className="text-white/40 text-sm text-center mb-4">
            Upgrade your membership to unlock this course
          </p>
          <Button
            asChild
            size="sm"
            className="bg-[#D4AF37] hover:bg-[#B8962E] text-black"
          >
            <Link href="/#pricing">
              Upgrade Membership
            </Link>
          </Button>
        </div>
      )}

      {/* Thumbnail */}
      <div className="aspect-video bg-gradient-to-br from-white/5 to-white/[0.02] relative overflow-hidden">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className={cn(
              'w-full h-full object-cover transition-transform duration-500',
              canAccess && 'group-hover:scale-105'
            )}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-12 h-12 text-white/10" />
          </div>
        )}

        {/* Play Button Overlay */}
        {canAccess && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
            <div className="w-14 h-14 rounded-full bg-[#D4AF37] flex items-center justify-center">
              <Play className="w-6 h-6 text-black ml-1" />
            </div>
          </div>
        )}

        {/* Role Badge */}
        {course.discord_role_required && (
          <div className="absolute top-3 right-3">
            <span className={cn(
              'px-2 py-1 text-xs font-medium rounded-full',
              canAccess
                ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30'
                : 'bg-white/10 text-white/60 border border-white/20'
            )}>
              {requiredTier}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className={cn(
          'font-semibold text-lg mb-2 transition-colors',
          canAccess ? 'text-white group-hover:text-[#D4AF37]' : 'text-white/60'
        )}>
          {course.title}
        </h3>

        <p className={cn(
          'text-sm line-clamp-2 mb-4',
          canAccess ? 'text-white/60' : 'text-white/40'
        )}>
          {course.description || 'No description available'}
        </p>

        {/* Meta */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4 text-white/40">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5" />
              {course.lesson_count} lessons
            </span>
            {course.total_duration > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {Math.round(course.total_duration / 60)}h {course.total_duration % 60}m
              </span>
            )}
          </div>

          {canAccess && (
            <Link
              href={`/members/courses/${course.slug}`}
              className="flex items-center gap-1 text-[#D4AF37] hover:text-[#B8962E] transition-colors"
            >
              Start
              <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
