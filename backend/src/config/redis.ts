import { createClient, RedisClientType } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL;

// Redis client - only created if REDIS_URL is configured
let redisClient: RedisClientType | null = null;
let redisAvailable = false;

if (redisUrl) {
  redisClient = createClient({
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

  redisClient.on('error', (err) => console.error('Redis Client Error:', err));
  redisClient.on('connect', () => console.log('Redis Client Connected'));
  redisClient.on('ready', () => {
    console.log('Redis Client Ready');
    redisAvailable = true;
  });
} else {
  console.log('REDIS_URL not set - running without Redis cache');
}

// Connect to Redis (no-op if not configured)
export async function connectRedis(): Promise<void> {
  if (!redisClient) {
    console.log('Redis not configured, skipping connection');
    return;
  }
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}

// Test Redis connection
export async function testRedisConnection(): Promise<boolean> {
  if (!redisClient || !redisAvailable) return false;
  try {
    await redisClient.ping();
    return true;
  } catch (error) {
    console.error('Redis connection test failed:', error);
    return false;
  }
}

// Helper functions for caching - gracefully degrade when Redis unavailable
export async function cacheSet(key: string, value: any, ttlSeconds: number): Promise<void> {
  if (!redisClient || !redisAvailable) return;
  try {
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.error(`Redis cache set failed for key ${key}:`, error);
  }
}

export async function cacheGet<T = any>(key: string): Promise<T | null> {
  if (!redisClient || !redisAvailable) return null;
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error(`Redis cache get failed for key ${key}:`, error);
    return null;
  }
}

export async function cacheDelete(key: string): Promise<void> {
  if (!redisClient || !redisAvailable) return;
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error(`Redis cache delete failed for key ${key}:`, error);
  }
}
