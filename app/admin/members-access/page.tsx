'use client'

import {
  Loader2,
  RefreshCw,
  Shield,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DirectoryFilterBar, MemberDirectoryList } from '@/components/admin/members-access/member-directory-panel'
import { MemberDetailTabs } from '@/components/admin/members-access/member-detail-tabs'
import { useMembersAccess } from '@/hooks/use-members-access'

export default function AdminMembersAccessPage() {
  const state = useMembersAccess()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-white lg:text-3xl">
            <ShieldAlert className="h-8 w-8 text-emerald-500" />
            Member Access Control Center
          </h1>
          <p className="mt-1 text-white/60">
            Browse the full Discord guild roster, inspect canonical access, and apply audited overrides from one workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-white/20 text-white hover:bg-white/5"
            onClick={() => void state.loadDirectory()}
            disabled={state.directoryLoading}
          >
            {state.directoryLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh Directory
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-500"
            onClick={() => void state.handleRefreshGuildRoster()}
            disabled={state.syncingGuild}
          >
            {state.syncingGuild ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
            Refresh Guild Roster
          </Button>
        </div>
      </div>

      <DirectoryFilterBar
        query={state.query}
        onQueryChange={state.setQuery}
        linkedFilter={state.linkedFilter}
        onLinkedFilterChange={state.setLinkedFilter}
        tierFilter={state.tierFilter}
        onTierFilterChange={state.setTierFilter}
        overrideFilter={state.overrideFilter}
        onOverrideFilterChange={state.setOverrideFilter}
        privilegedFilter={state.privilegedFilter}
        onPrivilegedFilterChange={state.setPrivilegedFilter}
      />

      <div className="grid gap-6 xl:grid-cols-[420px,minmax(0,1fr)]">
        <MemberDirectoryList
          rows={state.directoryRows}
          loading={state.directoryLoading}
          error={state.directoryError}
          selectedDiscordUserId={state.selectedDiscordUserId}
          onSelectMember={state.setSelectedDiscordUserId}
        />

        <Card className="border-white/10 bg-[#0a0a0b]">
          <CardHeader>
            <CardTitle className="flex flex-col gap-3 text-white lg:flex-row lg:items-center lg:justify-between">
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-400" />
                Member Detail Workspace
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/5"
                  onClick={() => state.selectedDiscordUserId && void state.loadDetail(state.selectedDiscordUserId)}
                  disabled={!state.selectedDiscordUserId || state.detailLoading}
                >
                  {state.detailLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Refresh Detail
                </Button>
                <Button
                  type="button"
                  className="bg-emerald-600 hover:bg-emerald-500"
                  onClick={() => void state.handleSyncMember()}
                  disabled={!state.selectedDiscordUserId || state.syncingMember}
                >
                  {state.syncingMember ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Sync Member
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!state.selectedRow && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-white/60">
                Select a guild member to inspect access, tab reasoning, overrides, and sync health.
              </div>
            )}

            {state.selectedRow && state.detailLoading && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
                <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-emerald-500" />
                Loading member detail...
              </div>
            )}

            {state.selectedRow && !state.detailLoading && state.detailError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
                {state.detailError}
              </div>
            )}

            {state.selectedRow && !state.detailLoading && state.detail && (
              <MemberDetailTabs
                detail={state.detail}
                actionMessage={state.actionMessage}
                actionError={state.actionError}
                onCreateOverride={state.handleCreateOverride}
                onRevokeOverride={state.handleRevokeOverride}
                savingOverride={state.savingOverride}
                onPreviewRoleMutation={state.handlePreviewRoleMutation}
                onApplyRoleMutation={state.handleApplyRoleMutation}
                roleMutationLoading={state.roleMutationLoading}
                rolePreview={state.rolePreview}
                onLinkMember={state.handleLinkMember}
                onUnlinkMember={state.handleUnlinkMember}
                linkLoading={state.linkLoading}
                trades={state.memberTrades}
                tradesLoading={state.memberTradesLoading}
                tradesError={state.memberTradesError}
                selectedTrade={state.selectedTrade}
                tradeSummary={state.tradeSummary}
                onSelectTrade={state.setSelectedTradeId}
                onRefreshTrades={() => {
                  if (state.detail?.identity.linked_user_id) {
                    void state.loadMemberTrades(state.detail.identity.linked_user_id)
                  }
                }}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
