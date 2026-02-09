import axios from 'axios';

const DISCORD_MAX_CONTENT_LENGTH = 2000;

function truncateContent(content: string): string {
  if (content.length <= DISCORD_MAX_CONTENT_LENGTH) return content;
  return `${content.slice(0, DISCORD_MAX_CONTENT_LENGTH - 3)}...`;
}

export async function sendDiscordWebhookMessage(
  webhookUrl: string,
  content: string,
): Promise<void> {
  const trimmedWebhook = webhookUrl.trim();
  if (!trimmedWebhook) {
    throw new Error('Discord webhook URL is required');
  }

  const payload = {
    content: truncateContent(content),
  };

  await axios.post(trimmedWebhook, payload, {
    timeout: 5000,
    headers: {
      'Content-Type': 'application/json',
    },
    validateStatus: (status) => status >= 200 && status < 300,
  });
}
