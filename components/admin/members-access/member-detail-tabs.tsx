'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Shield,
  UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type {
  DetailData,
  RoleMutationResponse,
  TradeBrowseEntry,
} from './members-access-types'
import {
  formatDate,
  warningClass,
} from './members-access-types'
import { MemberTradesPanel } from './member-trades-panel'
import { MemberOverridesTab } from './member-overrides-tab'

type MemberDetailTabsProps = {
  detail: DetailData
  actionMessage: string | null
  actionError: string | null
  // Override handlers
  onCreateOverride: (overrideType: string, reason: string, tabs: string, expiresAt: string) => Promise<void>
  onRevokeOverride: (overrideId: string) => Promise<void>
  savingOverride: boolean
  // Role mutation handlers
  onPreviewRoleMutation: (operation: 'add' | 'remove', roleId: string) => Promise<void>
  onApplyRoleMutation: (operation: 'add' | 'remove', roleId: string, reason: string) => Promise<void>
  roleMutationLoading: boolean
  rolePreview: RoleMutationResponse['data'] | null
  // Link handlers
  onLinkMember: (userId: string, reason: string) => Promise<void>
  onUnlinkMember: (reason: string) => Promise<void>
  linkLoading: boolean
  // Trades
  trades: TradeBrowseEntry[]
  tradesLoading: boolean
  tradesError: string | null
  selectedTrade: TradeBrowseEntry | null
  tradeSummary: { totalTrades: number; closedTrades: number; winRate: number | null; totalPnl: number }
  onSelectTrade: (tradeId: string) => void
  onRefreshTrades: () => void
}

