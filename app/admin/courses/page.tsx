'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  BookOpen,
  ChevronRight
} from 'lucide-react'
import { Course, Lesson } from '@/lib/types_db'
import { CourseEditorSheet } from '@/components/admin/course-editor-sheet'
import { LessonManagerSheet } from '@/components/admin/lesson-manager-sheet'

export default function CoursesPage() {
  const [courses, setCourses] = useState<(Course & { lessons?: Lesson[] })[]>([])
  const [loading, setLoading] = useState(true)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [managingLessons, setManagingLessons] = useState<Course | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const loadCourses = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/courses')
      if (response.ok) {
        const result = await response.json()
        setCourses(result.data || [])
      }
    } catch (error) {
      console.error('Failed to load courses:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCourses()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this course? All lessons will also be deleted.')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/courses?id=${id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setCourses(prev => prev.filter(c => c.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete course:', error)
    }
  }

  const handleTogglePublish = async (course: Course) => {
    try {
      const response = await fetch('/api/admin/courses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: course.id,
          is_published: !course.is_published,
        }),
      })
      if (response.ok) {
        setCourses(prev => prev.map(c =>
          c.id === course.id ? { ...c, is_published: !c.is_published } : c
        ))
      }
    } catch (error) {
      console.error('Failed to toggle publish:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Course Management</h1>
          <p className="text-white/60 mt-1">Create and manage your course library</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadCourses}
            disabled={loading}
            className="border-white/10 text-white/60 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => setIsCreating(true)}
            className="bg-emerald-500 hover:bg-[emerald-600] text-black"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Course
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      )}

      {/* Courses Table */}
      {!loading && (
        <Card className="bg-[#0a0a0b] border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              All Courses ({courses.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {courses.length === 0 ? (
              <div className="text-center py-12 text-white/40">
                <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No courses yet</p>
                <p className="text-sm mt-1">Create your first course to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {courses.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center gap-4 p-4 rounded-lg border border-white/5 hover:border-white/10 bg-white/[0.02] transition-colors"
                  >
                    {/* Drag Handle */}
                    <div className="text-white/20 cursor-grab">
                      <GripVertical className="w-5 h-5" />
                    </div>

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
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white truncate">{course.title}</h3>
                        {course.discord_role_required && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                            Gated
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-white/50 truncate">
                        {course.description || 'No description'}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                        <span>{course.lessons?.length || 0} lessons</span>
                        <span>/courses/{course.slug}</span>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTogglePublish(course)}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                          course.is_published
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-white/5 text-white/40 border border-white/10'
                        }`}
                      >
                        {course.is_published ? (
                          <>
                            <Eye className="w-3 h-3" />
                            Published
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3 h-3" />
                            Draft
                          </>
                        )}
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setManagingLessons(course)}
                        className="text-white/60 hover:text-white hover:bg-white/5"
                      >
                        <ChevronRight className="w-4 h-4 mr-1" />
                        Lessons
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingCourse(course)}
                        className="text-white/60 hover:text-white hover:bg-white/5"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(course.id)}
                        className="text-white/60 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Course Editor Sheet */}
      <CourseEditorSheet
        open={isCreating || !!editingCourse}
        onClose={() => {
          setIsCreating(false)
          setEditingCourse(null)
        }}
        course={editingCourse}
        onSave={() => {
          loadCourses()
          setIsCreating(false)
          setEditingCourse(null)
        }}
      />

      {/* Lesson Manager Sheet */}
      <LessonManagerSheet
        open={!!managingLessons}
        onClose={() => setManagingLessons(null)}
        course={managingLessons}
        onSave={() => {
          loadCourses()
        }}
      />
    </div>
  )
}
