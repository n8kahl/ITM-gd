export type MembershipTier = 'core' | 'pro' | 'executive'
export type RequiredTier = MembershipTier | 'admin'
export type OverrideType =
  | 'suspend_members_access'
  | 'allow_members_access'
  | 'allow_specific_tabs'
  | 'deny_specific_tabs'
  | 'temporary_admin'

export interface AccessControlSettings {
  membersAllowedRoleIds: string[]
  privilegedRoleIds: string[]
  adminRoleIds: string[]
  defaultLinkedUserStatus: string
  allowDiscordRoleMutation: boolean
}

export interface PricingTierRecord {
  id: MembershipTier
  name: string
  discordRoleId: string | null
  isActive: boolean
  displayOrder: number
}

export interface TabConfigRecord {
  id: string
  tab_id: string
  label: string
  icon: string
  path: string
  required_tier: RequiredTier
  badge_text?: string | null
  badge_variant?: 'emerald' | 'champagne' | 'destructive' | null
  description?: string | null
  mobile_visible: boolean
  sort_order: number
  is_required: boolean
  is_active: boolean
  required_discord_role_ids: string[]
}

export interface ActiveMemberAccessOverride {
  id: string
  discordUserId: string | null
  userId: string | null
  overrideType: OverrideType
  payload: Record<string, unknown>
  reason: string
  createdAt: string
  createdByUserId: string
  expiresAt: string | null
  revokedAt: string | null
  revokedByUserId: string | null
  revocationReason: string | null
}

export interface DiscordGuildMemberRecord {
  discordUserId: string
  username: string
  globalName: string | null
  nickname: string | null
  avatar: string | null
  discordRoles: string[]
  isInGuild: boolean
  joinedAt: string | null
  lastSyncedAt: string | null
  linkedUserId: string | null
  syncSource: string | null
  syncError: string | null
}

export interface LinkedDiscordProfileRecord {
  userId: string
  discordUserId: string | null
  discordUsername: string | null
  discordAvatar: string | null
  discordRoles: string[]
  lastSyncedAt: string | null
}

export interface LinkedAuthUserRecord {
  id: string
  email: string | null
  createdAt: string | null
  lastSignInAt: string | null
}

export interface AccessControlSubject {
  discordMember: DiscordGuildMemberRecord | null
  linkedProfile: LinkedDiscordProfileRecord | null
  linkedAuthUser: LinkedAuthUserRecord | null
}

export interface MemberAccessHealthWarning {
  code: string
  severity: 'info' | 'warning' | 'critical'
  message: string
}

export interface MemberTabDecision {
  tabId: string
  label: string
  path: string
  requiredTier: RequiredTier
  requiredRoleIds: string[]
  requiredRoleNames: string[]
  isRequired: boolean
  mobileVisible: boolean
  allowed: boolean
  reasonCode: string
  reason: string
  overrideApplied: OverrideType | null
}

export interface MemberAccessEvaluation {
  discordUserId: string | null
  userId: string | null
  email: string | null
  username: string | null
  globalName: string | null
  nickname: string | null
  avatar: string | null
  linkStatus: 'linked' | 'discord_only' | 'site_only'
  isInGuild: boolean
  lastSyncedAt: string | null
  effectiveDiscordRoleIds: string[]
  roleTitlesById: Record<string, string>
  resolvedTier: MembershipTier | null
  isPrivileged: boolean
  isAdmin: boolean
  hasMembersAccess: boolean
  allowedTabs: string[]
  tabDecisions: MemberTabDecision[]
  activeOverrides: ActiveMemberAccessOverride[]
  healthWarnings: MemberAccessHealthWarning[]
  sources: {
    roles: 'discord_guild_members' | 'user_discord_profiles' | 'none'
    identity: 'discord_guild_members' | 'user_discord_profiles' | 'auth_user' | 'none'
  }
}
