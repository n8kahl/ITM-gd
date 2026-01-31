-- Fix RLS on team_members to allow reading
-- The table might have RLS enabled without proper policies

-- Ensure RLS is enabled (idempotent)
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can read team members" ON team_members;
DROP POLICY IF EXISTS "Admins can manage team members" ON team_members;
DROP POLICY IF EXISTS "Service role can manage team members" ON team_members;

-- Allow anyone to read team members (needed for the admin dashboard)
CREATE POLICY "Anyone can read team members"
  ON team_members
  FOR SELECT
  USING (true);

-- Allow authenticated users to update their own record
CREATE POLICY "Users can update own record"
  ON team_members
  FOR UPDATE
  USING (auth.uid() = id);

-- Allow service role (Edge Functions) to do everything
CREATE POLICY "Service role can manage team members"
  ON team_members
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
