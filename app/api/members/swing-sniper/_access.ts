import { NextResponse } from 'next/server'
import { createServerSupabaseClient, isAdminUser } from '@/lib/supabase-server'
import { normalizeDiscordRoleIds } from '@/lib/discord-role-access'

const SWING_SNIPER_LEAD_ROLE_ID = '1465515598640447662'

function jsonNoStore(payload: Record<string, unknown>, status: number) {
  return NextResponse.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

export async function authorizeSwingSniperMemberRequest(): Promise<NextResponse | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return jsonNoStore(
      {
        success: false,
        error: 'Unauthorized',
      },
      401,
    )
  }

  const isAdmin = await isAdminUser()
  if (isAdmin) {
    return null
  }

  const jwtRoleIds = normalizeDiscordRoleIds(
    (user.app_metadata as { discord_roles?: unknown } | undefined)?.discord_roles,
  )

  let roleIds = jwtRoleIds
  try {
    const { data: profile } = await supabase
      .from('user_discord_profiles')
      .select('discord_roles')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profile) {
      roleIds = normalizeDiscordRoleIds((profile as { discord_roles?: unknown }).discord_roles)
    }
  } catch {
    // Fall back to JWT role claims when profile lookup is unavailable.
  }

  const isLead = roleIds.includes(SWING_SNIPER_LEAD_ROLE_ID)
  if (isLead) {
    return null
  }

  return jsonNoStore(
    {
      success: false,
      error: 'Forbidden',
    },
    403,
  )
}
