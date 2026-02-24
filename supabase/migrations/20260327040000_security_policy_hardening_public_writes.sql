-- Phase 18+ security hardening
-- Remove unsafe public write access on sensitive tables and tighten admin-only reads.

-- =========================
-- team_members
-- =========================
DROP POLICY IF EXISTS "Public can insert team members" ON public.team_members;
DROP POLICY IF EXISTS "Public can update team members" ON public.team_members;
DROP POLICY IF EXISTS "Public can delete team members" ON public.team_members;
DROP POLICY IF EXISTS "Service role can manage team members" ON public.team_members;
DROP POLICY IF EXISTS "Admins can manage team members" ON public.team_members;

CREATE POLICY "Service role can manage team members"
  ON public.team_members
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can manage team members"
  ON public.team_members
  FOR ALL
  TO authenticated
  USING (COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
  WITH CHECK (COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

-- =========================
-- push_subscriptions
-- =========================
DROP POLICY IF EXISTS "Public can manage push subscriptions" ON public.push_subscriptions;

-- =========================
-- cohort_applications
-- =========================
DROP POLICY IF EXISTS "Allow authenticated read" ON public.cohort_applications;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.cohort_applications;
DROP POLICY IF EXISTS "Allow anon insert" ON public.cohort_applications;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.cohort_applications;

CREATE POLICY "Allow authenticated read"
  ON public.cohort_applications
  FOR SELECT
  TO authenticated
  USING (COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

CREATE POLICY "Allow authenticated update"
  ON public.cohort_applications
  FOR UPDATE
  TO authenticated
  USING (COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false))
  WITH CHECK (COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

CREATE POLICY "Allow anon insert"
  ON public.cohort_applications
  FOR INSERT
  TO anon
  WITH CHECK (
    COALESCE(length(btrim(name)), 0) >= 2
    AND COALESCE(length(btrim(email)), 0) >= 5
    AND position('@' IN email) > 1
    AND COALESCE(length(btrim(message)), 0) >= 5
  );

CREATE POLICY "Allow authenticated insert"
  ON public.cohort_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE(length(btrim(name)), 0) >= 2
    AND COALESCE(length(btrim(email)), 0) >= 5
    AND position('@' IN email) > 1
    AND COALESCE(length(btrim(message)), 0) >= 5
  );

-- =========================
-- contact_submissions
-- =========================
DROP POLICY IF EXISTS "Allow all reads" ON public.contact_submissions;
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.contact_submissions;
DROP POLICY IF EXISTS "Allow admin reads" ON public.contact_submissions;

CREATE POLICY "Allow admin reads"
  ON public.contact_submissions
  FOR SELECT
  TO authenticated
  USING (COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

CREATE POLICY "Allow anonymous inserts"
  ON public.contact_submissions
  FOR INSERT
  TO public
  WITH CHECK (
    COALESCE(length(btrim(name)), 0) >= 2
    AND COALESCE(length(btrim(email)), 0) >= 5
    AND position('@' IN email) > 1
    AND COALESCE(length(btrim(message)), 0) >= 5
  );

-- =========================
-- subscribers
-- =========================
DROP POLICY IF EXISTS "Allow all reads" ON public.subscribers;
DROP POLICY IF EXISTS "Allow public select on subscribers" ON public.subscribers;
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.subscribers;
DROP POLICY IF EXISTS "Allow public insert on subscribers" ON public.subscribers;
DROP POLICY IF EXISTS "Allow admin reads" ON public.subscribers;

CREATE POLICY "Allow admin reads"
  ON public.subscribers
  FOR SELECT
  TO authenticated
  USING (COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false));

CREATE POLICY "Allow anonymous inserts"
  ON public.subscribers
  FOR INSERT
  TO public
  WITH CHECK (
    COALESCE(length(btrim(name)), 0) >= 1
    AND COALESCE(length(btrim(email)), 0) >= 5
    AND position('@' IN email) > 1
  );