export function MemberDetailTabs({
  detail,
  actionMessage,
  actionError,
  onCreateOverride,
  onRevokeOverride,
  savingOverride,
  onPreviewRoleMutation,
  onApplyRoleMutation,
  roleMutationLoading,
  rolePreview,
  onLinkMember,
  onUnlinkMember,
  linkLoading,
  trades,
  tradesLoading,
  tradesError,
  selectedTrade,
  tradeSummary,
  onSelectTrade,
  onRefreshTrades,
}: MemberDetailTabsProps) {
  const [roleMutationOperation, setRoleMutationOperation] = useState<'add' | 'remove'>('add')
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [roleMutationReason, setRoleMutationReason] = useState('')
  const [linkUserId, setLinkUserId] = useState(detail.identity.linked_user_id || '')
  const [linkReason, setLinkReason] = useState('')
  return (
    <Tabs defaultValue="identity" className="w-full">
      <div className="mb-4 space-y-3">
        {actionError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">
            {actionError}
          </div>
        )}
        {actionMessage && !actionError && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            {actionMessage}
          </div>
        )}
      </div>
      <TabsList>
        <TabsTrigger value="identity">Identity</TabsTrigger>
        <TabsTrigger value="access">Access</TabsTrigger>
        <TabsTrigger value="trades">Trades</TabsTrigger>
        <TabsTrigger value="roles">Roles</TabsTrigger>
        <TabsTrigger value="health">Health</TabsTrigger>
        <TabsTrigger value="overrides">Overrides</TabsTrigger>
      </TabsList>

      <TabsContent value="identity" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-white/10 bg-white/5">
            <CardContent className="space-y-3 pt-6 text-sm">
              <div>
                <p className="text-xs text-white/50">Display name</p>
                <p className="text-white">{detail.identity.nickname || detail.identity.global_name || detail.identity.username || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-xs text-white/50">Discord username</p>
                <p className="text-white">@{detail.identity.username || 'unknown'}</p>
              </div>
              <div>
                <p className="text-xs text-white/50">Discord user ID</p>
                <p className="font-mono text-white/80">{detail.identity.discord_user_id || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-white/50">Linked site account</p>
                <p className="font-mono text-white/80">{detail.identity.linked_user_id || 'Unlinked'}</p>
              </div>
              <div>
                <p className="text-xs text-white/50">Email</p>
                <p className="text-white/80">{detail.identity.email || '—'}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardContent className="space-y-3 pt-6 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge className="border-white/10 bg-white/5 text-white/70">
                  {detail.identity.link_status}
                </Badge>
                <Badge className={cn('border', detail.app_access.is_admin ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-white/10 bg-white/5 text-white/70')}>
                  {detail.app_access.is_admin ? 'admin' : 'non-admin'}
                </Badge>
                <Badge className="border-white/10 bg-white/5 text-white/70">
                  {detail.app_access.resolved_tier || 'no tier'}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-white/50">Role source</p>
                <p className="text-white/80">{detail.identity.sources.roles}</p>
              </div>
              <div>
                <p className="text-xs text-white/50">Identity source</p>
                <p className="text-white/80">{detail.identity.sources.identity}</p>
              </div>
              <div>
                <p className="text-xs text-white/50">Discord roles</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {detail.discord_roles.length === 0 && <span className="text-white/40">No roles</span>}
                  {detail.discord_roles.map((role) => (
                    <Badge key={role.role_id} className="border-white/10 bg-white/5 text-white/80">
                      {role.role_name}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Link Repair</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Input
              value={linkUserId}
              onChange={(event) => setLinkUserId(event.target.value)}
              placeholder="Site user UUID"
            />
            <div className="flex items-center rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white/60">
              Current link: {detail.identity.linked_user_id || 'Unlinked'}
            </div>
            <Textarea
              value={linkReason}
              onChange={(event) => setLinkReason(event.target.value)}
              placeholder="Audit reason for linking or unlinking"
              className="min-h-24 md:col-span-2"
            />
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-500"
                onClick={() => void onLinkMember(linkUserId.trim(), linkReason.trim())}
                disabled={linkLoading || !linkUserId.trim() || !linkReason.trim()}
              >
                {linkLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserRound className="mr-2 h-4 w-4" />}
                Link Member
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/5"
                onClick={() => void onUnlinkMember(linkReason.trim())}
                disabled={linkLoading || !detail.identity.linked_user_id || !linkReason.trim()}
              >
                {linkLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserRound className="mr-2 h-4 w-4" />}
                Unlink Member
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="access" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-white/10 bg-white/5">
            <CardContent className="pt-6">
              <p className="text-xs text-white/50">Tier</p>
              <p className="mt-1 text-xl font-semibold text-white">{detail.app_access.resolved_tier || 'None'}</p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/5">
            <CardContent className="pt-6">
              <p className="text-xs text-white/50">Members Access</p>
              <p className="mt-1 text-xl font-semibold text-white">{detail.app_access.has_members_access ? 'Allowed' : 'Denied'}</p>
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-white/5">
            <CardContent className="pt-6">
              <p className="text-xs text-white/50">Allowed Tabs</p>
              <p className="mt-1 text-xl font-semibold text-white">{detail.app_access.allowed_tabs.length}</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          {detail.tab_matrix.map((tab) => (
            <div key={tab.tabId} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-medium text-white">{tab.label}</p>
                  <p className="text-xs text-white/50">{tab.path}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className={cn('border', tab.allowed ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-red-500/30 bg-red-500/10 text-red-100')}>
                    {tab.allowed ? 'Allowed' : 'Denied'}
                  </Badge>
                  <Badge className="border-white/10 bg-white/5 text-white/70">
                    Tier: {tab.requiredTier}
                  </Badge>
                </div>
              </div>
              <p className="mt-3 text-sm text-white/80">{tab.reason}</p>
              {tab.requiredRoleNames.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {tab.requiredRoleNames.map((roleName) => (
                    <Badge key={`${tab.tabId}-${roleName}`} className="border-white/10 bg-white/5 text-white/70">
                      {roleName}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="trades" className="space-y-4" data-testid="member-trades-panel">
        <MemberTradesPanel
          detail={detail}
          trades={trades}
          tradesLoading={tradesLoading}
          tradesError={tradesError}
          selectedTrade={selectedTrade}
          tradeSummary={tradeSummary}
          onSelectTrade={onSelectTrade}
          onRefreshTrades={onRefreshTrades}
        />
      </TabsContent>

      <TabsContent value="roles" className="space-y-4" data-testid="member-roles-panel">
        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Discord Role Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!detail.controls.allow_discord_role_mutation && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                Discord role mutation is disabled in `access_control_settings`. Preview is still available.
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {detail.discord_roles.length === 0 && (
                <span className="text-sm text-white/50">This member currently has no cached Discord roles.</span>
              )}
              {detail.discord_roles.map((role) => (
                <Badge key={role.role_id} className="border-white/10 bg-black/20 text-white/80">
                  {role.role_name}
                </Badge>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Select
                value={roleMutationOperation}
                onValueChange={(value: 'add' | 'remove') => setRoleMutationOperation(value)}
              >
                <SelectTrigger data-testid="member-role-operation-trigger"><SelectValue placeholder="Role operation" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add role</SelectItem>
                  <SelectItem value="remove">Remove role</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger data-testid="member-role-select-trigger"><SelectValue placeholder="Select guild role" /></SelectTrigger>
                <SelectContent>
                  {detail.controls.role_catalog
                    .filter((role) => !role.managed)
                    .map((role) => (
                      <SelectItem key={role.role_id} value={role.role_id}>
                        {role.role_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Textarea
                data-testid="member-role-reason"
                value={roleMutationReason}
                onChange={(event) => setRoleMutationReason(event.target.value)}
                placeholder="Audit reason for this Discord role change"
                className="min-h-24 md:col-span-2"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                data-testid="member-role-preview-button"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/5"
                onClick={() => void onPreviewRoleMutation(roleMutationOperation, selectedRoleId)}
                disabled={roleMutationLoading || !selectedRoleId}
              >
                {roleMutationLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                Preview Change
              </Button>
              <Button
                type="button"
                data-testid="member-role-apply-button"
                className="bg-emerald-600 hover:bg-emerald-500"
                onClick={() => void onApplyRoleMutation(roleMutationOperation, selectedRoleId, roleMutationReason.trim())}
                disabled={roleMutationLoading || !selectedRoleId || !roleMutationReason.trim()}
              >
                {roleMutationLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                Apply Change
              </Button>
            </div>
          </CardContent>
        </Card>

        {rolePreview && (
          <Card className="border-white/10 bg-white/5" data-testid="member-role-preview">
            <CardHeader>
              <CardTitle className="text-white">Role Change Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge className="border-white/10 bg-black/20 text-white/80">
                  {rolePreview.role?.name || selectedRoleId || 'Selected role'}
                </Badge>
                {rolePreview.manageable === false && (
                  <Badge className="border-red-500/30 bg-red-500/10 text-red-100">Not manageable</Badge>
                )}
                {rolePreview.no_op && (
                  <Badge className="border-blue-500/30 bg-blue-500/10 text-blue-100">No-op</Badge>
                )}
              </div>
              {rolePreview.manageability_reason && (
                <p className="text-white/70">{rolePreview.manageability_reason}</p>
              )}
              {(rolePreview.preview_evaluation || rolePreview.evaluation) && (
                <div className="grid gap-3 md:grid-cols-3">
                  <Card className="border-white/10 bg-black/20">
                    <CardContent className="pt-6">
                      <p className="text-xs text-white/50">Tier</p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {rolePreview.preview_evaluation?.resolvedTier || rolePreview.evaluation?.resolvedTier || 'None'}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-white/10 bg-black/20">
                    <CardContent className="pt-6">
                      <p className="text-xs text-white/50">Admin</p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {(rolePreview.preview_evaluation?.isAdmin || rolePreview.evaluation?.isAdmin) ? 'Yes' : 'No'}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-white/10 bg-black/20">
                    <CardContent className="pt-6">
                      <p className="text-xs text-white/50">Allowed tabs</p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {rolePreview.preview_evaluation?.allowedTabs.length || rolePreview.evaluation?.allowedTabs.length || 0}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="health" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-white/10 bg-white/5">
            <CardContent className="space-y-3 pt-6 text-sm">
              <div>
                <p className="text-xs text-white/50">Roster sync</p>
                <p className="text-white/80">{formatDate(detail.profile_sync_health.last_synced_at)}</p>
              </div>
              <div>
                <p className="text-xs text-white/50">Linked profile sync</p>
                <p className="text-white/80">{formatDate(detail.profile_sync_health.linked_profile_last_synced_at)}</p>
              </div>
              <div>
                <p className="text-xs text-white/50">Last sign in</p>
                <p className="text-white/80">{formatDate(detail.profile_sync_health.linked_auth_last_sign_in_at)}</p>
              </div>
              {detail.profile_sync_health.guild_sync_error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-100">
                  {detail.profile_sync_health.guild_sync_error}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5">
            <CardContent className="space-y-3 pt-6 text-sm">
              <p className="text-xs text-white/50">Health warnings</p>
              {detail.profile_sync_health.warnings.length === 0 && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-100">
                  <CheckCircle2 className="mr-2 inline h-4 w-4" />
                  No access health warnings.
                </div>
              )}
              {detail.profile_sync_health.warnings.map((warning) => (
                <div key={warning.code} className={cn('rounded-lg border p-3', warningClass(warning.severity))}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">{warning.code}</span>
                  </div>
                  <p className="mt-2 text-sm">{warning.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="border-white/10 bg-white/5">
          <CardHeader>
            <CardTitle className="text-white">Audit History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {detail.audit_history.length === 0 && (
              <p className="text-white/50">No audit entries for this member yet.</p>
            )}
            {detail.audit_history.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                  <p className="font-medium text-white">{entry.action}</p>
                  <p className="text-xs text-white/40">{formatDate(entry.created_at)}</p>
                </div>
                {entry.details && (
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded bg-black/30 p-3 text-xs text-white/70">
                    {JSON.stringify(entry.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="overrides" className="space-y-4" data-testid="member-overrides-panel">
        <MemberOverridesTab
          detail={detail}
          onCreateOverride={onCreateOverride}
          onRevokeOverride={onRevokeOverride}
          savingOverride={savingOverride}
        />
      </TabsContent>
    </Tabs>
  )
}
