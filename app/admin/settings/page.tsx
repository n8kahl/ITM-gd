'use client'

import { useEffect, useState } from 'react'
import {
  Settings,
  Save,
  Eye,
  EyeOff,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle,
  X,
  MessageSquare,
  TestTube2,
  Crown,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { testDiscordConnection } from '@/app/actions/test-discord'

interface DiscordConfig {
  discord_client_id: string
  discord_client_secret: string
  discord_bot_token: string
  discord_guild_id: string
  discord_invite_url: string
}

interface AppSetting {
  key: string
  value: string | null
  description: string | null
  created_at: string
  updated_at: string
}

const DISCORD_FIELDS = [
  {
    key: 'discord_client_id',
    label: 'Client ID',
    description: 'OAuth2 Client ID from Discord Developer Portal',
    sensitive: false,
    placeholder: '1234567890123456789',
  },
  {
    key: 'discord_client_secret',
    label: 'Client Secret',
    description: 'OAuth2 Client Secret for authentication',
    sensitive: true,
    placeholder: 'Your client secret...',
  },
  {
    key: 'discord_bot_token',
    label: 'Bot Token',
    description: 'Bot token for API access and role syncing',
    sensitive: true,
    placeholder: 'MTIzNDU2Nzg5MDEyMzQ1Njc4OQ...',
  },
  {
    key: 'discord_guild_id',
    label: 'Guild ID',
    description: 'Your Discord server ID',
    sensitive: false,
    placeholder: '1234567890123456789',
  },
  {
    key: 'discord_invite_url',
    label: 'Invite URL',
    description: 'Discord server invite link for new members',
    sensitive: false,
    placeholder: 'https://discord.gg/yourinvite',
  },
]

// Tier types
type MembershipTier = 'core' | 'pro' | 'executive'

export default function SettingsPage() {
  const [config, setConfig] = useState<DiscordConfig>({
    discord_client_id: '',
    discord_client_secret: '',
    discord_bot_token: '',
    discord_guild_id: '',
    discord_invite_url: '',
  })
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Tier mapping state
  const [tierMapping, setTierMapping] = useState<Record<string, MembershipTier>>({})
  const [newRoleId, setNewRoleId] = useState('')
  const [newTier, setNewTier] = useState<MembershipTier>('core')
  const [savingTiers, setSavingTiers] = useState(false)

  useEffect(() => {
    loadSettings()
    loadTierMapping()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/settings?reveal=true')
      const data = await response.json()

      if (data.success) {
        const newConfig: Partial<DiscordConfig> = {}
        data.data.forEach((setting: AppSetting) => {
          if (setting.key in config) {
            newConfig[setting.key as keyof DiscordConfig] = setting.value || ''
          }
        })
        setConfig(prev => ({ ...prev, ...newConfig }))
      } else {
        setError(data.error || 'Failed to load settings')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const loadTierMapping = async () => {
    try {
      const response = await fetch('/api/config/roles')
      const data = await response.json()
      if (data && typeof data === 'object') {
        setTierMapping(data)
      }
    } catch (err) {
      console.error('Failed to load tier mapping:', err)
    }
  }

  const saveTierMapping = async () => {
    setSavingTiers(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'role_tier_mapping',
          value: JSON.stringify(tierMapping),
        }),
      })

      if (response.ok) {
        setSuccess('Tier mapping saved successfully')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError('Failed to save tier mapping')
      }
    } catch (err) {
      setError('Failed to save tier mapping')
    } finally {
      setSavingTiers(false)
    }
  }

  const addTierMapping = () => {
    if (!newRoleId.trim()) {
      setError('Role ID is required')
      return
    }
    if (tierMapping[newRoleId.trim()]) {
      setError('This role ID is already mapped')
      return
    }
    setTierMapping(prev => ({
      ...prev,
      [newRoleId.trim()]: newTier,
    }))
    setNewRoleId('')
    setError(null)
  }

  const removeTierMapping = (roleId: string) => {
    setTierMapping(prev => {
      const next = { ...prev }
      delete next[roleId]
      return next
    })
  }

  const toggleReveal = (key: string) => {
    setRevealedFields(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const saveConfiguration = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // Save all Discord settings
      const promises = Object.entries(config).map(([key, value]) =>
        fetch('/api/admin/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value }),
        })
      )

      const results = await Promise.all(promises)
      const allSuccess = results.every(r => r.ok)

      if (allSuccess) {
        setSuccess('Configuration saved successfully')
        setTimeout(() => setSuccess(null), 3000)
        // Clear revealed fields after save
        setRevealedFields(new Set())
        // Reload to get masked values
        await loadSettings()
      } else {
        setError('Some settings failed to save')
      }
    } catch (err) {
      setError('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    if (!config.discord_bot_token || !config.discord_guild_id) {
      setError('Bot Token and Guild ID are required for testing')
      return
    }

    setTesting(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await testDiscordConnection(
        config.discord_bot_token,
        config.discord_guild_id
      )

      if (result.success) {
        setSuccess(`✅ Connected to ${result.name}`)
        setTimeout(() => setSuccess(null), 5000)
      } else {
        setError(`❌ Failed: ${result.error}`)
      }
    } catch (err) {
      setError('Failed to test connection')
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-white/60">Loading configuration...</p>
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
            <Settings className="w-8 h-8 text-emerald-500" />
            Discord Configuration
          </h1>
          <p className="text-white/60 mt-1">
            Configure your Discord integration settings
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => loadSettings()}
          className="border-white/20 text-white hover:bg-white/5"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
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
      <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-white mb-1">Security Notice</h3>
              <p className="text-sm text-white/60">
                Sensitive values are masked by default. Click the eye icon to reveal them.
                All settings are stored securely in your database.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Discord Integration Card */}
      <Card className="glass-card-heavy border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#5865F2]" />
            Discord Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {DISCORD_FIELDS.map(field => {
            const isRevealed = revealedFields.has(field.key)
            const value = config[field.key as keyof DiscordConfig]

            return (
              <div key={field.key} className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Label & Description */}
                  <div className="lg:w-1/3">
                    <p className="font-medium text-white">{field.label}</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {field.description}
                    </p>
                  </div>

                  {/* Input */}
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type={field.sensitive && !isRevealed ? 'password' : 'text'}
                      value={value}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))}
                      placeholder={field.placeholder}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none font-mono text-sm'
                      )}
                    />

                    {/* Reveal Button */}
                    {field.sensitive && (
                      <button
                        onClick={() => toggleReveal(field.key)}
                        className="p-2 text-white/40 hover:text-white transition-colors"
                        title={isRevealed ? 'Hide' : 'Show'}
                      >
                        {isRevealed ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={saveConfiguration}
              disabled={saving}
              className="flex-1 bg-emerald-500 hover:bg-[emerald-600] text-black font-medium h-12"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Configuration
                </>
              )}
            </Button>

            <Button
              onClick={testConnection}
              disabled={testing || !config.discord_bot_token || !config.discord_guild_id}
              variant="outline"
              className="flex-1 border-white/20 text-white hover:bg-white/5 h-12"
            >
              {testing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube2 className="w-4 h-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tier Mapping Card */}
      <Card className="glass-card-heavy border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Crown className="w-5 h-5 text-emerald-500" />
            Membership Tier Mapping
          </CardTitle>
          <p className="text-sm text-white/60">
            Map Discord role IDs to membership tiers. Copy role IDs from Discord (Developer Mode → Right-click role → Copy ID).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing Mappings */}
          {Object.keys(tierMapping).length === 0 ? (
            <div className="p-6 rounded-lg bg-white/5 border border-white/10 text-center">
              <Crown className="w-10 h-10 text-white/20 mx-auto mb-2" />
              <p className="text-white/40 text-sm">No tier mappings configured</p>
              <p className="text-white/30 text-xs mt-1">Add mappings below to enable tier-based access</p>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(tierMapping).map(([roleId, tier]) => (
                <div
                  key={roleId}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                >
                  <div className="flex items-center gap-4">
                    <code className="text-sm text-white/80 font-mono bg-white/5 px-2 py-1 rounded">
                      {roleId}
                    </code>
                    <span className="text-white/40">→</span>
                    <span className={cn(
                      'px-3 py-1 rounded-full text-sm font-medium capitalize',
                      tier === 'executive' && 'bg-emerald-500/20 text-emerald-500',
                      tier === 'pro' && 'bg-blue-500/20 text-blue-400',
                      tier === 'core' && 'bg-emerald-500/20 text-emerald-400'
                    )}>
                      {tier}
                    </span>
                  </div>
                  <button
                    onClick={() => removeTierMapping(roleId)}
                    className="p-2 text-white/40 hover:text-red-400 transition-colors"
                    title="Remove mapping"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add New Mapping */}
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <h4 className="text-sm font-medium text-white mb-3">Add New Mapping</h4>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newRoleId}
                onChange={(e) => setNewRoleId(e.target.value)}
                placeholder="Discord Role ID (e.g., 1234567890123456789)"
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-emerald-500 focus:outline-none font-mono text-sm"
              />
              <select
                value={newTier}
                onChange={(e) => setNewTier(e.target.value as MembershipTier)}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="core" className="bg-[#0a0a0b]">Core</option>
                <option value="pro" className="bg-[#0a0a0b]">Pro</option>
                <option value="executive" className="bg-[#0a0a0b]">Executive</option>
              </select>
              <Button
                onClick={addTierMapping}
                variant="outline"
                className="border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>
          </div>

          {/* Save Tier Mapping */}
          <Button
            onClick={saveTierMapping}
            disabled={savingTiers}
            className="w-full bg-emerald-500 hover:bg-[emerald-600] text-black font-medium h-12"
          >
            {savingTiers ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Tier Mapping
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="glass-card-heavy border-emerald-500/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-2">How Tier-Based Access Works</h3>
              <ul className="text-sm text-white/60 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  <span><strong>Core Tier:</strong> Access to Dashboard, Journal, and Profile</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  <span><strong>Pro Tier:</strong> Core + Library access</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  <span><strong>Executive Tier:</strong> All features unlocked</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  <span>Members automatically inherit access from their Discord roles</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
