import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY environment variable');
}

// Create OpenAI client
export const openaiClient = new OpenAI({
  apiKey: OPENAI_API_KEY
});

// Test OpenAI connection
export async function testOpenAIConnection(): Promise<boolean> {
  try {
    // Simple test: list models
    await openaiClient.models.list();
    return true;
  } catch (error) {
    console.error('OpenAI API connection test failed:', error);
    return false;
  }
}

// Model configuration
export const CHAT_MODEL = 'gpt-4-turbo-preview';
export const MAX_TOKENS = 1000;
export const TEMPERATURE = 0.7;
