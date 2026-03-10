import { DiscordSettingsPanel } from '@/components/admin/alerts/settings/discord-settings-panel'

export default function AlertSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Alert Console Settings</h1>
        <p className="text-sm text-white/60">
          Manage Discord bot connectivity for admin alert publishing.
        </p>
      </div>
      <DiscordSettingsPanel />
    </div>
  )
}
