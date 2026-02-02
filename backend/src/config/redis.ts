import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Redis client
export const redisClient = createClient({
  url: redisUrl,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('Redis reconnection failed after 10 attempts');
        return new Error('Redis reconnection failed');
      }
      return Math.min(retries * 100, 3000);
    }
  }
});

// Error handling
redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('Redis Client Connected'));
redisClient.on('ready', () => console.log('Redis Client Ready'));

// Connect to Redis
export async function connectRedis(): Promise<void> {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}

// Test Redis connection
export async function testRedisConnection(): Promise<boolean> {
  try {
    await connectRedis();
    await redisClient.ping();
    return true;
  } catch (error) {
    console.error('Redis connection test failed:', error);
    return false;
  }
}

// Helper functions for caching
export async function cacheSet(key: string, value: any, ttlSeconds: number): Promise<void> {
  try {
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.error(`Redis cache set failed for key ${key}:`, error);
  }
}

export async function cacheGet(key: string): Promise<any | null> {
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error(`Redis cache get failed for key ${key}:`, error);
    return null;
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error(`Redis cache delete failed for key ${key}:`, error);
  }
}
