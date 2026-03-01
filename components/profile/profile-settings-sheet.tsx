'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Loader2, Settings, CheckCircle2, Bell } from 'lucide-react'
import { PrivacyToggle } from '@/components/profile/privacy-toggle'
import type {
  MemberProfile,
  PrivacySettings,
  NotificationPreferences,
  AIPreferences,
  ProfileVisibility,
} from '@/lib/types/social'
import {
  DEFAULT_PRIVACY_SETTINGS,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_AI_PREFERENCES,
} from '@/lib/types/social'
import {
  checkPushSubscription,
  getNotificationPermission,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/notifications'
import { isIOS, isStandaloneMode } from '@/lib/pwa-utils'

// ============================================
// TYPES
// ============================================

interface ProfileSettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: MemberProfile | null
  onSave: (updates: Record<string, unknown>) => Promise<void>
}

// ============================================
// COMPONENT
// ============================================

export function ProfileSettingsSheet({
  open,
  onOpenChange,
  profile,
  onSave,
}: ProfileSettingsSheetProps) {
  // Local state for settings
  const [privacy, setPrivacy] = useState<PrivacySettings>(DEFAULT_PRIVACY_SETTINGS)
  const [notifications, setNotifications] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  )
  const [aiPrefs, setAiPrefs] = useState<AIPreferences>(DEFAULT_AI_PREFERENCES)
  const [saving, setSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')
  const [pushError, setPushError] = useState<string | null>(null)
  const [isIOSDevice, setIsIOSDevice] = useState(false)
  const [isStandalonePwa, setIsStandalonePwa] = useState(false)

  // Sync local state from profile when dialog opens
  useEffect(() => {
    if (profile && open) {
      setPrivacy(profile.privacy_settings ?? DEFAULT_PRIVACY_SETTINGS)
      setNotifications(
        profile.notification_preferences ?? DEFAULT_NOTIFICATION_PREFERENCES
      )
      setAiPrefs(profile.ai_preferences ?? DEFAULT_AI_PREFERENCES)
      setShowSuccess(false)
    }
  }, [profile, open])

  const syncPushState = useCallback(async () => {
    if (typeof window === 'undefined') return

    const [supported, permission, subscribed] = await Promise.all([
      isPushSupported(),
      getNotificationPermission(),
      checkPushSubscription(),
    ])

    setPushSupported(supported)
    setPushPermission(permission)
    setPushSubscribed(supported ? subscribed : false)
    setIsIOSDevice(isIOS())
    setIsStandalonePwa(isStandaloneMode())
    setPushError(null)
  }, [])

  useEffect(() => {
    if (!open) return
    void syncPushState()
  }, [open, syncPushState])

  const handleSave = async () => {
    setSaving(true)
    setShowSuccess(false)
    try {
      await onSave({
        privacy_settings: privacy,
        notification_preferences: notifications,
        ai_preferences: aiPrefs,
      })
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    } catch {
      // Error handling is delegated to the parent onSave callback
    } finally {
      setSaving(false)
    }
  }

  const updatePrivacy = (key: keyof PrivacySettings, value: boolean | ProfileVisibility) => {
    setPrivacy((prev) => ({ ...prev, [key]: value }))
  }

  const updateNotifications = (key: keyof NotificationPreferences, value: boolean) => {
    setNotifications((prev) => ({ ...prev, [key]: value }))
  }

  const updateAiPrefs = (
    key: keyof AIPreferences,
    value: string | string[]
  ) => {
    setAiPrefs((prev) => ({ ...prev, [key]: value }))
  }

  const handlePushToggle = async (enabled: boolean) => {
    if (pushBusy) return

    setPushBusy(true)
    setPushError(null)
    try {
      const success = enabled
        ? await subscribeToPush()
        : await unsubscribeFromPush()

      if (!success) {
        const permission = await getNotificationPermission()
        setPushPermission(permission)

        if (permission === 'denied') {
          setPushError('Notifications are blocked in browser settings. Enable permissions and try again.')
        } else if (isIOSDevice && !isStandalonePwa) {
          setPushError('Install TradeITM to your Home Screen to enable iOS push notifications.')
        } else {
          setPushError(enabled
            ? 'Could not enable push notifications. Please try again.'
            : 'Could not disable push notifications. Please try again.')
        }
      }

      await syncPushState()
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="settings-sheet"
        className={cn(
          'glass-card-heavy border-white/[0.08] bg-[#0A0A0B]/95',
          'max-w-lg max-h-[85vh] overflow-y-auto'
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#F5F5F0]">
            <Settings className="w-5 h-5 text-emerald-400" />
            Profile Settings
          </DialogTitle>
          <DialogDescription className="text-[#9A9A9A]">
            Manage your privacy, notification, and AI preferences
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ============================================ */}
          {/* PRIVACY SETTINGS */}
          {/* ============================================ */}
          <section>
            <h3 className="text-sm font-semibold text-[#F5F5F0] mb-3 uppercase tracking-wider">
              Privacy
            </h3>
            <div className="space-y-2">
              <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                <label className="text-sm font-medium text-[#F5F5F0] block mb-2">
                  Profile Visibility
                </label>
                <div className="flex gap-2">
                  {([
                    { value: 'public', label: 'Public' },
                    { value: 'members', label: 'Members' },
                    { value: 'private', label: 'Private' },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updatePrivacy('profile_visibility', option.value)}
                      className={cn(
                        'flex-1 text-xs py-2 px-3 rounded-md border transition-colors',
                        privacy.profile_visibility === option.value
                          ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                          : 'border-white/5 text-[#9A9A9A] hover:border-white/10 hover:text-[#F5F5F0]'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div data-testid="privacy-transcript-toggle">
                <PrivacyToggle
                  label="Show Trading Transcript"
                  description="Allow other members to see your verified trading stats"
                  checked={privacy.show_transcript}
                  onCheckedChange={(v) => updatePrivacy('show_transcript', v)}
                />
              </div>
              <PrivacyToggle
                label="Show Academy Progress"
                description="Display your academy rank and XP on your profile"
                checked={privacy.show_academy}
                onCheckedChange={(v) => updatePrivacy('show_academy', v)}
              />
              <PrivacyToggle
                label="Show Trades in Feed"
                description="Automatically post trade cards to the social feed"
                checked={privacy.show_trades_in_feed}
                onCheckedChange={(v) => updatePrivacy('show_trades_in_feed', v)}
              />
              <PrivacyToggle
                label="Show on Leaderboard"
                description="Include your stats in community leaderboards"
                checked={privacy.show_on_leaderboard}
                onCheckedChange={(v) => updatePrivacy('show_on_leaderboard', v)}
              />
              <PrivacyToggle
                label="Show Discord Roles"
                description="Display your Discord roles on your profile"
                checked={privacy.show_discord_roles}
                onCheckedChange={(v) => updatePrivacy('show_discord_roles', v)}
              />
            </div>
          </section>

          {/* ============================================ */}
          {/* NOTIFICATION PREFERENCES */}
          {/* ============================================ */}
          <section>
            <h3 className="text-sm font-semibold text-[#F5F5F0] mb-3 uppercase tracking-wider">
              Notifications
            </h3>
            <div className="space-y-2">
              <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3" data-testid="push-notifications-toggle">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#F5F5F0] flex items-center gap-2">
                      <Bell className="w-4 h-4 text-emerald-400 shrink-0" />
                      Push Notifications
                    </p>
                    <p className="text-xs text-[#9A9A9A] mt-0.5 leading-relaxed">
                      Enable browser push alerts for journal updates and important account events.
                    </p>
                    <p className="text-[11px] text-white/50 mt-1">
                      Status: {pushSubscribed ? 'Subscribed' : 'Not subscribed'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={pushSubscribed ? 'luxury-outline' : 'default'}
                    disabled={pushBusy || !pushSupported || (isIOSDevice && !isStandalonePwa)}
                    onClick={() => {
                      void handlePushToggle(!pushSubscribed)
                    }}
                    className="h-9 min-w-[92px]"
                  >
                    {pushBusy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : pushSubscribed ? (
                      'Disable'
                    ) : (
                      'Enable'
                    )}
                  </Button>
                </div>
                {!pushSupported && (
                  <p className="text-[11px] text-amber-300 mt-2">
                    Push notifications are not supported in this browser.
                  </p>
                )}
                {isIOSDevice && !isStandalonePwa && (
                  <p className="text-[11px] text-amber-300 mt-2">
                    iOS requires standalone mode for push. Install TradeITM to your Home Screen, then enable notifications.
                  </p>
                )}
                {pushPermission === 'denied' && (
                  <p className="text-[11px] text-red-300 mt-2">
                    Notification permission is denied. Allow notifications in browser settings to continue.
                  </p>
                )}
                {pushError && (
                  <p className="text-[11px] text-red-300 mt-2">{pushError}</p>
                )}
              </div>
              <PrivacyToggle
                label="Feed Likes"
                description="Get notified when someone likes your posts"
                checked={notifications.feed_likes}
                onCheckedChange={(v) => updateNotifications('feed_likes', v)}
              />
              <PrivacyToggle
                label="Feed Comments"
                description="Get notified when someone comments on your posts"
                checked={notifications.feed_comments}
                onCheckedChange={(v) => updateNotifications('feed_comments', v)}
              />
              <PrivacyToggle
                label="Leaderboard Changes"
                description="Get notified when your leaderboard position changes"
                checked={notifications.leaderboard_changes}
                onCheckedChange={(v) =>
                  updateNotifications('leaderboard_changes', v)
                }
              />
              <PrivacyToggle
                label="Achievement Earned"
                description="Get notified when you earn a new achievement"
                checked={notifications.achievement_earned}
                onCheckedChange={(v) =>
                  updateNotifications('achievement_earned', v)
                }
              />
              <PrivacyToggle
                label="Weekly Digest"
                description="Receive a weekly summary of your trading activity"
                checked={notifications.weekly_digest}
                onCheckedChange={(v) =>
                  updateNotifications('weekly_digest', v)
                }
              />
            </div>
          </section>

          {/* ============================================ */}
          {/* AI PREFERENCES */}
          {/* ============================================ */}
          <section>
            <h3 className="text-sm font-semibold text-[#F5F5F0] mb-3 uppercase tracking-wider">
              AI Coach Preferences
            </h3>
            <div className="space-y-3">
              {/* Risk Tolerance */}
              <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                <label className="text-sm font-medium text-[#F5F5F0] block mb-2">
                  Risk Tolerance
                </label>
                <div className="flex gap-2">
                  {(['conservative', 'moderate', 'aggressive'] as const).map(
                    (level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => updateAiPrefs('risk_tolerance', level)}
                        className={cn(
                          'flex-1 text-xs py-2 px-3 rounded-md border transition-colors capitalize',
                          aiPrefs.risk_tolerance === level
                            ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                            : 'border-white/5 text-[#9A9A9A] hover:border-white/10 hover:text-[#F5F5F0]'
                        )}
                      >
                        {level}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Account Size Range */}
              <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                <label className="text-sm font-medium text-[#F5F5F0] block mb-2">
                  Account Size Range
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Under $5k',
                    '$5k - $25k',
                    '$25k - $100k',
                    '$100k+',
                  ].map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() =>
                        updateAiPrefs('account_size_range', range)
                      }
                      className={cn(
                        'text-xs py-1.5 px-3 rounded-md border transition-colors',
                        aiPrefs.account_size_range === range
                          ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                          : 'border-white/5 text-[#9A9A9A] hover:border-white/10 hover:text-[#F5F5F0]'
                      )}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trading Style Notes */}
              <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
                <label className="text-sm font-medium text-[#F5F5F0] block mb-2">
                  Trading Style Notes
                </label>
                <textarea
                  value={aiPrefs.trading_style_notes}
                  onChange={(e) =>
                    updateAiPrefs('trading_style_notes', e.target.value)
                  }
                  placeholder="Describe your trading style for the AI coach..."
                  className="w-full text-sm bg-transparent border border-white/5 rounded-md px-3 py-2 text-[#F5F5F0] placeholder:text-[#9A9A9A]/50 focus:outline-none focus:border-emerald-500/30 resize-none"
                  rows={3}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Save Button + Success Toast */}
        <div className="pt-4 border-t border-white/5">
          {showSuccess && (
            <div
              data-testid="settings-success-toast"
              className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs text-emerald-400">
                Settings saved successfully
              </span>
            </div>
          )}
          <Button
            data-testid="save-settings"
            onClick={handleSave}
            disabled={saving}
            className="w-full gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
