'use client'

import { useState } from 'react'
import {
  Loader2,
  Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { DetailData } from './members-access-types'
import { formatDate } from './members-access-types'

type MemberOverridesTabProps = {
  detail: DetailData
  onCreateOverride: (overrideType: string, reason: string, tabs: string, expiresAt: string) => Promise<void>
  onRevokeOverride: (overrideId: string) => Promise<void>
  savingOverride: boolean
}

export function MemberOverridesTab({
  detail,
  onCreateOverride,
  onRevokeOverride,
  savingOverride,
}: MemberOverridesTabProps) {
  const [overrideType, setOverrideType] = useState('suspend_members_access')
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideTabs, setOverrideTabs] = useState('')
  const [overrideExpiresAt, setOverrideExpiresAt] = useState('')

  return (
    <>
      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Create Override</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Select value={overrideType} onValueChange={setOverrideType}>
            <SelectTrigger><SelectValue placeholder="Override type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="suspend_members_access">Suspend members access</SelectItem>
              <SelectItem value="allow_members_access">Allow members access</SelectItem>
              <SelectItem value="allow_specific_tabs">Allow specific tabs</SelectItem>
              <SelectItem value="deny_specific_tabs">Deny specific tabs</SelectItem>
              <SelectItem value="temporary_admin">Temporary admin</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="datetime-local"
            value={overrideExpiresAt}
            onChange={(event) => setOverrideExpiresAt(event.target.value)}
            placeholder="Optional expiry"
          />
          <Textarea
            data-testid="member-override-reason"
            value={overrideReason}
            onChange={(event) => setOverrideReason(event.target.value)}
            placeholder="Reason for this override"
            className="min-h-28 md:col-span-2"
          />
          {(overrideType === 'allow_specific_tabs' || overrideType === 'deny_specific_tabs') && (
            <Input
              value={overrideTabs}
              onChange={(event) => setOverrideTabs(event.target.value)}
              placeholder="Comma-separated tab IDs (example: ai-coach,journal)"
              className="md:col-span-2"
            />
          )}
          <div className="md:col-span-2">
            <Button
              type="button"
              data-testid="member-override-create-button"
              className="bg-emerald-600 hover:bg-emerald-500"
              onClick={() => void onCreateOverride(overrideType, overrideReason.trim(), overrideTabs, overrideExpiresAt)}
              disabled={savingOverride || !overrideReason.trim()}
            >
              {savingOverride ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
              Create Override
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Active Overrides</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {detail.overrides.length === 0 && (
            <p className="text-white/50" data-testid="member-overrides-empty">No active overrides for this member.</p>
          )}
          {detail.overrides.map((override) => (
            <div key={override.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-medium text-white">{override.overrideType}</p>
                  <p className="text-xs text-white/40">Created {formatDate(override.createdAt)}</p>
                  <p className="mt-2 text-white/80">{override.reason}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/5"
                  onClick={() => void onRevokeOverride(override.id)}
                  disabled={savingOverride}
                >
                  Revoke
                </Button>
              </div>
              {Object.keys(override.payload || {}).length > 0 && (
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded bg-black/30 p-3 text-xs text-white/70">
                  {JSON.stringify(override.payload, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  )
}
