'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, PlugZap, RefreshCcw, Save, SendHorizonal, Shield, Eye, EyeOff } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'

type DeliveryMethod = 'bot' | 'webhook'
type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'reconnecting'

interface DiscordConfigResponse {
  id: string | null
  botTokenSet: boolean
  botEnabled: boolean
  guildIds: string[]
  alertChannelId: string | null
  alertChannelName: string | null
  deliveryMethod: DeliveryMethod
  webhookUrl: string | null
  connectionStatus: ConnectionStatus
  lastConnectedAt: string | null
  lastError: string | null
  configuredBy: string | null
  updatedAt: string | null
}

interface DiscordGuild {
  id: string
  name: string
}

interface DiscordChannel {
  id: string
  name: string
  type: number
  position: number
}

const DEFAULT_CONFIG: DiscordConfigResponse = {
  id: null,
  botTokenSet: false,
  botEnabled: false,
  guildIds: [],
  alertChannelId: null,
  alertChannelName: null,
  deliveryMethod: 'bot',
  webhookUrl: null,
  connectionStatus: 'disconnected',
  lastConnectedAt: null,
  lastError: null,
  configuredBy: null,
  updatedAt: null,
}

function statusBadgeVariant(status: ConnectionStatus): string {
  if (status === 'connected') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
  if (status === 'reconnecting') return 'bg-amber-500/20 text-amber-300 border-amber-500/40'
  if (status === 'error') return 'bg-red-500/20 text-red-300 border-red-500/40'
  return 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40'
}

