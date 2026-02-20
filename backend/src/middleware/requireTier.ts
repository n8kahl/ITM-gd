import { NextFunction, Request, Response } from 'express';
import { supabase } from '../config/database';
import { logger } from '../lib/logger';

type MembershipTier = 'core' | 'pro' | 'executive';

const USER_TIER_CACHE_TTL_MS = 5 * 60 * 1000;
const tierCache = new Map<string, { tier: MembershipTier; expiresAt: number }>();

const TIER_RANK: Record<MembershipTier, number> = {
  core: 1,
  pro: 2,
  executive: 3,
};

const TIER_ALIAS_MAP: Record<string, MembershipTier> = {
  free: 'core',
  basic: 'core',
  core: 'core',
  lite: 'core',
  pro: 'pro',
  premium: 'pro',
  execute: 'executive',
  executive: 'executive',
  elite: 'executive',
};

const PRO_PERMISSION_NAMES = new Set([
  'access_pro_content',
  'access_premium_tools',
  'access_position_builder',
  'access_market_structure',
]);

const EXECUTIVE_PERMISSION_NAMES = new Set([
  'access_executive_content',
]);

const CORE_PERMISSION_NAMES = new Set([
  'access_core_content',
]);

function normalizeTier(value: unknown): MembershipTier | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return TIER_ALIAS_MAP[normalized] ?? null;
}

function highestRequiredTier(tiers: string[]): MembershipTier {
  const normalized = tiers
    .map((tier) => normalizeTier(tier))
    .filter((tier): tier is MembershipTier => tier !== null);

  if (normalized.length === 0) {
    return 'pro';
  }

  return normalized.reduce<MembershipTier>((highest, tier) => (
    TIER_RANK[tier] > TIER_RANK[highest] ? tier : highest
  ), normalized[0]);
}

function getTierLabel(tier: MembershipTier): string {
  if (tier === 'executive') return 'Executive';
  if (tier === 'pro') return 'Pro';
  return 'Core';
}

function extractPermissionName(permission: unknown): string | null {
  if (!permission || typeof permission !== 'object') return null;

  const asRecord = permission as Record<string, unknown>;
  if (typeof asRecord.name === 'string') {
    return asRecord.name;
  }

  return null;
}

async function resolveTierFromPermissions(userId: string): Promise<MembershipTier | null> {
  const { data, error } = await supabase
    .from('user_permissions')
    .select('expires_at, app_permissions(name)')
    .eq('user_id', userId)
    .limit(200);

  if (error) {
    logger.warn('Tier lookup failed from user_permissions', {
      userId,
      error: error.message,
    });
    return null;
  }

  const nowMs = Date.now();
  const permissionNames = new Set<string>();

  for (const row of data || []) {
    const expiresAt = typeof row.expires_at === 'string' ? Date.parse(row.expires_at) : null;
    if (expiresAt && expiresAt <= nowMs) {
      continue;
    }

    const relation = (row as any).app_permissions;
    if (Array.isArray(relation)) {
      for (const item of relation) {
        const name = extractPermissionName(item);
        if (name) permissionNames.add(name);
      }
      continue;
    }

    const name = extractPermissionName(relation);
    if (name) permissionNames.add(name);
  }

  if (Array.from(EXECUTIVE_PERMISSION_NAMES).some((name) => permissionNames.has(name))) {
    return 'executive';
  }

  if (Array.from(PRO_PERMISSION_NAMES).some((name) => permissionNames.has(name))) {
    return 'pro';
  }

  if (Array.from(CORE_PERMISSION_NAMES).some((name) => permissionNames.has(name))) {
    return 'core';
  }

  if (permissionNames.size > 0) {
    return 'core';
  }

  return null;
}

async function resolveTierFromAICoachProfile(userId: string): Promise<MembershipTier | null> {
  const { data, error } = await supabase
    .from('ai_coach_users')
    .select('subscription_tier')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.warn('Tier lookup failed from ai_coach_users', {
      userId,
      error: error.message,
    });
    return null;
  }

  return normalizeTier(data?.subscription_tier);
}

async function resolveUserTier(userId: string): Promise<MembershipTier> {
  const fromPermissions = await resolveTierFromPermissions(userId);
  if (fromPermissions) return fromPermissions;

  const fromCoachProfile = await resolveTierFromAICoachProfile(userId);
  if (fromCoachProfile) return fromCoachProfile;

  return 'core';
}

/**
 * Clears in-memory tier cache. Intended for tests.
 */
export function clearTierCacheForTests(): void {
  tierCache.clear();
}

/**
 * Resolves the current membership tier for a user with a 5-minute in-memory cache.
 */
export async function getCachedUserTier(userId: string): Promise<MembershipTier> {
  const cached = tierCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tier;
  }

  const tier = await resolveUserTier(userId);
  tierCache.set(userId, {
    tier,
    expiresAt: Date.now() + USER_TIER_CACHE_TTL_MS,
  });

  return tier;
}

/**
 * Checks whether a user's membership tier satisfies at least one required tier.
 */
export async function hasRequiredTierForUser(
  userId: string,
  requiredTiers: string[],
): Promise<boolean> {
  const requiredTier = highestRequiredTier(requiredTiers);
  const userTier = await getCachedUserTier(userId);
  return TIER_RANK[userTier] >= TIER_RANK[requiredTier];
}

/**
 * Enforces membership tier access for premium endpoints.
 */
export function requireTier(...tiers: string[]) {
  const requiredTier = highestRequiredTier(tiers);
  const tierLabel = getTierLabel(requiredTier);

  return async function requireTierMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (!req.user?.id) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
      return;
    }

    try {
      const userTier = await getCachedUserTier(req.user.id);

      if (TIER_RANK[userTier] < TIER_RANK[requiredTier]) {
        res.status(403).json({
          error: `This feature requires a ${tierLabel} subscription`,
          requiredTier,
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Tier check failed', {
        userId: req.user.id,
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(503).json({
        error: 'Subscription verification unavailable',
        message: 'Unable to verify subscription tier. Please try again shortly.',
      });
    }
  };
}
