import { NextRequest, NextResponse } from 'next/server'
import {
  evaluateMemberAccessFromSubject,
  loadAccessControlResources,
} from '@/lib/access-control/evaluate-member-access'
import {
  requireAdminAccess,
} from '@/lib/access-control/admin-access'
import {
  loadAccessControlSubject,
} from '@/lib/access-control/identity'
import {
  fetchActiveMemberAccessOverrides,
} from '@/lib/access-control/overrides'
import {
  createServiceRoleSupabaseClient,
} from '@/lib/server-supabase'

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const nextLeft = [...left].sort()
  const nextRight = [...right].sort()
  return nextLeft.every((value, index) => value === nextRight[index])
}

export async function GET(request: NextRequest) {
  const admin = await requireAdminAccess()
  if (!admin.authorized) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Shadow diff unavailable' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || '50'), 1), 200)

  const { data, error } = await supabase
    .from('discord_guild_members')
    .select('discord_user_id, linked_user_id')
    .not('linked_user_id', 'is', null)
    .order('last_synced_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const comparisons = await Promise.all(
    (data || []).map(async (row) => {
      const discordUserId = typeof row?.discord_user_id === 'string' ? row.discord_user_id : ''
      const userId = typeof row?.linked_user_id === 'string' ? row.linked_user_id : ''
      if (!discordUserId || !userId) {
        return null
      }

      const subject = await loadAccessControlSubject(supabase, { discordUserId, userId })
      const roleIds = Array.from(new Set([
        ...(subject.discordMember?.discordRoles || []),
        ...(subject.linkedProfile?.discordRoles || []),
      ]))
      const [resources, activeOverrides] = await Promise.all([
        loadAccessControlResources(supabase, roleIds),
        fetchActiveMemberAccessOverrides(supabase, { userId, discordUserId }),
      ])

      const canonical = evaluateMemberAccessFromSubject({
        subject,
        resources,
        activeOverrides,
      })
      const legacyLike = evaluateMemberAccessFromSubject({
        subject: {
          ...subject,
          discordMember: null,
        },
        resources,
        activeOverrides,
      })

      const diffs = {
        has_members_access: canonical.hasMembersAccess !== legacyLike.hasMembersAccess,
        is_admin: canonical.isAdmin !== legacyLike.isAdmin,
        resolved_tier: canonical.resolvedTier !== legacyLike.resolvedTier,
        allowed_tabs: !arraysEqual(canonical.allowedTabs, legacyLike.allowedTabs),
      }

      const hasDiff = Object.values(diffs).some(Boolean)
      return {
        discord_user_id: discordUserId,
        user_id: userId,
        email: canonical.email,
        canonical: {
          has_members_access: canonical.hasMembersAccess,
          is_admin: canonical.isAdmin,
          resolved_tier: canonical.resolvedTier,
          allowed_tabs: canonical.allowedTabs,
          role_source: canonical.sources.roles,
        },
        legacy_profile_path: {
          has_members_access: legacyLike.hasMembersAccess,
          is_admin: legacyLike.isAdmin,
          resolved_tier: legacyLike.resolvedTier,
          allowed_tabs: legacyLike.allowedTabs,
          role_source: legacyLike.sources.roles,
        },
        diffs,
        has_diff: hasDiff,
      }
    }),
  )

  const rows = comparisons.filter((row): row is NonNullable<typeof row> => row !== null)
  const diffRows = rows.filter((row) => row.has_diff)

  return NextResponse.json({
    success: true,
    data: diffRows,
    meta: {
      compared_count: rows.length,
      diff_count: diffRows.length,
      compared_against: 'legacy_profile_role_path',
    },
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
