'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, Save, Loader2 } from 'lucide-react'
import { Course } from '@/lib/types_db'
import { cn } from '@/lib/utils'

interface CourseEditorSheetProps {
  open: boolean
  onClose: () => void
  course: Course | null
  onSave: () => void
}

interface DiscordRole {
  discord_role_id: string
  discord_role_name: string | null
}

export function CourseEditorSheet({ open, onClose, course, onSave }: CourseEditorSheetProps) {
  const [form, setForm] = useState({
    title: '',
    slug: '',
    description: '',
    thumbnail_url: '',
    discord_role_required: null as string | null,
    is_published: false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [discordRoles, setDiscordRoles] = useState<DiscordRole[]>([])
  const [rolesLoading, setRolesLoading] = useState(true)

  // Fetch Discord roles from API
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await fetch('/api/admin/roles')
        if (response.ok) {
          const data = await response.json()
          setDiscordRoles(data.roles || [])
        }
      } catch (err) {
        console.error('Failed to fetch Discord roles:', err)
      } finally {
        setRolesLoading(false)
      }
    }

    if (open) {
      fetchRoles()
    }
  }, [open])

  // Reset form when course changes
  useEffect(() => {
    if (course) {
      setForm({
        title: course.title,
        slug: course.slug,
        description: course.description || '',
        thumbnail_url: course.thumbnail_url || '',
        discord_role_required: course.discord_role_required,
        is_published: course.is_published,
      })
    } else {
      setForm({
        title: '',
        slug: '',
        description: '',
        thumbnail_url: '',
        discord_role_required: null,
        is_published: false,
      })
    }
    setError(null)
  }, [course, open])

  // Auto-generate slug from title
  const handleTitleChange = (title: string) => {
    setForm(prev => ({
      ...prev,
      title,
      slug: !course ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : prev.slug,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const response = await fetch('/api/admin/courses', {
        method: course ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(course ? { id: course.id, ...form } : form),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save course')
      }

      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  // Build the role options array with "Public" as first option
  const roleOptions = [
    { id: null, name: 'Public (No Role Required)' },
    ...discordRoles.map(role => ({
      id: role.discord_role_id,
      name: role.discord_role_name || role.discord_role_id
    }))
  ]

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-[#0a0a0b] border-l border-white/10 shadow-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <h2 className="text-xl font-bold text-white">
              {course ? 'Edit Course' : 'Create Course'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label className="text-white/80">Course Title</Label>
              <Input
                value={form.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g., Trading Psychology Masterclass"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                required
              />
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label className="text-white/80">URL Slug</Label>
              <div className="flex items-center">
                <span className="px-3 py-2 bg-white/5 border border-white/10 border-r-0 rounded-l-md text-white/40 text-sm">
                  /courses/
                </span>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="trading-psychology"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-l-none"
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-white/80">Description</Label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="A brief description of what students will learn..."
                rows={4}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-md text-white placeholder:text-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            {/* Thumbnail URL */}
            <div className="space-y-2">
              <Label className="text-white/80">Thumbnail URL</Label>
              <Input
                value={form.thumbnail_url}
                onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
                placeholder="https://example.com/image.jpg"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
              {form.thumbnail_url && (
                <div className="mt-2 w-full h-40 rounded-lg bg-white/5 overflow-hidden">
                  <img
                    src={form.thumbnail_url}
                    alt="Thumbnail preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
              )}
            </div>

            {/* Discord Role Requirement */}
            <div className="space-y-2">
              <Label className="text-white/80">Required Discord Role</Label>
              <p className="text-xs text-white/40 mb-2">
                Only members with this role can access the course
              </p>
              {rolesLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {roleOptions.map((role) => (
                    <button
                      key={role.id || 'public'}
                      type="button"
                      onClick={() => setForm({ ...form, discord_role_required: role.id })}
                      className={cn(
                        'p-3 rounded-lg border text-left text-sm transition-colors',
                        form.discord_role_required === role.id
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                          : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/20'
                      )}
                    >
                      {role.name}
                    </button>
                  ))}
                </div>
              )}
              {!rolesLoading && discordRoles.length === 0 && (
                <p className="text-xs text-amber-400 mt-2">
                  No Discord roles configured. Add roles in Settings → Role Mapping.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {DISCORD_ROLES.map((role) => (
                  <button
                    key={role.id || 'public'}
                    type="button"
                    onClick={() => setForm({ ...form, discord_role_required: role.id })}
                    className={cn(
                      'p-3 rounded-lg border text-left text-sm transition-colors',
                      form.discord_role_required === role.id
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/20'
                    )}
                  >
                    {role.name}
                  </button>
                ))}
              </div>
>>>>>>> 6c5a005 (Complete platform-wide "De-Golding": Replace 129 gold instances with Emerald)
            </div>

            {/* Published Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
              <div>
                <Label className="text-white/80">Published</Label>
                <p className="text-xs text-white/40">
                  Make this course visible to members
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, is_published: !form.is_published })}
                className={cn(
                  'relative w-12 h-6 rounded-full transition-colors',
                  form.is_published ? 'bg-[#D4AF37]' : 'bg-white/20'
                )}
              >
                <span
                  className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                    form.is_published ? 'left-7' : 'left-1'
                  )}
                />
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-white/10 text-white/60 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#D4AF37] hover:bg-emerald-600 text-black"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {course ? 'Save Changes' : 'Create Course'}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
