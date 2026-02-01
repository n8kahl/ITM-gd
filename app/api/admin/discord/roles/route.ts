import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getDiscordGuildRoles } from '@/lib/discord-admin'

export async function GET() {
  const cookieStore = await cookies()
  const adminCookie = cookieStore.get('titm_admin')

  if (adminCookie?.value !== 'true') {
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
