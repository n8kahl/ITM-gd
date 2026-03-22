'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  RefreshCw,
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  FileText,
  Blocks,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

const BLOCK_TYPES = [
  { value: 'hook', label: 'Hook', category: 'text' },
  { value: 'concept_explanation', label: 'Concept Explanation', category: 'text' },
  { value: 'worked_example', label: 'Worked Example', category: 'text' },
  { value: 'guided_practice', label: 'Guided Practice', category: 'text' },
  { value: 'independent_practice', label: 'Independent Practice', category: 'text' },
  { value: 'reflection', label: 'Reflection', category: 'text' },
  { value: 'options_chain_simulator', label: 'Options Chain Simulator', category: 'interactive' },
  { value: 'payoff_diagram_builder', label: 'Payoff Diagram Builder', category: 'interactive' },
  { value: 'greeks_dashboard', label: 'Greeks Dashboard', category: 'interactive' },
  { value: 'trade_scenario_tree', label: 'Trade Scenario Tree', category: 'interactive' },
  { value: 'strategy_matcher', label: 'Strategy Matcher', category: 'interactive' },
  { value: 'position_builder', label: 'Position Builder', category: 'interactive' },
  { value: 'flashcard_deck', label: 'Flashcard Deck', category: 'interactive' },
  { value: 'timed_challenge', label: 'Timed Challenge', category: 'interactive' },
  { value: 'market_context_tagger', label: 'Market Context Tagger', category: 'interactive' },
  { value: 'order_entry_simulator', label: 'Order Entry Simulator', category: 'interactive' },
  { value: 'what_went_wrong', label: 'What Went Wrong', category: 'interactive' },
  { value: 'journal_prompt', label: 'Journal Prompt', category: 'interactive' },
] as const

interface Block {
  id: string
  lesson_id: string
  block_type: string
  position: number
  title: string | null
  content_json: Record<string, unknown>
}

interface LessonData {
  id: string
  module_id: string
  slug: string
  title: string
  learning_objective: string
  hero_image_url: string | null
  estimated_minutes: number
  difficulty: string
  prerequisite_lesson_ids: string[]
  position: number
  is_published: boolean
  status: string
  blocks: Block[]
}

