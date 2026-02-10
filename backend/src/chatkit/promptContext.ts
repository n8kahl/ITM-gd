import { supabase } from '../config/database';
import { logger } from '../lib/logger';
import { getSystemPrompt } from './systemPrompt';

interface PromptProfile {
  tier?: string;
  experienceLevel?: string;
}

const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const profileCache = new Map<string, { expiresAt: number; profile: PromptProfile }>();

const EXPERIENCE_LEVELS = new Set(['beginner', 'intermediate', 'advanced']);
const TIER_CANONICAL_MAP: Record<string, string> = {
  free: 'free',
  basic: 'basic',
  lite: 'basic',
  pro: 'pro',
  premium: 'premium',
  elite: 'premium',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object') return value as Record<string, unknown>;
  return null;
}

function normalizeExperienceLevel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim().toLowerCase();
  if (EXPERIENCE_LEVELS.has(normalized)) return normalized;
  if (normalized === 'new' || normalized === 'novice') return 'beginner';
  if (normalized === 'expert' || normalized === 'pro') return 'advanced';
  return undefined;
}

function normalizeTier(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return TIER_CANONICAL_MAP[normalized];
}

function extractExperienceLevel(preferences: unknown): string | undefined {
  const record = asRecord(preferences);
  if (!record) return undefined;

  const candidate = record.experienceLevel
    ?? record.experience_level
    ?? record.traderExperience
    ?? record.trader_experience;

  return normalizeExperienceLevel(candidate);
}

async function loadPromptProfile(userId: string): Promise<PromptProfile> {
  const cached = profileCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.profile;
  }

  const { data, error } = await supabase
    .from('ai_coach_users')
    .select('subscription_tier, preferences')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.warn('Failed to load AI Coach user profile for prompt context', {
      userId,
      error: error.message,
    });
    return {};
  }

  const profile: PromptProfile = {
    tier: normalizeTier(data?.subscription_tier),
    experienceLevel: extractExperienceLevel(data?.preferences),
  };

  profileCache.set(userId, {
    expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
    profile,
  });

  return profile;
}

export async function buildSystemPromptForUser(
  userId: string,
  options?: { isMobile?: boolean },
): Promise<string> {
  const profile = await loadPromptProfile(userId);
  return getSystemPrompt({
    tier: profile.tier,
    experienceLevel: profile.experienceLevel,
    isMobile: options?.isMobile === true,
  });
}