export function DiscordSettingsPanel() {
  const [config, setConfig] = useState<DiscordConfigResponse>(DEFAULT_CONFIG)
  const [botTokenInput, setBotTokenInput] = useState('')
  const [clearBotToken, setClearBotToken] = useState(false)
  const [showBotToken, setShowBotToken] = useState(false)

  const [guilds, setGuilds] = useState<DiscordGuild[]>([])
  const [channels, setChannels] = useState<DiscordChannel[]>([])

  const [selectedGuildId, setSelectedGuildId] = useState('')
  const [selectedChannelId, setSelectedChannelId] = useState('')
  const [botEnabled, setBotEnabled] = useState(false)
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('bot')
  const [webhookUrl, setWebhookUrl] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [loadingGuilds, setLoadingGuilds] = useState(false)
  const [loadingChannels, setLoadingChannels] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selectedChannelName = useMemo(
    () => channels.find((channel) => channel.id === selectedChannelId)?.name ?? null,
    [channels, selectedChannelId],
  )

  const loadConfig = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/alerts/discord/config', { cache: 'no-store' })
      const payload = await response.json()

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to load Discord config')
      }

      const nextConfig = payload.config as DiscordConfigResponse
      setConfig(nextConfig)
      setSelectedGuildId(nextConfig.guildIds[0] ?? '')
      setSelectedChannelId(nextConfig.alertChannelId ?? '')
      setBotEnabled(nextConfig.botEnabled)
      setDeliveryMethod(nextConfig.deliveryMethod)
      setWebhookUrl(nextConfig.webhookUrl ?? '')
      setClearBotToken(false)
      setBotTokenInput('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load Discord config')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadGuilds = useCallback(async () => {
    setLoadingGuilds(true)
    try {
      const response = await fetch('/api/admin/alerts/discord/guilds', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to fetch guilds')
      }

      const nextGuilds: DiscordGuild[] = Array.isArray(payload.guilds) ? payload.guilds : []
      setGuilds(nextGuilds)
      if (nextGuilds.length > 0 && !selectedGuildId) {
        setSelectedGuildId(nextGuilds[0].id)
      }
    } catch (guildError) {
      setError(guildError instanceof Error ? guildError.message : 'Failed to fetch guilds')
      setGuilds([])
    } finally {
      setLoadingGuilds(false)
    }
  }, [selectedGuildId])

  const loadChannels = useCallback(async (guildId: string) => {
    if (!guildId) {
      setChannels([])
      return
    }

    setLoadingChannels(true)
    try {
      const response = await fetch(`/api/admin/alerts/discord/channels?guildId=${encodeURIComponent(guildId)}`, {
        cache: 'no-store',
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Failed to fetch channels')
      }

      const nextChannels: DiscordChannel[] = Array.isArray(payload.channels) ? payload.channels : []
      setChannels(nextChannels)
      if (nextChannels.length > 0 && !nextChannels.some((channel) => channel.id === selectedChannelId)) {
        setSelectedChannelId(nextChannels[0].id)
      }
    } catch (channelError) {
      setError(channelError instanceof Error ? channelError.message : 'Failed to fetch channels')
      setChannels([])
    } finally {
      setLoadingChannels(false)
    }
  }, [selectedChannelId])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  useEffect(() => {
    if (config.botTokenSet) {
      void loadGuilds()
    }
  }, [config.botTokenSet, loadGuilds])

  useEffect(() => {
    if (selectedGuildId) {
      void loadChannels(selectedGuildId)
    }
  }, [selectedGuildId, loadChannels])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const payload: Record<string, unknown> = {
        botEnabled,
        guildIds: selectedGuildId ? [selectedGuildId] : [],
        alertChannelId: selectedChannelId || null,
        alertChannelName: selectedChannelName,
        deliveryMethod,
        webhookUrl: deliveryMethod === 'webhook' ? (webhookUrl.trim() || null) : null,
      }

      if (botTokenInput.trim().length > 0) {
        payload.botToken = botTokenInput.trim()
      }
      if (clearBotToken) {
        payload.clearBotToken = true
      }

      const response = await fetch('/api/admin/alerts/discord/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to save Discord config')
      }

      const saved = data.config as DiscordConfigResponse
      setConfig(saved)
      setBotEnabled(saved.botEnabled)
      setDeliveryMethod(saved.deliveryMethod)
      setWebhookUrl(saved.webhookUrl ?? '')
      setClearBotToken(false)
      setBotTokenInput('')
      setSuccess('Discord configuration saved.')
      await loadGuilds()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save Discord config')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/alerts/discord/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: selectedChannelId || undefined,
        }),
      })
      const payload = await response.json()

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Test connection failed')
      }

      setConfig(payload.config as DiscordConfigResponse)
      setSuccess('Test message sent to Discord successfully.')
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : 'Test connection failed')
    } finally {
      setTesting(false)
    }
  }

  const handleRestart = async () => {
    setRestarting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/alerts/discord/restart', {
        method: 'POST',
      })
      const payload = await response.json()

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'Reconnect failed')
      }

      setConfig(payload.config as DiscordConfigResponse)
      setSuccess('Discord connection refreshed.')
    } catch (restartError) {
      setError(restartError instanceof Error ? restartError.message : 'Reconnect failed')
    } finally {
      setRestarting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-white/5">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-white">
              <Shield className="h-4 w-4 text-emerald-400" />
              Discord Connection
            </CardTitle>
            <Badge className={statusBadgeVariant(config.connectionStatus)}>
              {config.connectionStatus.toUpperCase()}
            </Badge>
          </div>
          <CardDescription className="text-white/60">
            Configure bot credentials, guild/channel targets, and delivery behavior for alert publishing.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{error}</span>
            </div>
          ) : null}

          {success ? (
            <div className="flex items-start gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4" />
              <span>{success}</span>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-white/60">Bot Token</span>
              <div className="relative">
                <Input
                  type={showBotToken ? 'text' : 'password'}
                  value={botTokenInput}
                  onChange={(event) => setBotTokenInput(event.target.value)}
                  placeholder={config.botTokenSet ? 'Token already set (enter to replace)' : 'Paste Discord bot token'}
                  className="pr-20"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/50 hover:text-white"
                  onClick={() => setShowBotToken((current) => !current)}
                >
                  {showBotToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={clearBotToken} onCheckedChange={setClearBotToken} />
                <span className="text-xs text-white/60">Clear stored token on save</span>
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-white/60">Bot Enabled</span>
              <div className="flex min-h-12 items-center justify-between rounded-md border border-white/10 bg-white/5 px-3">
                <span className="text-sm text-white/80">Allow backend bot delivery</span>
                <Switch checked={botEnabled} onCheckedChange={setBotEnabled} />
              </div>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-white/60">Guild</span>
              <Select value={selectedGuildId} onValueChange={setSelectedGuildId}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingGuilds ? 'Loading guilds...' : 'Select guild'} />
                </SelectTrigger>
                <SelectContent>
                  {guilds.map((guild) => (
                    <SelectItem key={guild.id} value={guild.id}>
                      {guild.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-white/60">Alert Channel</span>
              <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingChannels ? 'Loading channels...' : 'Select channel'} />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      #{channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-wide text-white/60">Delivery Method</span>
              <Select value={deliveryMethod} onValueChange={(value) => setDeliveryMethod(value as DeliveryMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bot">Bot (recommended)</SelectItem>
                  <SelectItem value="webhook">Webhook fallback</SelectItem>
                </SelectContent>
              </Select>
            </label>

            {deliveryMethod === 'webhook' ? (
              <label className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide text-white/60">Webhook URL</span>
                <Input
                  type="url"
                  value={webhookUrl}
                  onChange={(event) => setWebhookUrl(event.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                />
              </label>
            ) : (
              <div className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide text-white/60">Delivery Note</span>
                <div className="flex min-h-12 items-center rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white/60">
                  Bot delivery uses authenticated `channel.send()` at runtime.
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSave} disabled={saving} className="min-w-32">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
              Test Connection
            </Button>
            <Button variant="outline" onClick={handleRestart} disabled={restarting}>
              {restarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Reconnect
            </Button>
            <Button variant="ghost" onClick={loadConfig}>
              <PlugZap className="h-4 w-4" />
              Refresh State
            </Button>
          </div>

          {config.lastError ? (
            <p className="text-xs text-red-300/90">Last error: {config.lastError}</p>
          ) : null}
          {config.lastConnectedAt ? (
            <p className="text-xs text-white/50">Last connected: {new Date(config.lastConnectedAt).toLocaleString()}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
