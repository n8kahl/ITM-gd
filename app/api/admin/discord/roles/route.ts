import { NextResponse } from 'next/server'
import { getDiscordGuildRoles } from '@/lib/discord-admin'
import { isAdminUser } from '@/lib/supabase-server'

export async function GET() {
  const hasAccess = await isAdminUser()

  if (!hasAccess) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const roles = await getDiscordGuildRoles()
    return NextResponse.json({ success: true, roles })
  } catch (error) {
    console.error('Discord Role Fetch Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch roles' },
      { status: 500 }
    )
  }
}