export default function LessonEditorPage() {
  const params = useParams()
  const router = useRouter()
  const lessonId = params.id as string

  const [lesson, setLesson] = useState<LessonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set())
  const [showBlockSelector, setShowBlockSelector] = useState(false)

  const [form, setForm] = useState({
    title: '',
    learningObjective: '',
    heroImageUrl: '',
    estimatedMinutes: 0,
    difficulty: 'beginner',
    isPublished: false,
    status: 'draft',
  })

  const loadLesson = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/academy-v3/lessons/${lessonId}`)
      if (response.ok) {
        const result = await response.json()
        const data = result.data as LessonData
        setLesson(data)
        setForm({
          title: data.title,
          learningObjective: data.learning_objective,
          heroImageUrl: data.hero_image_url ?? '',
          estimatedMinutes: data.estimated_minutes,
          difficulty: data.difficulty,
          isPublished: data.is_published,
          status: data.status,
        })
      } else if (response.status === 404) {
        router.push('/admin/academy/modules')
      }
    } catch (error) {
      console.error('Failed to load lesson:', error)
    } finally {
      setLoading(false)
    }
  }, [lessonId, router])

  useEffect(() => {
    loadLesson()
  }, [loadLesson])

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/academy-v3/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!response.ok) {
        const result = await response.json()
        alert(result.error || 'Failed to save')
      }
    } catch (error) {
      console.error('Failed to save lesson:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleAddBlock = async (blockType: string) => {
    try {
      const response = await fetch(`/api/admin/academy-v3/lessons/${lessonId}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockType,
          title: BLOCK_TYPES.find(bt => bt.value === blockType)?.label ?? blockType,
          contentJson: blockType === 'hook' || blockType === 'concept_explanation' || blockType === 'worked_example' || blockType === 'guided_practice' || blockType === 'independent_practice' || blockType === 'reflection'
            ? { markdown: '' }
            : {},
        }),
      })
      if (response.ok) {
        setShowBlockSelector(false)
        await loadLesson()
      }
    } catch (error) {
      console.error('Failed to add block:', error)
    }
  }

  const handleUpdateBlock = async (blockId: string, contentJson: Record<string, unknown>) => {
    try {
      await fetch(`/api/admin/academy-v3/lessons/${lessonId}/blocks/${blockId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentJson }),
      })
    } catch (error) {
      console.error('Failed to update block:', error)
    }
  }

  const handleDeleteBlock = async (blockId: string) => {
    if (!confirm('Delete this block?')) return

    try {
      const response = await fetch(`/api/admin/academy-v3/lessons/${lessonId}/blocks/${blockId}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        await loadLesson()
      }
    } catch (error) {
      console.error('Failed to delete block:', error)
    }
  }

  const toggleBlock = (blockId: string) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev)
      if (next.has(blockId)) next.delete(blockId)
      else next.add(blockId)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="text-center py-20 text-white/40">
        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Lesson not found</p>
      </div>
    )
  }

  const textBlocks = BLOCK_TYPES.filter(bt => bt.category === 'text')
  const interactiveBlocks = BLOCK_TYPES.filter(bt => bt.category === 'interactive')

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
            <h1 className="text-2xl font-bold text-white">{lesson.title}</h1>
            <p className="text-white/50 text-sm font-mono">/{lesson.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadLesson}
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
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lesson Metadata */}
        <Card className="bg-[#0a0a0b] border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-base">Lesson Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">Learning Objective</label>
              <textarea
                value={form.learningObjective}
                onChange={(e) => setForm(prev => ({ ...prev, learningObjective: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">Hero Image URL</label>
              <input
                type="text"
                value={form.heroImageUrl}
                onChange={(e) => setForm(prev => ({ ...prev, heroImageUrl: e.target.value }))}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono focus:outline-none focus:border-emerald-500/50 placeholder:text-white/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-white/60 mb-1">Minutes</label>
                <input
                  type="number"
                  value={form.estimatedMinutes}
                  onChange={(e) => setForm(prev => ({ ...prev, estimatedMinutes: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">Difficulty</label>
                <select
                  value={form.difficulty}
                  onChange={(e) => setForm(prev => ({ ...prev, difficulty: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-white/60 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="draft">Draft</option>
                  <option value="review">Review</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setForm(prev => ({ ...prev, isPublished: !prev.isPublished }))}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    form.isPublished
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-white/5 text-white/40 border border-white/10'
                  }`}
                >
                  {form.isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {form.isPublished ? 'Published' : 'Draft'}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Block Editor */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Blocks className="w-5 h-5 text-emerald-400" />
              Content Blocks ({lesson.blocks.length})
            </h2>
            <Button
              size="sm"
              onClick={() => setShowBlockSelector(!showBlockSelector)}
              className="bg-emerald-500 hover:bg-emerald-600 text-black"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Block
            </Button>
          </div>

          {/* Block Type Selector */}
          {showBlockSelector && (
            <Card className="bg-[#0a0a0b] border-emerald-500/30">
              <CardContent className="p-4">
                <p className="text-sm text-white/60 mb-3">Text Blocks</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                  {textBlocks.map((bt) => (
                    <button
                      key={bt.value}
                      onClick={() => handleAddBlock(bt.value)}
                      className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 hover:border-emerald-500/30 hover:text-emerald-400 transition-colors text-left"
                    >
                      {bt.label}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-white/60 mb-3">Interactive Activities</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {interactiveBlocks.map((bt) => (
                    <button
                      key={bt.value}
                      onClick={() => handleAddBlock(bt.value)}
                      className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 hover:border-emerald-500/30 hover:text-emerald-400 transition-colors text-left"
                    >
                      {bt.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Block List */}
          {lesson.blocks.length === 0 ? (
            <Card className="bg-[#0a0a0b] border-white/10">
              <CardContent className="text-center py-12 text-white/30">
                <Blocks className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>No blocks yet</p>
                <p className="text-sm mt-1">Add content blocks to build this lesson</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {lesson.blocks.map((block) => {
                const isExpanded = expandedBlocks.has(block.id)
                const blockLabel = BLOCK_TYPES.find(bt => bt.value === block.block_type)?.label ?? block.block_type
                const isText = BLOCK_TYPES.find(bt => bt.value === block.block_type)?.category === 'text'

                return (
                  <Card key={block.id} className="bg-[#0a0a0b] border-white/10">
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer select-none"
                      onClick={() => toggleBlock(block.id)}
                    >
                      <GripVertical className="w-4 h-4 text-white/20 cursor-grab" />
                      <span className="text-xs text-white/30 font-mono w-6 text-right">
                        {block.position + 1}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded border ${
                        isText
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                      }`}>
                        {blockLabel}
                      </span>
                      <span className="flex-1 text-sm text-white/60 truncate">
                        {block.title || 'Untitled'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteBlock(block.id)
                        }}
                        className="text-white/30 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-white/30" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-white/30" />
                      )}
                    </div>

                    {isExpanded && (
                      <CardContent className="pt-0 pb-4 px-4">
                        {isText ? (
                          <textarea
                            defaultValue={(block.content_json as Record<string, string>).markdown ?? ''}
                            onBlur={(e) => handleUpdateBlock(block.id, { markdown: e.target.value })}
                            rows={8}
                            placeholder="Write markdown content here..."
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono focus:outline-none focus:border-emerald-500/50 resize-y"
                          />
                        ) : (
                          <textarea
                            defaultValue={JSON.stringify(block.content_json, null, 2)}
                            onBlur={(e) => {
                              try {
                                const parsed = JSON.parse(e.target.value)
                                handleUpdateBlock(block.id, parsed)
                              } catch {
                                // Invalid JSON — don't save
                              }
                            }}
                            rows={8}
                            placeholder='{"config": {}}'
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono focus:outline-none focus:border-emerald-500/50 resize-y"
                          />
                        )}
                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
