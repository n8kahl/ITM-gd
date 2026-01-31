'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Users,
  UserPlus,
  Trash2,
  X,
  Circle,
  Shield,
  User,
  Clock,
  Phone,
  Save,
  Webhook,
  Send
} from 'lucide-react'

interface TeamMember {
  id: string
  display_name: string
  avatar_url: string | null
  role: string
  status: string
  last_seen_at: string
  created_at: string
  phone_number: string | null
}

export default function TeamMembersPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isInviting, setIsInviting] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    email: '',
    displayName: '',
    password: '',
    role: 'agent' as 'admin' | 'agent',
    phoneNumber: ''
  })
  const [zapierWebhook, setZapierWebhook] = useState('')
  const [savingWebhook, setSavingWebhook] = useState(false)
  const [testingWebhook, setTestingWebhook] = useState(false)
  const [webhookStatus, setWebhookStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [inviteStatus, setInviteStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [stats, setStats] = useState({
    total: 0,
    online: 0,
    admins: 0,
    agents: 0
  })

  useEffect(() => {
    loadMembers()
    loadSettings()

    // Subscribe to changes
    const channel = supabase
      .channel('team-members-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_members'
      }, () => {
        loadMembers()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function loadSettings() {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'zapier_webhook_url')
      .single()

    if (data?.value) {
      setZapierWebhook(data.value)
    }
  }

  async function saveWebhook() {
    setSavingWebhook(true)
    setWebhookStatus(null)

    const { error } = await supabase
      .from('app_settings')
      .upsert({
        key: 'zapier_webhook_url',
        value: zapierWebhook,
        updated_at: new Date().toISOString()
      })

    if (error) {
      setWebhookStatus({ type: 'error', message: 'Failed to save webhook URL' })
    } else {
      setWebhookStatus({ type: 'success', message: 'Webhook URL saved!' })
      setTimeout(() => setWebhookStatus(null), 3000)
    }

    setSavingWebhook(false)
  }

  async function updatePhone(id: string, phone: string) {
    await supabase
      .from('team_members')
      .update({ phone_number: phone || null })
      .eq('id', id)

    loadMembers()
  }

  async function testWebhook() {
    if (!zapierWebhook) {
      setWebhookStatus({ type: 'error', message: 'Please enter a webhook URL first' })
      return
    }

    setTestingWebhook(true)
    setWebhookStatus(null)

    try {
      // Call the send-push-notification function with test data
      const functionUrl = process.env.NEXT_PUBLIC_SUPABASE_URL + '/functions/v1/send-push-notification'

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          conversationId: 'test-' + Date.now(),
          reason: 'Test notification from TradeITM admin',
          leadScore: 8,
          visitorName: 'Test Visitor',
          visitorId: 'test-visitor',
          isNewConversation: false
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setWebhookStatus({ type: 'success', message: `Test sent! Check Zapier for the webhook.` })
      } else {
        setWebhookStatus({ type: 'error', message: result.error || result.message || 'Test failed' })
      }
    } catch (error: any) {
      setWebhookStatus({ type: 'error', message: error.message || 'Failed to send test' })
    }

    setTestingWebhook(false)
  }

  async function loadMembers() {
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) {
      setMembers(data)

      setStats({
        total: data.length,
        online: data.filter(m => m.status === 'online').length,
        admins: data.filter(m => m.role === 'admin').length,
        agents: data.filter(m => m.role === 'agent').length
      })
    }
  }

  async function inviteMember() {
    try {
      setInviteStatus(null)
      setIsSubmitting(true)

      // Validate form
      if (!inviteForm.email || !inviteForm.password) {
        setInviteStatus({
          type: 'error',
          message: 'Email and password are required'
        })
        return
      }

      if (inviteForm.password.length < 6) {
        setInviteStatus({
          type: 'error',
          message: 'Password must be at least 6 characters'
        })
        return
      }

      // Call Edge Function to create auth user and team member
      const functionUrl = process.env.NEXT_PUBLIC_SUPABASE_URL + '/functions/v1/create-team-member'

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          email: inviteForm.email,
          password: inviteForm.password,
          displayName: inviteForm.displayName || inviteForm.email.split('@')[0],
          role: inviteForm.role,
          phoneNumber: inviteForm.phoneNumber || null
        })
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        setInviteStatus({
          type: 'error',
          message: result.error || 'Failed to create team member'
        })
      } else {
        setInviteStatus({
          type: 'success',
          message: `Successfully added ${inviteForm.displayName || inviteForm.email} to the team! They can now log in with their email and password.`
        })
        setIsInviting(false)
        setInviteForm({ email: '', displayName: '', password: '', role: 'agent', phoneNumber: '' })
        loadMembers()
      }
    } catch (error: any) {
      setInviteStatus({
        type: 'error',
        message: error.message || 'An error occurred'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function updateStatus(id: string, status: string) {
    await supabase
      .from('team_members')
      .update({
        status,
        last_seen_at: new Date().toISOString()
      })
      .eq('id', id)

    loadMembers()
  }

  async function updateRole(id: string, role: string) {
    await supabase
      .from('team_members')
      .update({ role })
      .eq('id', id)

    loadMembers()
  }

  async function deleteMember(id: string, displayName: string) {
    if (!confirm(`Are you sure you want to remove ${displayName} from the team? This will not delete their auth account.`)) return

    await supabase
      .from('team_members')
      .delete()
      .eq('id', id)

    loadMembers()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gradient-champagne mb-2">
            Team Members
          </h1>
          <p className="text-platinum/60">
            Manage chat agents and administrators
          </p>
        </div>
        <Button onClick={() => setIsInviting(true)} className="bg-gradient-to-r from-emerald-500 to-emerald-600">
          <UserPlus className="w-4 h-4 mr-2" />
          Add Team Member
        </Button>
      </div>

      {/* Invite Modal */}
      {isInviting && (
        <Card className="glass-card-heavy border-emerald-500/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                Add New Team Member
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => {
                setIsInviting(false)
                setInviteStatus(null)
              }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {inviteStatus && (
              <div className={`p-3 rounded-lg border ${
                inviteStatus.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
                {inviteStatus.message}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-sm text-platinum/60 block mb-1">Email Address *</label>
                <Input
                  type="email"
                  placeholder="member@example.com"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="bg-background/50 border-border/40"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="text-sm text-platinum/60 block mb-1">Password *</label>
                <Input
                  type="password"
                  placeholder="Min 6 characters"
                  value={inviteForm.password}
                  onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                  className="bg-background/50 border-border/40"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="text-sm text-platinum/60 block mb-1">Display Name</label>
                <Input
                  type="text"
                  placeholder="John Doe"
                  value={inviteForm.displayName}
                  onChange={(e) => setInviteForm({ ...inviteForm, displayName: e.target.value })}
                  className="bg-background/50 border-border/40"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="text-sm text-platinum/60 block mb-1">
                  <Phone className="w-3 h-3 inline mr-1" />
                  Phone Number (for SMS alerts)
                </label>
                <Input
                  type="tel"
                  placeholder="+1 555 123 4567"
                  value={inviteForm.phoneNumber}
                  onChange={(e) => setInviteForm({ ...inviteForm, phoneNumber: e.target.value })}
                  className="bg-background/50 border-border/40"
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <label className="text-sm text-platinum/60 block mb-1">Role</label>
                <div className="flex gap-2">
                  <Button
                    variant={inviteForm.role === 'agent' ? 'default' : 'outline'}
                    onClick={() => setInviteForm({ ...inviteForm, role: 'agent' })}
                    className="flex-1"
                    disabled={isSubmitting}
                  >
                    <User className="w-4 h-4 mr-2" />
                    Agent
                  </Button>
                  <Button
                    variant={inviteForm.role === 'admin' ? 'default' : 'outline'}
                    onClick={() => setInviteForm({ ...inviteForm, role: 'admin' })}
                    className="flex-1"
                    disabled={isSubmitting}
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Admin
                  </Button>
                </div>
              </div>
            </div>

            <Button
              onClick={inviteMember}
              disabled={!inviteForm.email || !inviteForm.password || isSubmitting}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Team Member
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card-heavy">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-platinum/60">
              Total Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-ivory">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="glass-card-heavy">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-platinum/60 flex items-center gap-1">
              <Circle className="w-3 h-3 fill-emerald-500 text-emerald-500" />
              Online
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{stats.online}</div>
          </CardContent>
        </Card>

        <Card className="glass-card-heavy">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-platinum/60 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Admins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-champagne">{stats.admins}</div>
          </CardContent>
        </Card>

        <Card className="glass-card-heavy">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-platinum/60 flex items-center gap-1">
              <User className="w-3 h-3" />
              Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">{stats.agents}</div>
          </CardContent>
        </Card>
      </div>

      {/* SMS Notification Settings */}
      <Card className="glass-card-heavy border-champagne/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Webhook className="w-5 h-5 text-champagne" />
            SMS Notifications (Zapier)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-platinum/60">
            Enter your Zapier webhook URL to receive SMS alerts for new chats and escalations.
            Team members with phone numbers will be included in the notification payload.
          </p>
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              value={zapierWebhook}
              onChange={(e) => setZapierWebhook(e.target.value)}
              className="bg-background/50 border-border/40 flex-1"
            />
            <Button
              onClick={saveWebhook}
              disabled={savingWebhook}
              className="bg-gradient-to-r from-champagne to-champagne/80"
            >
              {savingWebhook ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </>
              )}
            </Button>
            <Button
              onClick={testWebhook}
              disabled={testingWebhook || !zapierWebhook}
              variant="outline"
              className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10"
            >
              {testingWebhook ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Test
                </>
              )}
            </Button>
          </div>
          {webhookStatus && (
            <div className={`text-sm ${
              webhookStatus.type === 'success' ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {webhookStatus.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Members List */}
      <div className="space-y-4">
        {members.map(member => (
          <Card key={member.id} className="glass-card-heavy">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                {/* Member Info */}
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-champagne-500 flex items-center justify-center text-white font-bold">
                    {member.display_name.charAt(0).toUpperCase()}
                  </div>

                  {/* Details */}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-ivory">
                        {member.display_name}
                      </h3>

                      {/* Status Badge */}
                      <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${
                        member.status === 'online'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : member.status === 'away'
                          ? 'bg-yellow-500/10 text-yellow-400'
                          : 'bg-platinum/10 text-platinum/60'
                      }`}>
                        <Circle className={`w-2 h-2 ${
                          member.status === 'online' ? 'fill-emerald-500' : ''
                        }`} />
                        {member.status}
                      </span>

                      {/* Role Badge */}
                      <span className={`text-xs px-2 py-1 rounded ${
                        member.role === 'admin'
                          ? 'bg-champagne/10 text-champagne'
                          : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {member.role === 'admin' ? '👑 Admin' : '👤 Agent'}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-1 text-xs text-platinum/40">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Last seen: {new Date(member.last_seen_at).toLocaleString()}
                      </span>
                      <span>
                        Joined: {new Date(member.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Phone className="w-3 h-3 text-platinum/40" />
                      <Input
                        type="tel"
                        placeholder="Add phone for SMS alerts"
                        defaultValue={member.phone_number || ''}
                        onBlur={(e) => {
                          if (e.target.value !== (member.phone_number || '')) {
                            updatePhone(member.id, e.target.value)
                          }
                        }}
                        className="h-7 text-xs bg-background/30 border-border/30 w-48"
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {/* Status Buttons */}
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={member.status === 'online' ? 'default' : 'outline'}
                      onClick={() => updateStatus(member.id, 'online')}
                      className="text-xs"
                    >
                      Online
                    </Button>
                    <Button
                      size="sm"
                      variant={member.status === 'away' ? 'default' : 'outline'}
                      onClick={() => updateStatus(member.id, 'away')}
                      className="text-xs"
                    >
                      Away
                    </Button>
                    <Button
                      size="sm"
                      variant={member.status === 'offline' ? 'default' : 'outline'}
                      onClick={() => updateStatus(member.id, 'offline')}
                      className="text-xs"
                    >
                      Offline
                    </Button>
                  </div>

                  {/* Role Toggle */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateRole(member.id, member.role === 'admin' ? 'agent' : 'admin')}
                    className="text-xs"
                  >
                    {member.role === 'admin' ? 'Make Agent' : 'Make Admin'}
                  </Button>

                  {/* Delete */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteMember(member.id, member.display_name)}
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {members.length === 0 && (
          <Card className="glass-card-heavy">
            <CardContent className="p-8 text-center">
              <Users className="w-16 h-16 text-platinum/20 mx-auto mb-4" />
              <p className="text-platinum/60 mb-4">
                No team members yet. Click "Add Team Member" to invite your first member.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Activity Log */}
      <Card className="glass-card-heavy">
        <CardHeader>
          <CardTitle className="text-sm">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-platinum/60">
            {members
              .sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime())
              .slice(0, 5)
              .map(member => (
                <div key={member.id} className="flex items-center justify-between py-2 border-b border-border/20">
                  <span>{member.display_name}</span>
                  <span className="text-xs text-platinum/40">
                    {new Date(member.last_seen_at).toLocaleString()}
                  </span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
