-- ============================================
-- STEP 2: Update Subscribers Table
-- Run this AFTER Step 1 succeeds
-- ============================================

-- Add tracking columns to subscribers
ALTER TABLE subscribers
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS referral_source TEXT,
ADD COLUMN IF NOT EXISTS session_id TEXT,
ADD COLUMN IF NOT EXISTS twitter_handle TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add policy for subscribers
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow all reads" ON subscribers;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Allow all reads" ON subscribers FOR SELECT USING (true);

-- Verify columns were added
SELECT
  '✅ Step 2 complete! Subscribers table updated.' as status,
  column_name, data_type
FROM information_schema.columns
WHERE table_name = 'subscribers'
AND column_name IN ('created_at', 'referral_source', 'session_id', 'twitter_handle', 'updated_at')
ORDER BY column_name;
