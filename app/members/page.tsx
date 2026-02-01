'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BookOpen,
  Play,
  Trophy,
  TrendingUp,
  Clock,
  ChevronRight,
  Sparkles,
  Target,
  Zap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

export default function MemberDashboard() {
  const [stats, setStats] = useState({
    coursesInProgress: 0,
    lessonsCompleted: 0,
    streakDays: 0,
    totalWatchTime: 0,
  })
  const [recentCourses, setRecentCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setLoading(true)
    try {
      // Fetch recent courses
      const { data: courses } = await supabase
        .from('courses')
        .select('id, title, slug, thumbnail_url, lessons(id)')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(3)

      if (courses) {
        setRecentCourses(courses.map(c => ({
          ...c,
          lesson_count: c.lessons?.length || 0,
        })))
      }

      // In real app: fetch user progress stats from database
      setStats({
        coursesInProgress: 1,
        lessonsCompleted: 0,
        streakDays: 0,
        totalWatchTime: 0,
      })
    } catch (error) {
      console.error('Failed to load dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">
            Welcome back, <span className="text-[#D4AF37]">Trader</span>
          </h1>
          <p className="text-white/60 mt-1">
            Continue your journey to trading mastery
          </p>
        </div>
        <Button asChild className="bg-[#D4AF37] hover:bg-[#B8962E] text-black">
          <Link href="/members/library">
            <Play className="w-4 h-4 mr-2" />
            Continue Learning
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={BookOpen}
          label="Courses in Progress"
          value={stats.coursesInProgress}
          color="gold"
        />
        <StatCard
          icon={Target}
          label="Lessons Completed"
          value={stats.lessonsCompleted}
          color="emerald"
        />
        <StatCard
          icon={Zap}
          label="Day Streak"
          value={stats.streakDays}
          suffix="days"
          color="purple"
        />
        <StatCard
          icon={Clock}
          label="Total Watch Time"
          value={Math.round(stats.totalWatchTime / 60)}
          suffix="hours"
          color="blue"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Continue Learning */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Continue Learning</h2>
            <Link
              href="/members/library"
              className="text-sm text-[#D4AF37] hover:text-[#B8962E] flex items-center gap-1"
            >
              View All
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : recentCourses.length === 0 ? (
            <Card className="bg-[#0a0a0b] border-white/10">
              <CardContent className="py-12 text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-white/20" />
                <p className="text-white/60">No courses started yet</p>
                <Button asChild className="mt-4 bg-[#D4AF37] hover:bg-[#B8962E] text-black">
                  <Link href="/members/library">
                    Browse Courses
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recentCourses.map((course) => (
                <Link
                  key={course.id}
                  href={`/members/courses/${course.slug}`}
                  className="flex items-center gap-4 p-4 rounded-xl bg-[#0a0a0b] border border-white/5 hover:border-[#D4AF37]/30 transition-colors group"
                >
                  {/* Thumbnail */}
                  <div className="w-20 h-14 rounded-lg bg-white/5 overflow-hidden flex-shrink-0">
                    {course.thumbnail_url ? (
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-white/20" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white group-hover:text-[#D4AF37] transition-colors truncate">
                      {course.title}
                    </h3>
                    <p className="text-sm text-white/40">
                      {course.lesson_count} lessons
                    </p>
                  </div>

                  {/* Progress / Action */}
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-[#D4AF37] w-0" /> {/* Progress bar */}
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-[#D4AF37] transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Achievements Preview */}
          <Card className="bg-[#0a0a0b] border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#D4AF37]" />
                Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-8 h-8 text-white/20" />
                </div>
                <p className="text-white/40 text-sm">
                  Complete lessons to earn achievements
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Tips */}
          <Card className="bg-gradient-to-br from-[#D4AF37]/10 to-transparent border-[#D4AF37]/20">
            <CardHeader>
              <CardTitle className="text-white text-base">
                Trading Tip of the Day
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-white/70 text-sm">
                "The goal of a successful trader is to make the best trades. Money is secondary."
              </p>
              <p className="text-[#D4AF37] text-xs mt-3">— Alexander Elder</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Stat Card Component
function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  suffix?: string
  color: 'gold' | 'emerald' | 'purple' | 'blue'
}) {
  const colors = {
    gold: 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/30',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  }

  return (
    <Card className="bg-[#0a0a0b] border-white/10">
      <CardContent className="pt-6">
        <div className={`w-10 h-10 rounded-lg ${colors[color].split(' ').slice(1).join(' ')} flex items-center justify-center mb-3`}>
          <Icon className={`w-5 h-5 ${colors[color].split(' ')[0]}`} />
        </div>
        <div className={`text-2xl font-bold ${colors[color].split(' ')[0]}`}>
          {value}{suffix && <span className="text-sm font-normal ml-1">{suffix}</span>}
        </div>
        <p className="text-white/40 text-sm mt-1">{label}</p>
      </CardContent>
    </Card>
  )
}
