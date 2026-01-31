-- Sync any auth users that don't have corresponding team_members records
-- This is a one-time fix for users created directly in Supabase Auth dashboard

INSERT INTO team_members (id, display_name, role, status, created_at, last_seen_at)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'display_name', split_part(au.email, '@', 1)),
  'agent',
  'offline',
  au.created_at,
  NOW()
FROM auth.users au
LEFT JOIN team_members tm ON au.id = tm.id
WHERE tm.id IS NULL
ON CONFLICT (id) DO NOTHING;
