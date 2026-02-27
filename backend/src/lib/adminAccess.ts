import { supabase } from '../config/database';
import { logger } from './logger';

const DISCORD_PRIVILEGED_ROLE_ID = '1465515598640447662';

type AuthUserLike = {
  app_metadata?: unknown;
  user_metadata?: unknown;
};

function normalizeDiscordRoleIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .map((value) => String(value).trim())
        .filter(Boolean),
    ),
  );
}

function extractDiscordRoleIdsFromAuthUser(user: AuthUserLike | null | undefined): string[] {
  const appMetaRoles = (user?.app_metadata as { discord_roles?: unknown } | undefined)?.discord_roles;
  const appMetaRoleIds = normalizeDiscordRoleIds(appMetaRoles);
  if (appMetaRoleIds.length > 0) return appMetaRoleIds;

  const userMetaRoles = (user?.user_metadata as { discord_roles?: unknown } | undefined)?.discord_roles;
  return normalizeDiscordRoleIds(userMetaRoles);
}

function hasAdminRoleAccess(roleIds: string[]): boolean {
  return roleIds.includes(DISCORD_PRIVILEGED_ROLE_ID);
}

export async function hasBackendAdminAccess(userId: string): Promise<boolean> {
  let roleIds = [] as string[];

  try {
    const { data: authUserResult, error: authUserError } = await supabase.auth.admin.getUserById(userId);
    if (authUserError) {
      logger.warn('Admin access auth-user lookup failed', { userId, error: authUserError.message });
    } else if (authUserResult?.user) {
      const authUser = authUserResult.user;
      if ((authUser.app_metadata as { is_admin?: unknown } | undefined)?.is_admin === true) {
        return true;
      }
      roleIds = extractDiscordRoleIdsFromAuthUser(authUser);
    }
  } catch (error) {
    logger.warn('Admin access auth-user lookup threw', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      logger.warn('Admin access profile-role lookup failed', { userId, error: error.message });
    } else if ((profile as { role?: string } | null)?.role === 'admin') {
      return true;
    }
  } catch (error) {
    logger.warn('Admin access profile-role lookup threw', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const { data: discordProfile, error } = await supabase
      .from('user_discord_profiles')
      .select('discord_roles')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      logger.warn('Admin access Discord-role lookup failed', { userId, error: error.message });
    } else if (discordProfile) {
      roleIds = normalizeDiscordRoleIds((discordProfile as { discord_roles?: unknown }).discord_roles);
    }
  } catch (error) {
    logger.warn('Admin access Discord-role lookup threw', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return hasAdminRoleAccess(roleIds);
}

