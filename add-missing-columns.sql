-- Add missing columns to subscribers table
ALTER TABLE subscribers
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS instagram_handle TEXT;

-- Make name NOT NULL after adding it (with a default for existing rows)
UPDATE subscribers SET name = 'Unknown' WHERE name IS NULL;
ALTER TABLE subscribers ALTER COLUMN name SET NOT NULL;
