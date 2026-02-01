'use client'

import { Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import SparkleLog from '@/components/ui/sparkle-logo'

export default function MemberDashboard() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="bg-[#0a0a0b] border-white/10 max-w-lg w-full">
        <CardContent className="py-16 px-8 text-center">
          <div className="mx-auto mb-8 flex justify-center">
            <SparkleLog
              src="/logo.png"
              alt="TradeITM"
              width={96}
              height={96}
              sparkleCount={10}
              enableFloat={true}
              enableGlow={true}
              glowIntensity="medium"
            />
          </div>

          <h1 className="text-3xl font-bold text-white mb-3">
            Coming Soon
          </h1>

          <p className="text-white/60 text-lg mb-6">
            The member area is currently under development.
          </p>

          <div className="flex items-center justify-center gap-2 text-white/40">
            <Lock className="w-4 h-4" />
            <span className="text-sm">Exclusive content launching soon</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">
            Welcome back, <span className="text-emerald-500">Trader</span>
          </h1>
          <p className="text-white/60 mt-1">
            Continue your journey to trading mastery
          </p>
        </div>
        <Button asChild className="bg-emerald-500 hover:bg-emerald-600 text-black">
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
              className="text-sm text-emerald-500 hover:text-[#B8962E] flex items-center gap-1"
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
                <Button asChild className="mt-4 bg-emerald-500 hover:bg-emerald-600 text-black">
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
                  className="flex items-center gap-4 p-4 rounded-xl bg-[#0a0a0b] border border-white/5 hover:border-emerald-500/30 transition-colors group"
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
                    <h3 className="font-medium text-white group-hover:text-emerald-500 transition-colors truncate">
                      {course.title}
                    </h3>
                    <p className="text-sm text-white/40">
                      {course.lesson_count} lessons
                    </p>
                  </div>

                  {/* Progress / Action */}
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-emerald-500 w-0" /> {/* Progress bar */}
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-emerald-500 transition-colors" />
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
                <Trophy className="w-5 h-5 text-emerald-500" />
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
          <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
            <CardHeader>
              <CardTitle className="text-white text-base">
                Trading Tip of the Day
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-white/70 text-sm">
                "The goal of a successful trader is to make the best trades. Money is secondary."
              </p>
              <p className="text-emerald-500 text-xs mt-3">— Alexander Elder</p>
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
    gold: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
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
>>>>>>> 6c5a005 (Complete platform-wide "De-Golding": Replace 129 gold instances with Emerald)
