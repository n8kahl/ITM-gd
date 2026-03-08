import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  hasMembersAreaAccess,
  normalizeDiscordRoleIds,
  resolveMembersAllowedRoleIds,
} from '@/lib/discord-role-access'

type SyncStatus = 'SYNCED' | 'NOT_MEMBER' | 'NO_MEMBERSHIP_ROLE' | 'SYNC_FAILED'

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const [{ data: sessionResult, error: sessionError }, { data: userResult, error: userError }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser(),
    ])

    const session = sessionResult.session
    const user = userResult.user

    if (sessionError || userError || !session || !user) {
      return NextResponse.json(
        {
          success: false,
          status: 'SYNC_FAILED' as SyncStatus,
          error: 'Authentication required',
        },
        { status: 401 },
      )
    }

    const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-discord-roles`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    })

    const syncPayload = await syncResponse.json().catch(() => null)

    if (!syncResponse.ok || !syncPayload?.success) {
      const code = syncPayload?.code
      const status: SyncStatus = code === 'NOT_MEMBER' ? 'NOT_MEMBER' : 'SYNC_FAILED'
      const message = code === 'NOT_MEMBER'
        ? 'Your Discord account is not currently a member of the configured Discord server.'
        : (syncPayload?.error || 'Discord role sync failed')

      return NextResponse.json(
        {
          success: false,
          status,
          code,
          error: message,
        },
        { status: code === 'NOT_MEMBER' ? 403 : 500 },
      )
    }

    const roleIds = normalizeDiscordRoleIds(
      Array.isArray(syncPayload.roles)
        ? syncPayload.roles.map((role: any) => role?.id)
        : [],
    )

    const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      )
      : null

    const membersAllowedRoleIds = await resolveMembersAllowedRoleIds({
      supabase: supabaseAdmin || supabase,
    })

    const hasMembersRole = hasMembersAreaAccess(roleIds, membersAllowedRoleIds)

    if (!hasMembersRole) {
      return NextResponse.json(
        {
          success: false,
          status: 'NO_MEMBERSHIP_ROLE' as SyncStatus,
          error: 'Discord sync succeeded, but your account does not have a qualifying membership role yet.',
          role_ids: roleIds,
          members_allowed_role_ids: membersAllowedRoleIds,
        },
        { status: 403 },
      )
    }

    return NextResponse.json({
      success: true,
      status: 'SYNCED' as SyncStatus,
      role_ids: roleIds,
      members_allowed_role_ids: membersAllowedRoleIds,
      synced_at: syncPayload?.synced_at || new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        status: 'SYNC_FAILED' as SyncStatus,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    )
  }
}
