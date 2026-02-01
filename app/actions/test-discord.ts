'use server'

interface DiscordTestResult {
  success: boolean
  name?: string
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

    return {
      success: true,
      name: guild.name,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}
