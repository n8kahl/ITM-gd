'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Search,
  Tag,
  TrendingUp,
  AlertCircle
} from 'lucide-react'

interface KBEntry {
  id: string
  category: string
  question: string
  answer: string
  context: string | null
  image_urls: string[] | null
  priority: number
  is_active: boolean
  created_at: string
  updated_at: string
}

const CATEGORIES = ['pricing', 'features', 'proof', 'faq', 'technical', 'escalation', 'mentorship', 'affiliate']

export default function KnowledgeBasePage() {
  const [entries, setEntries] = useState<KBEntry[]>([])
  const [filteredEntries, setFilteredEntries] = useState<KBEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all')
  const [editingEntry, setEditingEntry] = useState<KBEntry | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({
    category: 'faq',
    question: '',
    answer: '',
    context: '',
    image_urls: '',
    priority: 5,
    is_active: true
  })

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    byCategory: {} as Record<string, number>
  })

  useEffect(() => {
    loadEntries()
  }, [])

  useEffect(() => {
    let filtered = entries

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(e => e.category === selectedCategory)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(e =>
        e.question.toLowerCase().includes(query) ||
        e.answer.toLowerCase().includes(query)
      )
    }

    setFilteredEntries(filtered)
  }, [entries, selectedCategory, searchQuery])

  async function loadEntries() {
    const { data } = await supabase
      .from('knowledge_base')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })

    if (data) {
      setEntries(data)

      // Calculate stats
      const byCategory = data.reduce((acc, entry) => {
        acc[entry.category] = (acc[entry.category] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      setStats({
        total: data.length,
        active: data.filter(e => e.is_active).length,
        byCategory
      })
    }
  }

  async function saveEntry() {
    const payload = {
      ...formData,
      image_urls: formData.image_urls ? formData.image_urls.split(',').map(s => s.trim()) : null,
      context: formData.context || null
    }

    if (editingEntry) {
      // Update
      await supabase
        .from('knowledge_base')
        .update(payload)
        .eq('id', editingEntry.id)
    } else {
      // Create
      await supabase
        .from('knowledge_base')
        .insert(payload)
    }

    cancelEdit()
    loadEntries()
  }

  function startEdit(entry: KBEntry) {
    setEditingEntry(entry)
    setIsCreating(false)
    setFormData({
      category: entry.category,
      question: entry.question,
      answer: entry.answer,
      context: entry.context || '',
      image_urls: entry.image_urls?.join(', ') || '',
      priority: entry.priority,
      is_active: entry.is_active
    })
  }

  function startCreate() {
    setIsCreating(true)
    setEditingEntry(null)
    setFormData({
      category: 'faq',
      question: '',
      answer: '',
      context: '',
      image_urls: '',
      priority: 5,
      is_active: true
    })
  }

  function cancelEdit() {
    setEditingEntry(null)
    setIsCreating(false)
    setFormData({
      category: 'faq',
      question: '',
      answer: '',
      context: '',
      image_urls: '',
      priority: 5,
      is_active: true
    })
  }

  async function deleteEntry(id: string) {
    if (!confirm('Are you sure you want to delete this entry?')) return

    await supabase
      .from('knowledge_base')
      .delete()
      .eq('id', id)

    loadEntries()
  }

  async function toggleActive(id: string, currentState: boolean) {
    await supabase
      .from('knowledge_base')
      .update({ is_active: !currentState })
      .eq('id', id)

    loadEntries()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-champagne mb-2">
            Knowledge Base
          </h1>
          <p className="text-platinum/60">
            Manage AI responses and training data
          </p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Add Entry
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card-heavy">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-platinum/60">
              Total Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-ivory">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="glass-card-heavy">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-platinum/60">
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{stats.active}</div>
          </CardContent>
        </Card>

        <Card className="glass-card-heavy">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-platinum/60">
              Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-champagne">
              {Object.keys(stats.byCategory).length}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-heavy">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-platinum/60">
              Most Common
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold text-blue-400">
              {Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
            </div>
            <p className="text-xs text-platinum/40">
              {Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1])[0]?.[1] || 0} entries
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Edit/Create Form */}
      {(editingEntry || isCreating) && (
        <Card className="glass-card-heavy border-emerald-500/30">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{editingEntry ? 'Edit Entry' : 'Create New Entry'}</span>
              <Button variant="outline" size="sm" onClick={cancelEdit}>
                <X className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-platinum/60 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-background/50 border border-border/40 rounded-lg px-3 py-2 text-sm text-ivory"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-platinum/60 mb-2">
                  Priority (1-10)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-platinum/60 mb-2">
                Question Variations (separate with |)
              </label>
              <Input
                placeholder="How much does it cost? | What are your prices? | Pricing?"
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              />
              <p className="text-xs text-platinum/40 mt-1">
                Add multiple variations so AI can match different phrasings
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-platinum/60 mb-2">
                Answer
              </label>
              <textarea
                rows={6}
                placeholder="Enter the AI's response..."
                value={formData.answer}
                onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                className="w-full bg-background/50 border border-border/40 rounded-lg px-3 py-2 text-sm text-ivory resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-platinum/60 mb-2">
                Additional Context (optional)
              </label>
              <Input
                placeholder="Extra context to help AI understand when to use this..."
                value={formData.context}
                onChange={(e) => setFormData({ ...formData, context: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-platinum/60 mb-2">
                Image URLs (optional, comma-separated)
              </label>
              <Input
                placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                value={formData.image_urls}
                onChange={(e) => setFormData({ ...formData, image_urls: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="is_active" className="text-sm text-platinum/60">
                Active (AI will use this entry)
              </label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={saveEntry}>
                <Save className="w-4 h-4 mr-2" />
                Save Entry
              </Button>
              <Button variant="outline" onClick={cancelEdit}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <Card className="glass-card-heavy">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-platinum/40" />
              <Input
                placeholder="Search questions or answers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto">
              <Button
                size="sm"
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                onClick={() => setSelectedCategory('all')}
              >
                All
              </Button>
              {CATEGORIES.map(cat => (
                <Button
                  key={cat}
                  size="sm"
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat} ({stats.byCategory[cat] || 0})
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Entries List */}
      <div className="space-y-4">
        {filteredEntries.map(entry => (
          <Card key={entry.id} className="glass-card-heavy">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded">
                      {entry.category}
                    </span>
                    <span className="text-xs px-2 py-1 bg-champagne/10 text-champagne rounded">
                      Priority: {entry.priority}
                    </span>
                    {!entry.is_active && (
                      <span className="text-xs px-2 py-1 bg-red-500/10 text-red-400 rounded">
                        Inactive
                      </span>
                    )}
                  </div>

                  <h3 className="font-semibold text-ivory mb-2">
                    {entry.question.split('|')[0].trim()}
                  </h3>

                  {entry.question.split('|').length > 1 && (
                    <p className="text-xs text-platinum/40 mb-2">
                      +{entry.question.split('|').length - 1} more variations
                    </p>
                  )}

                  <p className="text-sm text-platinum/60 line-clamp-2">
                    {entry.answer}
                  </p>

                  {entry.image_urls && entry.image_urls.length > 0 && (
                    <p className="text-xs text-blue-400 mt-2">
                      📷 {entry.image_urls.length} image(s) attached
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleActive(entry.id, entry.is_active)}
                  >
                    {entry.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(entry)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteEntry(entry.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredEntries.length === 0 && (
          <Card className="glass-card-heavy">
            <CardContent className="p-8 text-center">
              <BookOpen className="w-16 h-16 text-platinum/20 mx-auto mb-4" />
              <p className="text-platinum/60">
                No entries found. Try adjusting your filters or create a new entry.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
