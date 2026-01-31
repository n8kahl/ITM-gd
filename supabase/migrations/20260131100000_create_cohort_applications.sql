-- Create cohort_applications table for tracking Precision Cohort application status
-- This table tracks the workflow status of mentorship program applications

CREATE TABLE IF NOT EXISTS cohort_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_submission_id UUID REFERENCES contact_submissions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'contacted')),
  notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for status filtering (common query pattern)
CREATE INDEX IF NOT EXISTS idx_cohort_applications_status ON cohort_applications(status);

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_cohort_applications_email ON cohort_applications(email);

-- Enable Row Level Security
ALTER TABLE cohort_applications ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read applications
CREATE POLICY "Allow authenticated read" ON cohort_applications
  FOR SELECT TO authenticated USING (true);

-- Policy: Allow authenticated users to insert applications
CREATE POLICY "Allow authenticated insert" ON cohort_applications
  FOR INSERT TO authenticated WITH CHECK (true);

-- Policy: Allow authenticated users to update applications
CREATE POLICY "Allow authenticated update" ON cohort_applications
  FOR UPDATE TO authenticated USING (true);

-- Policy: Allow anon users to insert (for public form submissions)
CREATE POLICY "Allow anon insert" ON cohort_applications
  FOR INSERT TO anon WITH CHECK (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cohort_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cohort_applications_updated_at
  BEFORE UPDATE ON cohort_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_cohort_applications_updated_at();
