'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sparkles,
  Save,
  Loader2,
  RefreshCw,
  BookOpen,
  Clock,
  Tag,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'

interface ContentGeneratorProps {
  courseId: string
  onSave?: (lesson: { id: string; title: string }) => void
}

interface QuizQuestion {
  question: string
  options: string[]
  correct_answer: number
  explanation: string
}

interface GeneratedContent {
  title: string
  content_markdown: string
  quiz_questions: QuizQuestion[]
  key_takeaways: string[]
  estimated_minutes: number
}

type Difficulty = 'beginner' | 'intermediate' | 'advanced'

const difficultyOptions: { value: Difficulty; label: string; color: string }[] = [
  { value: 'beginner', label: 'Beginner', color: 'text-emerald-400' },
  { value: 'intermediate', label: 'Intermediate', color: 'text-[#F3E5AB]' },
  { value: 'advanced', label: 'Advanced', color: 'text-red-400' },
]

export function ContentGenerator({ courseId, onSave }: ContentGeneratorProps) {
  const [form, setForm] = useState({
    title: '',
    difficulty: 'beginner' as Difficulty,
    key_topics: '',
    estimated_minutes: 15,
  })
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generated, setGenerated] = useState<GeneratedContent | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = useCallback(async () => {
    if (!form.title.trim()) {
      setError('Please enter a lesson title.')
      return
    }

    setError(null)
    setGenerating(true)

    try {
      const response = await fetch('/api/admin/academy/generate-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: courseId,
          title: form.title,
          difficulty: form.difficulty,
          key_topics: form.key_topics
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          estimated_minutes: form.estimated_minutes,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate lesson content')
      }

      const data = await response.json()
      setGenerated(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during generation')
    } finally {
      setGenerating(false)
    }
  }, [courseId, form])

  const handleSave = useCallback(async () => {
    if (!generated) return

    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/academy/generate-lesson', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: courseId,
          title: generated.title,
          content_markdown: generated.content_markdown,
          quiz_questions: generated.quiz_questions,
          key_takeaways: generated.key_takeaways,
          estimated_minutes: generated.estimated_minutes,
          difficulty: form.difficulty,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save lesson')
      }

      const data = await response.json()
      onSave?.({ id: data.id, title: generated.title })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while saving')
    } finally {
      setSaving(false)
    }
  }, [courseId, generated, form.difficulty, onSave])

  const handleRegenerate = useCallback(() => {
    setGenerated(null)
    handleGenerate()
  }, [handleGenerate])

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      {/* Left Panel - Form */}
      <div className="w-full lg:w-[400px] lg:flex-shrink-0 space-y-6">
        <div className="rounded-xl bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Sparkles className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">AI Content Generator</h2>
              <p className="text-sm text-white/40">Generate lesson content with AI</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-5">
            {/* Title */}
            <div className="space-y-2">
              <Label className="text-white/80 flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5" />
                Lesson Title
              </Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g., Understanding Options Greeks"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            {/* Difficulty */}
            <div className="space-y-2">
              <Label className="text-white/80 flex items-center gap-2">
                <Tag className="h-3.5 w-3.5" />
                Difficulty Level
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {difficultyOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, difficulty: opt.value })}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      form.difficulty === opt.value
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : 'border-white/10 bg-white/5 text-white/50 hover:text-white hover:border-white/20'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Key Topics */}
            <div className="space-y-2">
              <Label className="text-white/80 flex items-center gap-2">
                <Tag className="h-3.5 w-3.5" />
                Key Topics
              </Label>
              <Input
                value={form.key_topics}
                onChange={(e) => setForm({ ...form, key_topics: e.target.value })}
                placeholder="e.g., delta, gamma, theta, vega"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
              <p className="text-xs text-white/30">Separate topics with commas</p>
            </div>

            {/* Estimated Minutes */}
            <div className="space-y-2">
              <Label className="text-white/80 flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                Estimated Duration (minutes)
              </Label>
              <Input
                type="number"
                min={5}
                max={120}
                value={form.estimated_minutes}
                onChange={(e) =>
                  setForm({ ...form, estimated_minutes: parseInt(e.target.value) || 15 })
                }
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            {/* Generate Button */}
            <Button
              type="button"
              onClick={generated ? handleRegenerate : handleGenerate}
              disabled={generating || !form.title.trim()}
              className={cn(
                'w-full font-semibold transition-all',
                generating
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-[#10B981] hover:bg-emerald-600 text-black'
              )}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : generated ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate with AI
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Save Button - shown when content is generated */}
        {generated && (
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#10B981] hover:bg-emerald-600 text-black font-semibold"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving Lesson...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Lesson
              </>
            )}
          </Button>
        )}
      </div>

      {/* Right Panel - Preview */}
      <div className="flex-1 min-w-0">
        {generating ? (
          /* Loading State */
          <div className="rounded-xl bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 p-12 flex flex-col items-center justify-center min-h-[500px]">
            <div className="relative mb-6">
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center animate-pulse">
                <Sparkles className="h-8 w-8 text-emerald-400" />
              </div>
              <div className="absolute -inset-4 rounded-3xl border border-emerald-500/20 animate-ping opacity-20" />
            </div>
            <p className="text-white/60 text-lg font-medium">Generating lesson content...</p>
            <p className="text-white/30 text-sm mt-2">This may take a moment</p>
          </div>
        ) : generated ? (
          /* Generated Content Preview */
          <div className="space-y-6">
            {/* Content Preview */}
            <div className="rounded-xl bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 p-6">
              <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/5">
                <BookOpen className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
                  Lesson Content
                </h3>
                <span className="ml-auto text-xs text-white/30">
                  {generated.estimated_minutes} min read
                </span>
              </div>
              <div className="prose prose-invert prose-emerald max-w-none prose-headings:text-white prose-p:text-white/70 prose-strong:text-white prose-li:text-white/70 prose-code:text-emerald-400 prose-code:bg-emerald-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10 prose-a:text-emerald-400">
                <ReactMarkdown>{generated.content_markdown}</ReactMarkdown>
              </div>
            </div>

            {/* Key Takeaways */}
            {generated.key_takeaways && generated.key_takeaways.length > 0 && (
              <div className="rounded-xl bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 p-6">
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/5">
                  <Lightbulb className="h-4 w-4 text-[#F3E5AB]" />
                  <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
                    Key Takeaways
                  </h3>
                </div>
                <ul className="space-y-3">
                  {generated.key_takeaways.map((takeaway, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                      <span className="text-white/70 text-sm">{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quiz Questions Preview */}
            {generated.quiz_questions && generated.quiz_questions.length > 0 && (
              <div className="rounded-xl bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 p-6">
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/5">
                  <HelpCircle className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
                    Quiz Questions
                  </h3>
                  <span className="ml-auto rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-xs text-white/40">
                    {generated.quiz_questions.length} questions
                  </span>
                </div>
                <div className="space-y-6">
                  {generated.quiz_questions.map((q, qi) => (
                    <QuizQuestionPreview key={qi} question={q} index={qi} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty State */
          <div className="rounded-xl bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5 p-12 flex flex-col items-center justify-center min-h-[500px]">
            <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center mb-6">
              <BookOpen className="h-8 w-8 text-white/20" />
            </div>
            <p className="text-white/40 text-lg font-medium">No content generated yet</p>
            <p className="text-white/25 text-sm mt-2 text-center max-w-sm">
              Fill in the lesson details on the left and click &quot;Generate with AI&quot; to create
              lesson content, quiz questions, and key takeaways.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/* Quiz Question Preview Sub-component */
function QuizQuestionPreview({
  question,
  index,
}: {
  question: QuizQuestion
  index: number
}) {
  const [showAnswer, setShowAnswer] = useState(false)

  return (
    <div className="rounded-lg bg-white/[0.02] border border-white/5 p-4">
      <div className="flex items-start gap-3 mb-3">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-400">
          {index + 1}
        </span>
        <p className="text-sm font-medium text-white">{question.question}</p>
      </div>

      <div className="ml-9 space-y-2 mb-3">
        {question.options.map((option, oi) => (
          <div
            key={oi}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
              showAnswer && oi === question.correct_answer
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-white/[0.02] border border-white/5 text-white/60'
            )}
          >
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-white/10 text-[10px] font-medium text-white/40">
              {String.fromCharCode(65 + oi)}
            </span>
            <span>{option}</span>
            {showAnswer && oi === question.correct_answer && (
              <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-400" />
            )}
          </div>
        ))}
      </div>

      <div className="ml-9">
        <button
          type="button"
          onClick={() => setShowAnswer(!showAnswer)}
          className="flex items-center gap-1 text-xs text-white/40 hover:text-white/60 transition-colors"
        >
          <ChevronRight
            className={cn('h-3 w-3 transition-transform', showAnswer && 'rotate-90')}
          />
          {showAnswer ? 'Hide answer' : 'Show answer'}
        </button>
        {showAnswer && question.explanation && (
          <p className="mt-2 text-xs text-white/50 leading-relaxed">{question.explanation}</p>
        )}
      </div>
    </div>
  )
}
