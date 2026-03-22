'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  RefreshCw,
  ArrowLeft,
  BookOpen,
  FileText,
  Eye,
  EyeOff,
  Save,
  Plus,
  Edit2,
  ChevronRight,
} from 'lucide-react'

interface Lesson {
  id: string
  module_id: string
  slug: string
  title: string
  learning_objective: string
  hero_image_url: string | null
  estimated_minutes: number
  difficulty: string
  position: number
  is_published: boolean
  status: string
}

interface ModuleDetail {
  id: string
  track_id: string
  slug: string
  code: string
  title: string
  description: string | null
  learning_outcomes: string[]
  estimated_minutes: number
  position: number
  is_published: boolean
  cover_image_url: string | null
  difficulty: string | null
  lessons: Lesson[]
}

export default function ModuleEditorPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [mod, setMod] = useState<ModuleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    estimatedMinutes: 0,
    difficulty: 'beginner',
    isPublished: false,
    coverImageUrl: '',
    learningOutcomes: [] as string[],
  })
  const [newOutcome, setNewOutcome] = useState('')

  const loadModule = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/academy-v3/modules/${slug}`)
      if (response.ok) {
        const result = await response.json()
        const data = result.data as ModuleDetail
        setMod(data)
        setEditForm({
          title: data.title,
          description: data.description ?? '',
          estimatedMinutes: data.estimated_minutes,
          difficulty: data.difficulty ?? 'beginner',
          isPublished: data.is_published,
          coverImageUrl: data.cover_image_url ?? '',
          learningOutcomes: data.learning_outcomes ?? [],
        })
      } else if (response.status === 404) {
        router.push('/admin/academy/modules')
      }
    } catch (error) {
      console.error('Failed to load module:', error)
    } finally {
      setLoading(false)
    }
  }, [slug, router])

  useEffect(() => {
    loadModule()
  }, [loadModule])

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/academy-v3/modules/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description || null,
          estimatedMinutes: editForm.estimatedMinutes,
          difficulty: editForm.difficulty,
          isPublished: editForm.isPublished,
          coverImageUrl: editForm.coverImageUrl || null,
          learningOutcomes: editForm.learningOutcomes,
        }),
      })
      if (response.ok) {
        await loadModule()
      } else {
        const result = await response.json()
        alert(result.error || 'Failed to save module')
      }
    } catch (error) {
      console.error('Failed to save module:', error)
    } finally {
      setSaving(false)
    }
  }

  const addOutcome = () => {
    if (!newOutcome.trim()) return
    setEditForm(prev => ({
      ...prev,
      learningOutcomes: [...prev.learningOutcomes, newOutcome.trim()],
    }))
    setNewOutcome('')
  }

  const removeOutcome = (index: number) => {
    setEditForm(prev => ({
      ...prev,
      learningOutcomes: prev.learningOutcomes.filter((_, i) => i !== index),
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!mod) {
    return (
      <div className="text-center py-20 text-white/40">
        <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Module not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/academy/modules">
            <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{mod.title}</h1>
            <p className="text-white/50 text-sm font-mono">{mod.code} &middot; /{mod.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadModule}
            className="border-white/10 text-white/60 hover:text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-500 hover:bg-emerald-600 text-black"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Module Editor */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-[#0a0a0b] border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-400" />
                Module Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-1">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/60 mb-1">Estimated Minutes</label>
                  <input
                    type="number"
                    value={editForm.estimatedMinutes}
                    onChange={(e) => setEditForm(prev => ({ ...prev, estimatedMinutes: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-1">Difficulty</label>
                  <select
                    value={editForm.difficulty}
                    onChange={(e) => setEditForm(prev => ({ ...prev, difficulty: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1">Cover Image URL</label>
                <input
                  type="text"
                  value={editForm.coverImageUrl}
                  onChange={(e) => setEditForm(prev => ({ ...prev, coverImageUrl: e.target.value }))}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono focus:outline-none focus:border-emerald-500/50 placeholder:text-white/20"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditForm(prev => ({ ...prev, isPublished: !prev.isPublished }))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    editForm.isPublished
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-white/5 text-white/40 border border-white/10'
                  }`}
                >
                  {editForm.isPublished ? (
                    <><Eye className="w-4 h-4" /> Published</>
                  ) : (
                    <><EyeOff className="w-4 h-4" /> Draft</>
                  )}
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Learning Outcomes */}
          <Card className="bg-[#0a0a0b] border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base">Learning Outcomes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {editForm.learningOutcomes.map((outcome, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-emerald-400 font-mono w-6">{i + 1}.</span>
                  <span className="flex-1 text-sm text-white/80">{outcome}</span>
                  <button
                    onClick={() => removeOutcome(i)}
                    className="text-white/30 hover:text-red-400 transition-colors"
                  >
                    &times;
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newOutcome}
                  onChange={(e) => setNewOutcome(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addOutcome() }}
                  placeholder="Add a learning outcome..."
                  className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addOutcome}
                  disabled={!newOutcome.trim()}
                  className="text-emerald-400 hover:text-emerald-300"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lessons Sidebar */}
        <div className="space-y-6">
          <Card className="bg-[#0a0a0b] border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-base">
                <FileText className="w-4 h-4 text-emerald-400" />
                Lessons ({mod.lessons.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mod.lessons.length === 0 ? (
                <div className="text-center py-6 text-white/30">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No lessons yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {mod.lessons.map((lesson) => (
                    <Link
                      key={lesson.id}
                      href={`/admin/academy/lessons/${lesson.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg border border-white/5 hover:border-white/10 bg-white/[0.02] transition-colors group"
                    >
                      <span className="text-xs text-white/30 font-mono w-6 text-right">
                        {lesson.position + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{lesson.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs ${
                            lesson.status === 'published' ? 'text-emerald-400' :
                            lesson.status === 'review' ? 'text-amber-400' :
                            'text-white/30'
                          }`}>
                            {lesson.status}
                          </span>
                          <span className="text-xs text-white/30">{lesson.estimated_minutes}m</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-emerald-400 transition-colors" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
