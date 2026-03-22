'use client'

import {
  Loader2,
  Search,
  UserRound,
  Users,
} from 'lucide-react'
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
import { cn } from '@/lib/utils'
import {
  type DirectoryRow,
  accessBadgeClass,
  formatDate,
  getDisplayName,
} from './members-access-types'

type DirectoryFilterBarProps = {
  query: string
  onQueryChange: (query: string) => void
  linkedFilter: string
  onLinkedFilterChange: (value: string) => void
  tierFilter: string
  onTierFilterChange: (value: string) => void
  overrideFilter: string
  onOverrideFilterChange: (value: string) => void
  privilegedFilter: string
  onPrivilegedFilterChange: (value: string) => void
}

export function DirectoryFilterBar({
  query,
  onQueryChange,
  linkedFilter,
  onLinkedFilterChange,
  tierFilter,
  onTierFilterChange,
  overrideFilter,
  onOverrideFilterChange,
  privilegedFilter,
  onPrivilegedFilterChange,
}: DirectoryFilterBarProps) {
  return (
    <Card className="border-white/10 bg-[#0a0a0b]">
      <CardContent className="grid gap-3 pt-6 md:grid-cols-2 xl:grid-cols-5">
        <div className="relative xl:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-white/30" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search Discord username, nickname, display name, email, user ID, or Discord ID"
            className="pl-10"
          />
        </div>
        <Select value={linkedFilter} onValueChange={onLinkedFilterChange}>
          <SelectTrigger><SelectValue placeholder="Link status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All members</SelectItem>
            <SelectItem value="linked">Linked only</SelectItem>
            <SelectItem value="unlinked">Unlinked only</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tierFilter} onValueChange={onTierFilterChange}>
          <SelectTrigger><SelectValue placeholder="Tier" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tiers</SelectItem>
            <SelectItem value="core">Core</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="executive">Executive</SelectItem>
            <SelectItem value="none">No tier</SelectItem>
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Select value={overrideFilter} onValueChange={onOverrideFilterChange}>
            <SelectTrigger><SelectValue placeholder="Override" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All overrides</SelectItem>
              <SelectItem value="blocked">Suspended</SelectItem>
              <SelectItem value="overridden">Has override</SelectItem>
              <SelectItem value="none">No override</SelectItem>
            </SelectContent>
          </Select>
          <Select value={privilegedFilter} onValueChange={onPrivilegedFilterChange}>
            <SelectTrigger><SelectValue placeholder="Privilege" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All privilege</SelectItem>
              <SelectItem value="true">Privileged only</SelectItem>
              <SelectItem value="false">Non-privileged</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )
}

type MemberDirectoryListProps = {
  rows: DirectoryRow[]
  loading: boolean
  error: string | null
  selectedDiscordUserId: string | null
  onSelectMember: (discordUserId: string) => void
}

export function MemberDirectoryList({
  rows,
  loading,
  error,
  selectedDiscordUserId,
  onSelectMember,
}: MemberDirectoryListProps) {
  return (
    <Card className="border-white/10 bg-[#0a0a0b]">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-white">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-400" />
            Guild Directory
          </span>
          <Badge className="border-white/10 bg-white/5 text-white/80">
            {rows.length} results
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center text-sm text-white/60">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-emerald-500" />
            Loading guild directory...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            No members matched the current filters.
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="max-h-[72vh] space-y-2 overflow-y-auto pr-1">
            {rows.map((row) => {
              const isSelected = row.discord_user_id === selectedDiscordUserId
              return (
                <button
                  key={row.discord_user_id}
                  type="button"
                  data-testid={`member-directory-row-${row.discord_user_id}`}
                  onClick={() => onSelectMember(row.discord_user_id)}
                  className={cn(
                    'w-full rounded-xl border p-3 text-left transition',
                    isSelected
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10',
                  )}
                >
                  <div className="flex items-start gap-3">
                    {row.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.avatar_url}
                        alt={getDisplayName(row)}
                        className="h-11 w-11 rounded-full border border-white/10 object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5">
                        <UserRound className="h-5 w-5 text-white/40" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-white">{getDisplayName(row)}</p>
                        <Badge className={cn('border', accessBadgeClass(row.access_status))}>
                          {row.access_status}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-white/50">@{row.username}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge className="border-white/10 bg-white/5 text-white/70">
                          {row.link_status}
                        </Badge>
                        <Badge className="border-white/10 bg-white/5 text-white/70">
                          {row.resolved_tier || 'no tier'}
                        </Badge>
                        {row.active_override_count > 0 && (
                          <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-100">
                            {row.active_override_count} override{row.active_override_count > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-white/40">
                        Synced {formatDate(row.last_synced_at)}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
