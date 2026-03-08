'use server'

interface DiscordTestResult {
  success: boolean
  name?: string
  details?: string
  error?: string
}

export async function testDiscordConnection(
  botToken: string,
  guildId: string
): Promise<DiscordTestResult> {
  if (!botToken || !guildId) {
    return {
      success: false,
      error: 'Bot token and Guild ID are required',
    }
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))

      if (response.status === 401) {
        return {
          success: false,
          error: 'Invalid bot token',
        }
      }

      if (response.status === 404) {
        return {
          success: false,
          error: 'Guild not found or bot is not a member',
        }
      }

      return {
        success: false,
        error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const guild = await response.json()

    // Validate that bot can access the guild member endpoint used by role sync.
    // A 404 here is acceptable (dummy user not found) and proves endpoint access.
    const memberProbe = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/0`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      }
    )

    if (memberProbe.status === 401) {
      return {
        success: false,
        error: 'Invalid bot token',
      }
    }

    if (memberProbe.status === 403) {
      const errorData = await memberProbe.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.message || 'Bot cannot access guild member endpoint. Enable required intents/permissions.',
      }
    }

    return {
      success: true,
      name: guild.name,
      details: memberProbe.status === 404
        ? 'Guild access verified. Member endpoint probe passed (expected 404 for dummy user).'
        : `Guild access verified. Member endpoint responded with HTTP ${memberProbe.status}.`,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}
