-- ============================================
-- ADD YOURSELF AS TEAM MEMBER
-- ============================================
-- Run this in Supabase SQL Editor

-- Step 1: Find your user ID from Supabase Auth
-- Go to Supabase Dashboard → Authentication → Users
-- Find your email and copy the ID

-- Step 2: Run this query (replace YOUR-USER-ID and YOUR-NAME)
INSERT INTO team_members (id, display_name, role, status)
VALUES (
  'YOUR-USER-ID-HERE',  -- Replace with your actual auth user ID
  'YOUR-NAME-HERE',     -- Replace with your name (e.g., 'Nathan')
  'admin',              -- Keep as 'admin' for full access
  'online'              -- Set initial status
)
ON CONFLICT (id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  status = EXCLUDED.status;

-- Step 3: Verify it worked
SELECT * FROM team_members WHERE display_name = 'YOUR-NAME-HERE';

-- ============================================
-- ALTERNATIVE: If you don't have a Supabase Auth user yet
-- ============================================
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add user" → "Create new user"
-- 3. Enter your email and password
-- 4. Click "Create user"
-- 5. Copy the user ID
-- 6. Use that ID in the INSERT query above
