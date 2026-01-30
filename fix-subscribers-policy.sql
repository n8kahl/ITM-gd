-- Add INSERT policy for subscribers table
-- This allows anonymous users to subscribe via the form

DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow anonymous inserts" ON subscribers;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Allow anonymous inserts"
ON subscribers
FOR INSERT
WITH CHECK (true);
