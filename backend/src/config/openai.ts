import OpenAI from 'openai';
import { getEnv } from './env';

const env = getEnv();

// Create OpenAI client
export const openaiClient = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  timeout: 60000, // 60 second timeout for complex multi-tool prompts
  // SDK-level retry for transient network/5xx OpenAI failures.
  maxRetries: 3,
});

// Test OpenAI connection
export async function testOpenAIConnection(): Promise<boolean> {
  try {
    await openaiClient.models.list();
    return true;
  } catch (error) {
    return false;
  }
}

// Model configuration - all from validated env vars
export const CHAT_MODEL = env.CHAT_MODEL;
export const MAX_TOKENS = env.MAX_TOKENS;
export const TEMPERATURE = env.TEMPERATURE;
export const MAX_TOTAL_TOKENS_PER_REQUEST = env.MAX_TOTAL_TOKENS_PER_REQUEST;
