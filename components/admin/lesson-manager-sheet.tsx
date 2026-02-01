'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  X,
  Plus,
  Save,
  Loader2,
  GripVertical,
  Trash2,
  Edit2,
  Video,
  FileText,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { Course, Lesson } from '@/lib/types_db'
import { cn } from '@/lib/utils'

interface LessonManagerSheetProps {
  open: boolean
  onClose: () => void
  course: Course | null
  onSave: () => void
}

interface LessonForm {
  id?: string
  title: string
  slug: string
  video_url: string
  content_markdown: string
  is_free_preview: boolean
  duration_minutes: number | null
}

const emptyLesson: LessonForm = {
  title: '',
  slug: '',
  video_url: '',
  content_markdown: '',
  is_free_preview: false,
  duration_minutes: null,
}

export function LessonManagerSheet({ open, onClose, course, onSave }: LessonManagerSheetProps) {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingLesson, setEditingLesson] = useState<LessonForm | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  // Load lessons when course changes
  useEffect(() => {
    if (course && open) {
      loadLessons()
    }
  }, [course, open])

  const loadLessons = async () => {
    if (!course) return
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/lessons?courseId=${course.id}`)
      if (response.ok) {
        const result = await response.json()
        setLessons(result.data || [])
      }
    } catch (error) {
      console.error('Failed to load lessons:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveLesson = async (lesson: LessonForm) => {
    if (!course) return
    setSaving(true)

    try {
      const response = await fetch('/api/admin/lessons', {
        method: lesson.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...lesson,
          course_id: course.id,
          display_order: lesson.id ? undefined : lessons.length,
        }),
      })

      if (response.ok) {
        await loadLessons()
        setEditingLesson(null)
        onSave()
      }
    } catch (error) {
      console.error('Failed to save lesson:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteLesson = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lesson?')) return

    try {
      const response = await fetch(`/api/admin/lessons?id=${id}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setLessons(prev => prev.filter(l => l.id !== id))
        onSave()
      }
    } catch (error) {
      console.error('Failed to delete lesson:', error)
    }
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (draggedId && draggedId !== targetId) {
      const draggedIndex = lessons.findIndex(l => l.id === draggedId)
      const targetIndex = lessons.findIndex(l => l.id === targetId)

      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newLessons = [...lessons]
        const [removed] = newLessons.splice(draggedIndex, 1)
        newLessons.splice(targetIndex, 0, removed)
        setLessons(newLessons)
      }
    }
  }

  const handleDragEnd = async () => {
    if (!draggedId) return

    // Save new order to database
    try {
      await Promise.all(
        lessons.map((lesson, index) =>
          fetch('/api/admin/lessons', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: lesson.id, display_order: index }),
          })
        )
      )
      onSave()
    } catch (error) {
      console.error('Failed to save lesson order:', error)
    }

    setDraggedId(null)
  }

  if (!open || !course) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-[#0a0a0b] border-l border-white/10 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white">Manage Lessons</h2>
            <p className="text-white/60 text-sm mt-1">{course.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#10B981]" />
            </div>
          ) : editingLesson ? (
            // Lesson Edit Form
            <LessonEditForm
              lesson={editingLesson}
              onSave={handleSaveLesson}
              onCancel={() => setEditingLesson(null)}
              saving={saving}
            />
          ) : (
            // Lesson List
            <div className="space-y-4">
              {/* Add Lesson Button */}
              <Button
                onClick={() => setEditingLesson(emptyLesson)}
                className="w-full bg-white/5 border border-white/10 text-white hover:bg-white/10"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Lesson
              </Button>

              {lessons.length === 0 ? (
                <div className="text-center py-12 text-white/40">
                  <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No lessons yet</p>
                  <p className="text-sm mt-1">Add your first lesson to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {lessons.map((lesson, index) => (
                    <div
                      key={lesson.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lesson.id)}
                      onDragOver={(e) => handleDragOver(e, lesson.id)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        'flex items-center gap-3 p-4 rounded-lg border transition-colors',
                        draggedId === lesson.id
                          ? 'border-emerald-500/50 bg-emerald-500/5'
                          : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                      )}
                    >
                      {/* Drag Handle */}
                      <div className="text-white/20 cursor-grab active:cursor-grabbing">
                        <GripVertical className="w-5 h-5" />
                      </div>

                      {/* Order Number */}
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 text-sm font-medium">
                        {index + 1}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-white truncate">{lesson.title}</h3>
                          {lesson.is_free_preview && (
                            <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Free Preview
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                          {lesson.video_url && (
                            <span className="flex items-center gap-1">
                              <Video className="w-3 h-3" />
                              Video
                            </span>
                          )}
                          {lesson.duration_minutes && (
                            <span>{lesson.duration_minutes} min</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingLesson({
                            id: lesson.id,
                            title: lesson.title,
                            slug: lesson.slug,
                            video_url: lesson.video_url || '',
                            content_markdown: lesson.content_markdown || '',
                            is_free_preview: lesson.is_free_preview,
                            duration_minutes: lesson.duration_minutes,
                          })}
                          className="text-white/60 hover:text-white hover:bg-white/5"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteLesson(lesson.id)}
                          className="text-white/60 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Lesson Edit Form Component
function LessonEditForm({
  lesson,
  onSave,
  onCancel,
  saving,
}: {
  lesson: LessonForm
  onSave: (lesson: LessonForm) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<LessonForm>(lesson)

  // Auto-generate slug from title
  const handleTitleChange = (title: string) => {
    setForm(prev => ({
      ...prev,
      title,
      slug: !prev.id ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : prev.slug,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <h3 className="text-lg font-semibold text-white">
          {lesson.id ? 'Edit Lesson' : 'New Lesson'}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-white/60"
        >
          <X className="w-4 h-4 mr-1" />
          Cancel
        </Button>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label className="text-white/80">Lesson Title</Label>
        <Input
          value={form.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="e.g., Understanding Market Psychology"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          required
        />
      </div>

      {/* Slug */}
      <div className="space-y-2">
        <Label className="text-white/80">URL Slug</Label>
        <Input
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
          placeholder="understanding-market-psychology"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
          required
        />
      </div>

      {/* Video URL */}
      <div className="space-y-2">
        <Label className="text-white/80">Video URL (Vimeo/YouTube)</Label>
        <Input
          value={form.video_url}
          onChange={(e) => setForm({ ...form, video_url: e.target.value })}
          placeholder="https://vimeo.com/123456789"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <Label className="text-white/80">Duration (minutes)</Label>
        <Input
          type="number"
          value={form.duration_minutes || ''}
          onChange={(e) => setForm({ ...form, duration_minutes: e.target.value ? parseInt(e.target.value) : null })}
          placeholder="15"
          className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
        />
      </div>

      {/* Content */}
      <div className="space-y-2">
        <Label className="text-white/80">Content (Markdown)</Label>
        <textarea
          value={form.content_markdown}
          onChange={(e) => setForm({ ...form, content_markdown: e.target.value })}
          placeholder="Lesson content in markdown format..."
          rows={8}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-sm"
        />
      </div>

      {/* Free Preview Toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
        <div>
          <Label className="text-white/80">Free Preview</Label>
          <p className="text-xs text-white/40">
            Allow non-members to view this lesson
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm({ ...form, is_free_preview: !form.is_free_preview })}
          className={cn(
            'relative w-12 h-6 rounded-full transition-colors',
            form.is_free_preview ? 'bg-emerald-500' : 'bg-white/20'
          )}
        >
          <span
            className={cn(
              'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
              form.is_free_preview ? 'left-7' : 'left-1'
            )}
          />
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="border-white/10 text-white/60 hover:text-white"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="bg-[#10B981] hover:bg-emerald-600 text-black"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Lesson
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
