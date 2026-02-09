'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { createAppError, createAppErrorFromResponse, notifyAppError } from '@/lib/error-handler'

interface Playbook {
  id: string
  name: string
  description: string | null
  is_active: boolean
  updated_at: string
}

export function PlaybookManager() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadPlaybooks = async () => {
    try {
      const response = await fetch('/api/members/playbooks', { cache: 'no-store' })
      if (!response.ok) throw await createAppErrorFromResponse(response)
      const result = await response.json()
      setPlaybooks(Array.isArray(result.data) ? result.data : [])
    } catch (error) {
      notifyAppError(createAppError(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPlaybooks()
  }, [])

  const createPlaybook = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const response = await fetch('/api/members/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          is_active: true,
        }),
      })
      if (!response.ok) throw await createAppErrorFromResponse(response)
      setName('')
      setDescription('')
      await loadPlaybooks()
    } catch (error) {
      notifyAppError(createAppError(error))
    } finally {
      setSaving(false)
    }
  }

  const deletePlaybook = async (id: string) => {
    try {
      const response = await fetch(`/api/members/playbooks/${id}`, { method: 'DELETE' })
      if (!response.ok) throw await createAppErrorFromResponse(response)
      await loadPlaybooks()
    } catch (error) {
      notifyAppError(createAppError(error))
    }
  }

  return (
    <div className="glass-card rounded-xl p-4 border border-white/[0.06] space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-ivory">Strategy Playbooks</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr_auto] gap-2">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Playbook name"
          className="h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-ivory focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
        />
        <input
          type="text"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Description"
          className="h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-ivory focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
        />
        <button
          type="button"
          onClick={createPlaybook}
          disabled={!name.trim() || saving}
          className="h-10 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add
        </button>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground">Loading playbooks...</div>
      ) : playbooks.length === 0 ? (
        <div className="text-xs text-muted-foreground">No playbooks yet. Create your first strategy above.</div>
      ) : (
        <div className="space-y-1.5">
          {playbooks.map((playbook) => (
            <div key={playbook.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm text-ivory truncate">{playbook.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{playbook.description || 'No description'}</p>
              </div>
              <button
                type="button"
                onClick={() => deletePlaybook(playbook.id)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-red-300 hover:bg-red-500/10"
                aria-label={`Delete ${playbook.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
