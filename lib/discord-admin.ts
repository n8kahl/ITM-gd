import { createClient } from '@supabase/supabase-js'

const DISCORD_API_BASE = 'https://discord.com/api/v10'

export interface DiscordRole {
  id: string
  name: string
  color: number
  position: number
  permissions: string
  managed: boolean
  mentionable: boolean
}

async function upsertDiscordRoleCatalog(
  supabase: ReturnType<typeof createClient>,
  roles: DiscordRole[],
): Promise<void> {
  if (roles.length === 0) return

  const nowIso = new Date().toISOString()
  const payload = roles.map((role) => ({
    discord_role_id: role.id,
    discord_role_name: role.name,
    role_color: role.color || null,
    position: role.position,
    managed: role.managed,
    mentionable: role.mentionable,
    last_synced_at: nowIso,
    updated_at: nowIso,
  }))

  const { error } = await supabase
    .from('discord_guild_roles')
    .upsert(payload, { onConflict: 'discord_role_id' })

  if (error) {
    console.warn('[discord-admin] Failed to upsert discord role catalog:', error.message)
  }
}

export async function getDiscordGuildRoles(): Promise<DiscordRole[]> {
  // 1. Initialize Supabase Admin to get secrets
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 2. Fetch credentials securely
  const { data: settings } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['discord_bot_token', 'discord_guild_id'])

  const botToken = settings?.find(s => s.key === 'discord_bot_token')?.value
  const guildId = settings?.find(s => s.key === 'discord_guild_id')?.value

  if (!botToken || !guildId) {
    throw new Error('Discord configuration missing. Please check Settings.')
  }

  // 3. Fetch from Discord API
  const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/roles`, {
    headers: {
      Authorization: `Bot ${botToken}`,
    },
    next: { revalidate: 60 } // Cache for 60 seconds
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to fetch Discord roles: ${response.status} ${errorText}`)
  }

  const roles: DiscordRole[] = await response.json()
  await upsertDiscordRoleCatalog(supabase, roles)

  // Filter out the @everyone role and managed roles (bots) if desired
  return roles
    .filter(r => r.name !== '@everyone')
    .sort((a, b) => b.position - a.position) // Sort by hierarchy
}
