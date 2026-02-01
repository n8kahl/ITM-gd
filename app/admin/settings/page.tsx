'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Settings,
  Save,
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle,
  Send,
  X,
  Shield,
  MessageSquare,
  Bell
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface AppSetting {
  key: string
  value: string | null
  description: string | null
  is_masked?: boolean
  created_at: string
  updated_at: string
}

// Configuration for known settings
const SETTING_CONFIG: Record<string, {
  label: string
  description: string
  category: 'discord' | 'telegram' | 'api' | 'other'
  sensitive: boolean
  placeholder?: string
}> = {
  discord_guild_id: {
    label: 'Discord Guild ID',
    description: 'Your Discord server ID for role syncing',
    category: 'discord',
    sensitive: false,
    placeholder: '1234567890123456789',
  },
  discord_bot_token: {
    label: 'Discord Bot Token',
    description: 'Bot token for Discord API access (optional)',
    category: 'discord',
    sensitive: true,
    placeholder: 'MTIzNDU2Nzg5MDEyMzQ1Njc4OQ...',
  },
  discord_webhook_url: {
    label: 'Discord Webhook URL',
    description: 'Webhook for chat escalation notifications',
    category: 'discord',
    sensitive: true,
    placeholder: 'https://discord.com/api/webhooks/...',
  },
  telegram_bot_token: {
    label: 'Telegram Bot Token',
    description: 'Bot token from @BotFather',
    category: 'telegram',
    sensitive: true,
    placeholder: '123456789:ABCdefGHIjklmNOPqrs...',
  },
  telegram_chat_id: {
    label: 'Telegram Chat ID',
    description: 'Chat/Group ID for notifications',
    category: 'telegram',
    sensitive: false,
    placeholder: '-1001234567890',
  },
  openai_api_key: {
    label: 'OpenAI API Key',
    description: 'API key for AI features (journal analysis, chat)',
    category: 'api',
    sensitive: true,
    placeholder: 'sk-...',
  },
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set())
  const [editedValues, setEditedValues] = useState<Record<string, string>>({})
  const [testingNotification, setTestingNotification] = useState(false)
  const [showAddNew, setShowAddNew] = useState(false)
  const [newSetting, setNewSetting] = useState({ key: '', value: '', description: '' })

  const loadSettings = useCallback(async (reveal = false) => {
    setLoading(true)
    setError(null)

    try {
      const url = reveal ? '/api/admin/settings?reveal=true' : '/api/admin/settings'
      const response = await fetch(url)
      const data = await response.json()

      if (data.success) {
        setSettings(data.data)
        // Initialize edited values with current values
        const values: Record<string, string> = {}
        data.data.forEach((s: AppSetting) => {
          if (!s.is_masked && s.value) {
            values[s.key] = s.value
          }
        })
        setEditedValues(values)
      } else {
        setError(data.error || 'Failed to load settings')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Toggle reveal for a specific key
  const toggleReveal = async (key: string) => {
    if (revealedKeys.has(key)) {
      // Hide it
      setRevealedKeys(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
      // Reload to get masked value
      loadSettings(false)
    } else {
      // Reveal it - fetch actual value
      try {
        const response = await fetch('/api/admin/settings?reveal=true')
        const data = await response.json()
        if (data.success) {
          const setting = data.data.find((s: AppSetting) => s.key === key)
          if (setting) {
            setEditedValues(prev => ({ ...prev, [key]: setting.value || '' }))
            setRevealedKeys(prev => new Set(prev).add(key))
          }
        }
      } catch (err) {
        setError('Failed to reveal value')
      }
    }
  }

  // Save a single setting
  const saveSetting = async (key: string) => {
    const value = editedValues[key]
    if (value === undefined) return

    setSaving(key)
    setError(null)

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(`"${key}" saved successfully`)
        setTimeout(() => setSuccess(null), 3000)
        // Reload to refresh state
        loadSettings(false)
        setRevealedKeys(new Set())
      } else {
        setError(data.error || 'Failed to save setting')
      }
    } catch (err) {
      setError('Failed to save setting')
    } finally {
      setSaving(null)
    }
  }

  // Add new setting
  const addNewSetting = async () => {
    if (!newSetting.key.trim()) {
      setError('Key is required')
      return
    }

    setSaving('new')
    setError(null)

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSetting),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(`"${newSetting.key}" added successfully`)
        setTimeout(() => setSuccess(null), 3000)
        setShowAddNew(false)
        setNewSetting({ key: '', value: '', description: '' })
        loadSettings(false)
      } else {
        setError(data.error || 'Failed to add setting')
      }
    } catch (err) {
      setError('Failed to add setting')
    } finally {
      setSaving(null)
    }
  }

  // Delete setting
  const deleteSetting = async (key: string) => {
    if (!confirm(`Delete setting "${key}"?`)) return

    setSaving(key)
    setError(null)

    try {
      const response = await fetch(`/api/admin/settings?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(`"${key}" deleted successfully`)
        setTimeout(() => setSuccess(null), 3000)
        loadSettings(false)
      } else {
        setError(data.error || 'Failed to delete setting')
      }
    } catch (err) {
      setError('Failed to delete setting')
    } finally {
      setSaving(null)
    }
  }

  // Test Telegram notification
  const testTelegramNotification = async () => {
    setTestingNotification(true)
    setError(null)

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-team-lead`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            type: 'test',
            name: 'Admin Test',
            email: 'test@tradeitm.com',
            message: 'This is a test notification from the Settings page.',
            source: 'Admin Settings Test',
          }),
        }
      )

      if (response.ok) {
        setSuccess('Test notification sent successfully! Check your Telegram.')
        setTimeout(() => setSuccess(null), 5000)
      } else {
        const data = await response.json()
        setError(data.error || 'Failed to send test notification')
      }
    } catch (err) {
      setError('Failed to send test notification')
    } finally {
      setTestingNotification(false)
    }
  }

  // Group settings by category
  const groupedSettings = {
    discord: settings.filter(s => SETTING_CONFIG[s.key]?.category === 'discord' || s.key.includes('discord')),
    telegram: settings.filter(s => SETTING_CONFIG[s.key]?.category === 'telegram' || s.key.includes('telegram')),
    api: settings.filter(s => SETTING_CONFIG[s.key]?.category === 'api' || s.key.includes('api') || s.key.includes('key')),
    other: settings.filter(s => {
      const config = SETTING_CONFIG[s.key]
      if (config) return config.category === 'other'
      return !s.key.includes('discord') && !s.key.includes('telegram') && !s.key.includes('api') && !s.key.includes('key')
    }),
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin mx-auto mb-4" />
          <p className="text-white/60">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-3">
            <Settings className="w-8 h-8 text-[#D4AF37]" />
            Configuration Center
          </h1>
          <p className="text-white/60 mt-1">
            Manage system secrets and configuration
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => loadSettings(false)}
            className="border-white/20 text-white hover:bg-white/5"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => setShowAddNew(true)}
            className="bg-[#D4AF37] hover:bg-[#B8962E] text-black"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Setting
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-400 font-medium">Error</p>
            <p className="text-sm text-red-400/70">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-400">{success}</p>
        </div>
      )}

      {/* Security Notice */}
      <Card className="bg-gradient-to-br from-[#D4AF37]/10 to-transparent border-[#D4AF37]/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-[#D4AF37] flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-white mb-1">Security Notice</h3>
              <p className="text-sm text-white/60">
                Sensitive values are masked by default. Click the eye icon to reveal them.
                These settings are stored securely in your database.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Discord Settings */}
      <SettingsSection
        title="Discord Integration"
        icon={MessageSquare}
        settings={groupedSettings.discord}
        editedValues={editedValues}
        revealedKeys={revealedKeys}
        saving={saving}
        onEdit={(key, value) => setEditedValues(prev => ({ ...prev, [key]: value }))}
        onToggleReveal={toggleReveal}
        onSave={saveSetting}
        onDelete={deleteSetting}
      />

      {/* Telegram Settings */}
      <Card className="bg-[#0a0a0b] border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#D4AF37]" />
              Telegram Notifications
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={testTelegramNotification}
              disabled={testingNotification}
              className="border-white/20 text-white hover:bg-white/5"
            >
              {testingNotification ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Test Notification
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {groupedSettings.telegram.length === 0 ? (
            <EmptyState
              text="No Telegram settings configured"
              onAdd={() => {
                setNewSetting({ key: 'telegram_bot_token', value: '', description: 'Telegram bot token' })
                setShowAddNew(true)
              }}
            />
          ) : (
            <div className="space-y-4">
              {groupedSettings.telegram.map(setting => (
                <SettingRow
                  key={setting.key}
                  setting={setting}
                  editedValue={editedValues[setting.key] || ''}
                  isRevealed={revealedKeys.has(setting.key)}
                  isSaving={saving === setting.key}
                  onEdit={(value) => setEditedValues(prev => ({ ...prev, [setting.key]: value }))}
                  onToggleReveal={() => toggleReveal(setting.key)}
                  onSave={() => saveSetting(setting.key)}
                  onDelete={() => deleteSetting(setting.key)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Keys */}
      <SettingsSection
        title="API Keys"
        icon={Shield}
        settings={groupedSettings.api}
        editedValues={editedValues}
        revealedKeys={revealedKeys}
        saving={saving}
        onEdit={(key, value) => setEditedValues(prev => ({ ...prev, [key]: value }))}
        onToggleReveal={toggleReveal}
        onSave={saveSetting}
        onDelete={deleteSetting}
      />

      {/* Other Settings */}
      {groupedSettings.other.length > 0 && (
        <SettingsSection
          title="Other Settings"
          icon={Settings}
          settings={groupedSettings.other}
          editedValues={editedValues}
          revealedKeys={revealedKeys}
          saving={saving}
          onEdit={(key, value) => setEditedValues(prev => ({ ...prev, [key]: value }))}
          onToggleReveal={toggleReveal}
          onSave={saveSetting}
          onDelete={deleteSetting}
        />
      )}

      {/* Add New Setting Modal */}
      {showAddNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddNew(false)} />
          <div className="relative bg-[#0a0a0b] border border-white/10 rounded-2xl w-full max-w-md m-4 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Add New Setting</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-1">Key</label>
                <input
                  type="text"
                  value={newSetting.key}
                  onChange={(e) => setNewSetting({ ...newSetting, key: e.target.value })}
                  placeholder="setting_key"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">Value</label>
                <input
                  type="text"
                  value={newSetting.value}
                  onChange={(e) => setNewSetting({ ...newSetting, value: e.target.value })}
                  placeholder="Value"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={newSetting.description}
                  onChange={(e) => setNewSetting({ ...newSetting, description: e.target.value })}
                  placeholder="Description"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowAddNew(false)}
                className="flex-1 border-white/20 text-white hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                onClick={addNewSetting}
                disabled={saving === 'new'}
                className="flex-1 bg-[#D4AF37] hover:bg-[#B8962E] text-black"
              >
                {saving === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Setting'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Settings Section Component
function SettingsSection({
  title,
  icon: Icon,
  settings,
  editedValues,
  revealedKeys,
  saving,
  onEdit,
  onToggleReveal,
  onSave,
  onDelete,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  settings: AppSetting[]
  editedValues: Record<string, string>
  revealedKeys: Set<string>
  saving: string | null
  onEdit: (key: string, value: string) => void
  onToggleReveal: (key: string) => void
  onSave: (key: string) => void
  onDelete: (key: string) => void
}) {
  return (
    <Card className="bg-[#0a0a0b] border-white/10">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Icon className="w-5 h-5 text-[#D4AF37]" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {settings.length === 0 ? (
          <EmptyState text={`No ${title.toLowerCase()} configured`} />
        ) : (
          <div className="space-y-4">
            {settings.map(setting => (
              <SettingRow
                key={setting.key}
                setting={setting}
                editedValue={editedValues[setting.key] || ''}
                isRevealed={revealedKeys.has(setting.key)}
                isSaving={saving === setting.key}
                onEdit={(value) => onEdit(setting.key, value)}
                onToggleReveal={() => onToggleReveal(setting.key)}
                onSave={() => onSave(setting.key)}
                onDelete={() => onDelete(setting.key)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Setting Row Component
function SettingRow({
  setting,
  editedValue,
  isRevealed,
  isSaving,
  onEdit,
  onToggleReveal,
  onSave,
  onDelete,
}: {
  setting: AppSetting
  editedValue: string
  isRevealed: boolean
  isSaving: boolean
  onEdit: (value: string) => void
  onToggleReveal: () => void
  onSave: () => void
  onDelete: () => void
}) {
  const config = SETTING_CONFIG[setting.key]
  const isSensitive = config?.sensitive || setting.is_masked

  const displayValue = setting.is_masked && !isRevealed
    ? '••••••••••••'
    : editedValue || setting.value || ''

  const hasChanges = isRevealed && editedValue !== setting.value

  return (
    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Label & Description */}
        <div className="lg:w-1/3">
          <p className="font-medium text-white">{config?.label || setting.key}</p>
          <p className="text-xs text-white/40 mt-0.5">
            {config?.description || setting.description || setting.key}
          </p>
        </div>

        {/* Input */}
        <div className="flex-1 flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type={isSensitive && !isRevealed ? 'password' : 'text'}
              value={displayValue}
              onChange={(e) => onEdit(e.target.value)}
              disabled={setting.is_masked && !isRevealed}
              placeholder={config?.placeholder || 'Not set'}
              className={cn(
                'w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-[#D4AF37] focus:outline-none font-mono text-sm',
                setting.is_masked && !isRevealed && 'text-white/60'
              )}
            />
          </div>

          {/* Reveal Button */}
          {isSensitive && (
            <button
              onClick={onToggleReveal}
              className="p-2 text-white/40 hover:text-white transition-colors"
              title={isRevealed ? 'Hide' : 'Reveal'}
            >
              {isRevealed ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          )}

          {/* Save Button */}
          <Button
            onClick={onSave}
            disabled={isSaving || (!isRevealed && setting.is_masked)}
            size="sm"
            className={cn(
              'bg-[#D4AF37] hover:bg-[#B8962E] text-black',
              hasChanges && 'ring-2 ring-[#D4AF37]'
            )}
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          </Button>

          {/* Delete Button */}
          <Button
            onClick={onDelete}
            disabled={isSaving}
            size="sm"
            variant="outline"
            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// Empty State Component
function EmptyState({ text, onAdd }: { text: string; onAdd?: () => void }) {
  return (
    <div className="text-center py-8">
      <Settings className="w-10 h-10 mx-auto mb-3 text-white/20" />
      <p className="text-white/40">{text}</p>
      {onAdd && (
        <Button
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="mt-3 border-white/20 text-white hover:bg-white/5"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      )}
    </div>
  )
}
