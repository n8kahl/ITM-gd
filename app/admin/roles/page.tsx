'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Shield,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  ExternalLink
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { DiscordRolePicker } from '@/components/admin/discord-role-picker'

interface AppPermission {
  id: string
  name: string
  description: string | null
}

interface RoleMapping {
  discord_role_id: string
  discord_role_name: string | null
  permission_ids: string[]
  mapping_ids: string[]
  isNew?: boolean
  hasChanges?: boolean
}

function getRoleTitle(role: Pick<RoleMapping, 'discord_role_name'>): string {
  const explicitName = role.discord_role_name?.trim()
  return explicitName && explicitName.length > 0 ? explicitName : 'Unnamed Discord Role'
}

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleMapping[]>([])
  const [permissions, setPermissions] = useState<AppPermission[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/roles')
      const data = await response.json()

      if (data.success) {
        setRoles(data.roles)
        setPermissions(data.permissions)
      } else {
        setError(data.error || 'Failed to load data')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Add new role mapping
  const handleAddRole = () => {
    const newRole: RoleMapping = {
      discord_role_id: '',
      discord_role_name: '',
      permission_ids: [],
      mapping_ids: [],
      isNew: true,
      hasChanges: true,
    }
    setRoles([...roles, newRole])
  }

  // Update role - handles multiple fields at once to avoid state race conditions
  const updateRole = (index: number, updates: Partial<RoleMapping>) => {
    setRoles(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        ...updates,
        hasChanges: true,
      }
      return updated
    })
  }

  // Toggle permission for a role
  const togglePermission = (roleIndex: number, permissionId: string) => {
    const role = roles[roleIndex]
    const newPermissions = role.permission_ids.includes(permissionId)
      ? role.permission_ids.filter(id => id !== permissionId)
      : [...role.permission_ids, permissionId]

    updateRole(roleIndex, { permission_ids: newPermissions })
  }

  // Save role
  const handleSaveRole = async (index: number) => {
    const role = roles[index]

    if (!role.discord_role_id.trim()) {
      setError('Discord role is required')
      return
    }

    if (role.permission_ids.length === 0) {
      setError('At least one permission must be selected')
      return
    }

    setSaving(role.discord_role_id)
    setError(null)

    try {
      const method = role.isNew ? 'POST' : 'PUT'
      const response = await fetch('/api/admin/roles', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discord_role_id: role.discord_role_id.trim(),
          discord_role_name: role.discord_role_name?.trim() || null,
          permission_ids: role.permission_ids,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(`Role "${getRoleTitle(role)}" saved successfully`)
        setTimeout(() => setSuccess(null), 3000)

        // Update role state
        setRoles(prev => {
          const updated = [...prev]
          updated[index] = {
            ...updated[index],
            isNew: false,
            hasChanges: false,
          }
          return updated
        })
      } else {
        setError(data.error || 'Failed to save role')
      }
    } catch (err) {
      setError('Failed to save role')
    } finally {
      setSaving(null)
    }
  }

  // Delete role
  const handleDeleteRole = async (index: number) => {
    const role = roles[index]

    // If it's a new unsaved role, just remove from state
    if (role.isNew) {
      setRoles(roles.filter((_, i) => i !== index))
      return
    }

    if (!confirm(`Delete all permission mappings for "${getRoleTitle(role)}"?`)) {
      return
    }

    setSaving(role.discord_role_id)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/roles?discord_role_id=${encodeURIComponent(role.discord_role_id)}`,
        { method: 'DELETE' }
      )

      const data = await response.json()

      if (data.success) {
        setRoles(roles.filter((_, i) => i !== index))
        setSuccess('Role mapping deleted successfully')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        setError(data.error || 'Failed to delete role')
      }
    } catch (err) {
      setError('Failed to delete role')
    } finally {
      setSaving(null)
    }
  }

  // Cancel editing
  const handleCancelEdit = (index: number) => {
    const role = roles[index]

    if (role.isNew) {
      // Remove new unsaved role
      setRoles(roles.filter((_, i) => i !== index))
    } else {
      // Reload data to reset changes
      loadData()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-white/60">Loading role mappings...</p>
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
            <Shield className="w-8 h-8 text-emerald-500" />
            Discord Role Mapping
          </h1>
          <p className="text-white/60 mt-1">
            Map Discord roles to application permissions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={loadData}
            className="border-white/20 text-white hover:bg-white/5"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reload
          </Button>
          <Button
            onClick={handleAddRole}
            className="bg-emerald-500 hover:bg-emerald-600 text-black"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Mapping
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-400 font-medium">Error</p>
            <p className="text-sm text-red-400/70">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">
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

      {/* Instructions Card */}
      <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
        <CardContent className="pt-6">
          <h3 className="font-medium text-white mb-2">How Role Mapping Works</h3>
          <ol className="text-sm text-white/70 space-y-1 list-decimal list-inside">
            <li>Click &quot;Add New Mapping&quot; and pick a Discord role title</li>
            <li>Select one or more app permissions for that role</li>
            <li>Save the mapping to apply access rules immediately</li>
            <li>Use Reload if you recently changed Discord roles</li>
          </ol>
          <a
            href="https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-emerald-500 text-sm mt-3 hover:underline"
          >
            Learn more about Discord roles
            <ExternalLink className="w-3 h-3" />
          </a>
        </CardContent>
      </Card>

      {/* Available Permissions Reference */}
      <Card className="bg-[#0a0a0b] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">Available Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {permissions.map(perm => (
              <div
                key={perm.id}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10"
                title={perm.description || undefined}
              >
                <span className="text-sm text-white/80">{perm.name}</span>
                {perm.description && (
                  <span className="text-xs text-white/40 ml-2">({perm.description})</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Role Mappings Table */}
      <Card className="bg-[#0a0a0b] border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Role Permission Mappings</CardTitle>
        </CardHeader>
        <CardContent>
          {roles.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 mx-auto mb-4 text-white/20" />
              <p className="text-white/60 mb-4">No role mappings configured yet</p>
              <Button
                onClick={handleAddRole}
                className="bg-emerald-500 hover:bg-emerald-600 text-black"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Mapping
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {roles.map((role, index) => (
                <div
                  key={role.discord_role_id || `new-${index}`}
                  className={cn(
                    'p-4 rounded-xl border transition-all',
                    role.isNew || role.hasChanges
                      ? 'bg-emerald-500/5 border-emerald-500/30'
                      : 'bg-white/5 border-white/10'
                  )}
                >
                  {/* Role Header */}
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-4">
                    {/* Discord Role Picker */}
                    <div className="flex-1">
                      <label className="block text-xs text-white/40 mb-1">
                        Discord Role
                      </label>
                      <DiscordRolePicker
                        value={role.discord_role_id}
                        onChange={(id, name) => {
                          // Update both fields at once to avoid race condition
                          updateRole(index, {
                            discord_role_id: id,
                            discord_role_name: name || null,
                          })
                        }}
                        disabled={!role.isNew}
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-end gap-2">
                      {(role.isNew || role.hasChanges) && (
                        <>
                          <Button
                            onClick={() => handleSaveRole(index)}
                            disabled={saving === role.discord_role_id || !role.discord_role_id}
                            className="bg-emerald-500 hover:bg-emerald-600 text-black"
                          >
                            {saving === role.discord_role_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                            <span className="ml-2 hidden sm:inline">Save</span>
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleCancelEdit(index)}
                            className="border-white/20 text-white hover:bg-white/5"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => handleDeleteRole(index)}
                        disabled={saving === role.discord_role_id}
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Selected Role Display */}
                  {role.discord_role_id && (
                    <div className="mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
                      <span className="text-sm text-white/60">Selected: </span>
                      <span className="text-sm text-white font-medium">{getRoleTitle(role)}</span>
                    </div>
                  )}

                  {/* Permission Badges */}
                  <div>
                    <label className="block text-xs text-white/40 mb-2">
                      Assigned Permissions
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {permissions.map(perm => {
                        const isSelected = role.permission_ids.includes(perm.id)
                        return (
                          <button
                            key={perm.id}
                            onClick={() => togglePermission(index, perm.id)}
                            className={cn(
                              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                              isSelected
                                ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/50'
                                : 'bg-white/5 text-white/60 border border-white/10 hover:border-white/30 hover:text-white'
                            )}
                            title={perm.description || undefined}
                          >
                            {isSelected && <CheckCircle className="w-3 h-3 inline mr-1.5" />}
                            {perm.name}
                          </button>
                        )
                      })}
                    </div>
                    {role.permission_ids.length === 0 && (
                      <p className="text-xs text-white/40 mt-2">
                        Click permissions above to assign them to this role
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Common Role Templates */}
      <Card className="bg-[#0a0a0b] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">Suggested Role Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            <TemplateCard
              name="Core Tier"
              permissions={[
                'access_core_content',
                'access_trading_journal',
                'access_course_library',
                'access_live_alerts'
              ]}
              allPermissions={permissions}
              onApply={(permIds) => {
                const newRole: RoleMapping = {
                  discord_role_id: '',
                  discord_role_name: 'Core Tier',
                  permission_ids: permIds,
                  mapping_ids: [],
                  isNew: true,
                  hasChanges: true,
                }
                setRoles([...roles, newRole])
              }}
            />
            <TemplateCard
              name="Pro Tier"
              permissions={[
                'access_core_content',
                'access_pro_content',
                'access_trading_journal',
                'access_ai_analysis',
                'access_course_library',
                'access_live_alerts',
                'access_position_builder',
                'access_community_chat'
              ]}
              allPermissions={permissions}
              onApply={(permIds) => {
                const newRole: RoleMapping = {
                  discord_role_id: '',
                  discord_role_name: 'Pro Tier',
                  permission_ids: permIds,
                  mapping_ids: [],
                  isNew: true,
                  hasChanges: true,
                }
                setRoles([...roles, newRole])
              }}
            />
            <TemplateCard
              name="Executive Tier"
              permissions={[
                'access_core_content',
                'access_pro_content',
                'access_executive_content',
                'access_trading_journal',
                'access_ai_analysis',
                'access_course_library',
                'access_live_alerts',
                'access_position_builder',
                'access_market_structure',
                'access_premium_tools',
                'access_community_chat'
              ]}
              allPermissions={permissions}
              onApply={(permIds) => {
                const newRole: RoleMapping = {
                  discord_role_id: '',
                  discord_role_name: 'Executive Tier',
                  permission_ids: permIds,
                  mapping_ids: [],
                  isNew: true,
                  hasChanges: true,
                }
                setRoles([...roles, newRole])
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Template Card Component
function TemplateCard({
  name,
  permissions,
  allPermissions,
  onApply,
}: {
  name: string
  permissions: string[]
  allPermissions: AppPermission[]
  onApply: (permissionIds: string[]) => void
}) {
  const handleApply = () => {
    const permIds = allPermissions
      .filter(p => permissions.includes(p.name))
      .map(p => p.id)
    onApply(permIds)
  }

  return (
    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
      <h4 className="font-medium text-white mb-2">{name}</h4>
      <div className="flex flex-wrap gap-1 mb-3">
        {permissions.map(perm => (
          <span key={perm} className="px-2 py-0.5 text-xs rounded bg-white/10 text-white/60">
            {perm}
          </span>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleApply}
        className="w-full border-white/20 text-white hover:bg-white/5"
      >
        <Plus className="w-3 h-3 mr-1" />
        Use Template
      </Button>
    </div>
  )
}
