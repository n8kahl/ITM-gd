-- Fast Discord user ID -> auth user lookup used by admin membership debugger.
-- Avoids bounded auth user list scans for larger user populations.

CREATE OR REPLACE FUNCTION public.find_user_id_by_discord_user_id(target_discord_user_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized_discord_user_id text;
  resolved_user_id uuid;
BEGIN
  normalized_discord_user_id := nullif(trim(target_discord_user_id), '');
  IF normalized_discord_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Fast path: cached profile table.
  SELECT udp.user_id
  INTO resolved_user_id
  FROM public.user_discord_profiles udp
  WHERE udp.discord_user_id = normalized_discord_user_id
  LIMIT 1;

  IF resolved_user_id IS NOT NULL THEN
    RETURN resolved_user_id;
  END IF;

  -- Fallback 1: auth identities for Discord provider linkage.
  SELECT i.user_id
  INTO resolved_user_id
  FROM auth.identities i
  WHERE i.provider = 'discord'
    AND (
      coalesce(i.provider_id, '') = normalized_discord_user_id
      OR coalesce(i.identity_data->>'provider_id', '') = normalized_discord_user_id
      OR coalesce(i.identity_data->>'sub', '') = normalized_discord_user_id
    )
  ORDER BY i.last_sign_in_at DESC NULLS LAST, i.created_at DESC
  LIMIT 1;

  IF resolved_user_id IS NOT NULL THEN
    RETURN resolved_user_id;
  END IF;

  -- Fallback 2: auth metadata fields.
  SELECT u.id
  INTO resolved_user_id
  FROM auth.users u
  WHERE
    coalesce(u.raw_app_meta_data->>'discord_user_id', '') = normalized_discord_user_id
    OR coalesce(u.raw_user_meta_data->>'discord_user_id', '') = normalized_discord_user_id
    OR coalesce(u.raw_user_meta_data->>'provider_id', '') = normalized_discord_user_id
    OR coalesce(u.raw_user_meta_data->>'sub', '') = normalized_discord_user_id
  ORDER BY u.last_sign_in_at DESC NULLS LAST, u.created_at DESC
  LIMIT 1;

  RETURN resolved_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.find_user_id_by_discord_user_id(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_user_id_by_discord_user_id(text) FROM anon;
REVOKE ALL ON FUNCTION public.find_user_id_by_discord_user_id(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_discord_user_id(text) TO service_role;
