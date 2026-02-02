'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Shield, CheckCircle2, XCircle } from 'lucide-react'
import { syncDiscordRoles, updateRolePermissions, getRolePermissions } from '@/app/actions/permissions'
import { RolePermission, MemberTab } from '@/lib/types_db'
import { toast } from 'sonner'

// Available member tabs
const MEMBER_TABS: { id: MemberTab; label: string; description: string }[] = [
  { id: 'dashboard', label: 'Dashboard', description: 'Home screen with stats and market bias' },
  { id: 'journal', label: 'Trading Journal', description: 'Log trades and get AI analysis' },
  { id: 'library', label: 'Library', description: 'Educational courses and resources' },
  { id: 'profile', label: 'Profile', description: 'User profile and settings' },
]

export default function PermissionsPage() {
  const [roles, setRoles] = useState<RolePermission[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [optimisticUpdates, setOptimisticUpdates] = useState<Record<string, MemberTab[]>>({})

  // Load permissions on mount
  useEffect(() => {
    loadPermissions()
  }, [])

  async function loadPermissions() {
    setLoading(true)
    const result = await getRolePermissions()
    if (result.success && result.data) {
      setRoles(result.data)
    } else {
      toast.error(result.error || 'Failed to load permissions')
    }
    setLoading(false)
  }

  async function handleSyncRoles() {
    setSyncing(true)
    const result = await syncDiscordRoles()

    if (result.success) {
      toast.success(result.message || 'Discord roles synced successfully')
      await loadPermissions()
    } else {
      toast.error(result.error || 'Failed to sync Discord roles')
    }

    setSyncing(false)
  }

  async function handleToggleTab(roleId: string, tab: MemberTab, currentTabs: MemberTab[]) {
    // Optimistic update
    const newTabs = currentTabs.includes(tab)
      ? currentTabs.filter(t => t !== tab)
      : [...currentTabs, tab]

    setOptimisticUpdates(prev => ({ ...prev, [roleId]: newTabs }))

    // Update in database
    const result = await updateRolePermissions(roleId, newTabs)

    if (result.success) {
      // Update real data
      setRoles(prev => prev.map(role =>
        role.discord_role_id === roleId
          ? { ...role, allowed_tabs: newTabs }
          : role
      ))
      toast.success('Permissions updated')
    } else {
      // Revert optimistic update on error
      setOptimisticUpdates(prev => {
        const { [roleId]: _, ...rest } = prev
        return rest
      })
      toast.error(result.error || 'Failed to update permissions')
    }
  }

  function getDisplayTabs(role: RolePermission): MemberTab[] {
    return optimisticUpdates[role.discord_role_id] || role.allowed_tabs as MemberTab[]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            Role Permissions
          </h1>
          <p className="text-muted-foreground mt-2">
            Control which Discord roles can access which member area tabs
          </p>
        </div>

        <Button
          onClick={handleSyncRoles}
          disabled={syncing}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          Sync Discord Roles
        </Button>
      </div>

      {/* Permissions Matrix */}
      <Card className="glass-card-heavy border-primary/20">
        <CardHeader>
          <CardTitle>Permissions Matrix</CardTitle>
          <CardDescription>
            Check the boxes to grant access to specific member area tabs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {roles.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <XCircle className="w-12 h-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">
                No Discord roles found. Click "Sync Discord Roles" to load roles from your server.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className="text-left py-4 px-4 font-semibold text-sm">
                      Discord Role
                    </th>
                    {MEMBER_TABS.map(tab => (
                      <th key={tab.id} className="text-center py-4 px-4 font-semibold text-sm">
                        <div className="flex flex-col items-center gap-1">
                          <span>{tab.label}</span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {tab.description}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roles.map(role => {
                    const displayTabs = getDisplayTabs(role)

                    return (
                      <tr
                        key={role.discord_role_id}
                        className="border-b border-border/20 hover:bg-primary/5 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            {role.role_color && (
                              <div
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: role.role_color }}
                              />
                            )}
                            <div>
                              <div className="font-semibold">{role.role_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {displayTabs.length} tab{displayTabs.length !== 1 ? 's' : ''} enabled
                              </div>
                            </div>
                          </div>
                        </td>
                        {MEMBER_TABS.map(tab => {
                          const isChecked = displayTabs.includes(tab.id)

                          return (
                            <td key={tab.id} className="py-4 px-4 text-center">
                              <div className="flex items-center justify-center">
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={() =>
                                    handleToggleTab(role.discord_role_id, tab.id, displayTabs)
                                  }
                                  className="w-5 h-5"
                                />
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
            <div className="space-y-2">
              <p className="font-semibold">How It Works</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Members automatically inherit permissions from their Discord roles</li>
                <li>• If a user has multiple roles, they get the union of all permissions</li>
                <li>• Changes take effect immediately for all users with that role</li>
                <li>• Use "Sync Discord Roles" to pull the latest roles from your Discord server</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
