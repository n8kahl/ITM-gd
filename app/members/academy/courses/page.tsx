'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { GraduationCap } from 'lucide-react'
import { CourseCatalog } from '@/components/academy/course-catalog'
import type { CourseCardData } from '@/components/academy/course-card'

// ============================================
// TYPES
// ============================================

interface CatalogResponse {
  courses: CourseCardData[]
  paths: string[]
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseCardData[]>([])
  const [paths, setPaths] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchCourses() {
      try {
        const res = await fetch('/api/academy/courses')
        if (!res.ok) throw new Error('Failed to fetch courses')

        const data: CatalogResponse = await res.json()
        setCourses(data.courses)
        setPaths(data.paths)
      } catch (error) {
        console.error('Error fetching courses:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCourses()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Pulsing logo loader */}
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-4 animate-pulse">
              <Image src="/logo.png" alt="Loading" fill className="object-contain" />
            </div>
            <p className="text-sm text-white/40">Loading courses...</p>
          </div>
        </div>

        {/* Skeleton grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-64 rounded-xl bg-emerald-500/5 animate-pulse border border-white/5"
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap className="w-5 h-5 text-emerald-400" />
          <h1 className="text-xl font-semibold text-white">Course Catalog</h1>
        </div>
        <p className="text-sm text-white/50">
          Browse our complete library of trading courses. Filter by learning path or difficulty.
        </p>
      </div>

      {/* Catalog with filters */}
      <CourseCatalog courses={courses} paths={paths} />
    </div>
  )
}
