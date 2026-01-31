-- Upgrade contact_submissions table to support rich applications
-- This migration adds submission_type and metadata columns

-- Step 1: Add submission_type column with default 'contact'
ALTER TABLE contact_submissions
ADD COLUMN IF NOT EXISTS submission_type TEXT DEFAULT 'contact';

-- Step 2: Add metadata JSONB column for storing application details
ALTER TABLE contact_submissions
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Step 3: Add constraint for valid submission types
ALTER TABLE contact_submissions
DROP CONSTRAINT IF EXISTS contact_submissions_type_check;

ALTER TABLE contact_submissions
ADD CONSTRAINT contact_submissions_type_check
CHECK (submission_type IN ('contact', 'cohort_application', 'general_inquiry'));

-- Step 4: Create index for filtering by submission type
CREATE INDEX IF NOT EXISTS idx_contact_submissions_type
ON contact_submissions(submission_type);

-- Step 5: Create GIN index for metadata JSONB queries
CREATE INDEX IF NOT EXISTS idx_contact_submissions_metadata
ON contact_submissions USING GIN (metadata);

-- Step 6: Update existing cohort_applications references
-- Add a column to link back to contact_submissions if needed
ALTER TABLE cohort_applications
ADD COLUMN IF NOT EXISTS contact_submission_id UUID REFERENCES contact_submissions(id) ON DELETE SET NULL;
