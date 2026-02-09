import axios from 'axios';
import { sendDiscordWebhookMessage } from '../discordNotifier';

jest.mock('axios');

describe('discordNotifier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (axios.post as jest.Mock).mockResolvedValue({ status: 204 });
  });

  it('throws when webhook URL is missing', async () => {
    await expect(sendDiscordWebhookMessage('   ', 'hello')).rejects.toThrow(
      'Discord webhook URL is required',
    );
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('posts webhook payload for valid input', async () => {
    await sendDiscordWebhookMessage('https://discord.com/api/webhooks/test', 'hello');

    expect(axios.post).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/test',
      { content: 'hello' },
      expect.objectContaining({
        timeout: 5000,
      }),
    );
  });

  it('truncates oversized Discord content to 2000 characters', async () => {
    const oversized = 'a'.repeat(2100);
    await sendDiscordWebhookMessage('https://discord.com/api/webhooks/test', oversized);

    expect(axios.post).toHaveBeenCalledTimes(1);
    const payload = (axios.post as jest.Mock).mock.calls[0][1] as { content: string };
    expect(payload.content.length).toBeLessThanOrEqual(2000);
    expect(payload.content.endsWith('...')).toBe(true);
  });
});
