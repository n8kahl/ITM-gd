'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  RefreshCw,
  Plus,
  BookOpen,
  Layers,
  Eye,
  EyeOff,
  ChevronRight,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
} from 'lucide-react'

interface Track {
  id: string
  program_id: string
  code: string
  title: string
  description: string | null
  position: number
  is_active: boolean
  moduleCount: number
  publishedModuleCount: number
}

interface Module {
  id: string
  track_id: string
  slug: string
  code: string
  title: string
  description: string | null
  estimated_minutes: number
  position: number
  is_published: boolean
  cover_image_url: string | null
  difficulty: string | null
  lessonCount: number
  publishedLessonCount: number
}

export default function ModulesPage() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [modulesByTrack, setModulesByTrack] = useState<Record<string, Module[]>>({})
  const [loading, setLoading] = useState(true)
  const [expandedTracks, setExpandedTracks] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState<string | null>(null)
  const [newModule, setNewModule] = useState({ title: '', slug: '', code: '', description: '' })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [tracksRes, modulesRes] = await Promise.all([
        fetch('/api/admin/academy-v3/tracks'),
        fetch('/api/admin/academy-v3/modules'),
      ])

      if (tracksRes.ok) {
        const result = await tracksRes.json()
        const loadedTracks = result.data ?? []
        setTracks(loadedTracks)
        // Expand all tracks by default
        setExpandedTracks(new Set(loadedTracks.map((t: Track) => t.id)))
      }

      if (modulesRes.ok) {
        const result = await modulesRes.json()
        const modules: Module[] = result.data ?? []
        const grouped: Record<string, Module[]> = {}
        for (const mod of modules) {
          if (!grouped[mod.track_id]) grouped[mod.track_id] = []
          grouped[mod.track_id].push(mod)
        }
        setModulesByTrack(grouped)
      }
    } catch (error) {
      console.error('Failed to load tracks/modules:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const toggleTrack = (trackId: string) => {
    setExpandedTracks(prev => {
      const next = new Set(prev)
      if (next.has(trackId)) next.delete(trackId)
      else next.add(trackId)
      return next
    })
  }

  const handleTogglePublish = async (mod: Module) => {
    try {
      const response = await fetch(`/api/admin/academy-v3/modules/${mod.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !mod.is_published }),
      })
      if (response.ok) {
        setModulesByTrack(prev => {
          const updated = { ...prev }
          const trackModules = updated[mod.track_id]?.map(m =>
            m.id === mod.id ? { ...m, is_published: !m.is_published } : m
          )
          if (trackModules) updated[mod.track_id] = trackModules
          return updated
        })
      }
    } catch (error) {
      console.error('Failed to toggle publish:', error)
    }
  }

  const handleDelete = async (mod: Module) => {
    if (!confirm(`Delete module "${mod.title}"? This will also delete all its lessons.`)) return

    try {
      const response = await fetch(`/api/admin/academy-v3/modules/${mod.slug}`, {
        method: 'DELETE',
      })
      if (response.ok) {
        setModulesByTrack(prev => {
          const updated = { ...prev }
          updated[mod.track_id] = (updated[mod.track_id] ?? []).filter(m => m.id !== mod.id)
          return updated
        })
      }
    } catch (error) {
      console.error('Failed to delete module:', error)
    }
  }

  const handleCreateModule = async (trackId: string) => {
    if (!newModule.title || !newModule.slug || !newModule.code) return

    try {
      const response = await fetch('/api/admin/academy-v3/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId,
          title: newModule.title,
          slug: newModule.slug,
          code: newModule.code,
          description: newModule.description || null,
        }),
      })
      if (response.ok) {
        setCreating(null)
        setNewModule({ title: '', slug: '', code: '', description: '' })
        await loadData()
      } else {
        const result = await response.json()
        alert(result.error || 'Failed to create module')
      }
    } catch (error) {
      console.error('Failed to create module:', error)
    }
  }

  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Track & Module Manager</h1>
          <p className="text-white/60 mt-1">Organize tracks, modules, and lessons</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/academy">
            <Button variant="outline" size="sm" className="border-white/10 text-white/60 hover:text-white">
              Dashboard
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="border-white/10 text-white/60 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      )}

      {!loading && tracks.length === 0 && (
        <div className="text-center py-20 text-white/40">
          <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No tracks found</p>
          <p className="text-sm mt-1">Tracks are created via database migrations</p>
        </div>
      )}

      {!loading && tracks.map((track) => {
        const isExpanded = expandedTracks.has(track.id)
        const trackModules = modulesByTrack[track.id] ?? []

        return (
          <Card key={track.id} className="bg-[#0a0a0b] border-white/10">
            <CardHeader
              className="cursor-pointer select-none"
              onClick={() => toggleTrack(track.id)}
            >
              <CardTitle className="text-white flex items-center gap-3">
                <Layers className="w-5 h-5 text-emerald-400" />
                <span className="flex-1">
                  {track.title}
                  <span className="text-white/40 text-sm font-normal ml-3">
                    {track.code}
                  </span>
                </span>
                <span className="text-sm font-normal text-white/50">
                  {trackModules.length} module{trackModules.length !== 1 ? 's' : ''}
                </span>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-white/40" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-white/40" />
                )}
              </CardTitle>
            </CardHeader>

            {isExpanded && (
              <CardContent className="space-y-2">
                {track.description && (
                  <p className="text-sm text-white/50 mb-4">{track.description}</p>
                )}

                {trackModules.length === 0 && (
                  <div className="text-center py-8 text-white/30">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No modules in this track</p>
                  </div>
                )}

                {trackModules.map((mod) => (
                  <div
                    key={mod.id}
                    className="flex items-center gap-4 p-4 rounded-lg border border-white/5 hover:border-white/10 bg-white/[0.02] transition-colors"
                  >
                    <div className="text-white/20 cursor-grab">
                      <GripVertical className="w-5 h-5" />
                    </div>

                    {/* Cover thumbnail */}
                    <div className="w-16 h-12 rounded-lg bg-white/5 overflow-hidden flex-shrink-0">
                      {mod.cover_image_url ? (
                        <Image
                          src={mod.cover_image_url}
                          alt={mod.title}
                          width={64}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-white/20" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white truncate">{mod.title}</h3>
                        {mod.difficulty && (
                          <span className={`px-2 py-0.5 text-xs rounded-full border ${
                            mod.difficulty === 'advanced'
                              ? 'bg-red-500/10 text-red-400 border-red-500/30'
                              : mod.difficulty === 'intermediate'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}>
                            {mod.difficulty}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-white/50 truncate">
                        {mod.description || 'No description'}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                        <span>{mod.lessonCount} lesson{mod.lessonCount !== 1 ? 's' : ''}</span>
                        <span>{mod.estimated_minutes}m</span>
                        <span className="font-mono">{mod.code}</span>
                      </div>
                    </div>

                    {/* Publish toggle */}
                    <button
                      onClick={() => handleTogglePublish(mod)}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                        mod.is_published
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-white/5 text-white/40 border border-white/10'
                      }`}
                    >
                      {mod.is_published ? (
                        <><Eye className="w-3 h-3" /> Published</>
                      ) : (
                        <><EyeOff className="w-3 h-3" /> Draft</>
                      )}
                    </button>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Link href={`/admin/academy/modules/${mod.slug}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-white/60 hover:text-white hover:bg-white/5"
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      </Link>
                      <Link href={`/admin/academy/modules/${mod.slug}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-white/60 hover:text-white hover:bg-white/5"
                        >
                          <ChevronRight className="w-4 h-4 mr-1" />
                          Lessons
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(mod)}
                        className="text-white/60 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Create module inline */}
                {creating === track.id ? (
                  <div className="p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Module title"
                        value={newModule.title}
                        onChange={(e) => {
                          const title = e.target.value
                          setNewModule(prev => ({
                            ...prev,
                            title,
                            slug: slugify(title),
                            code: slugify(title).replace(/-/g, '_').toUpperCase().slice(0, 20),
                          }))
                        }}
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
                      />
                      <input
                        type="text"
                        placeholder="Slug"
                        value={newModule.slug}
                        onChange={(e) => setNewModule(prev => ({ ...prev, slug: e.target.value }))}
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 font-mono"
                      />
                      <input
                        type="text"
                        placeholder="Code (e.g. MOD_4_1)"
                        value={newModule.code}
                        onChange={(e) => setNewModule(prev => ({ ...prev, code: e.target.value }))}
                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 font-mono"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Description (optional)"
                      value={newModule.description}
                      onChange={(e) => setNewModule(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleCreateModule(track.id)}
                        disabled={!newModule.title || !newModule.slug || !newModule.code}
                        className="bg-emerald-500 hover:bg-emerald-600 text-black"
                      >
                        Create Module
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCreating(null)
                          setNewModule({ title: '', slug: '', code: '', description: '' })
                        }}
                        className="text-white/60 hover:text-white"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCreating(track.id)}
                    className="w-full border border-dashed border-white/10 text-white/40 hover:text-emerald-400 hover:border-emerald-500/30 py-3"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Module to {track.title}
                  </Button>
                )}
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
