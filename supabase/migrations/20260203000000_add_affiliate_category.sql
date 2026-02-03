-- Add 'affiliate' category to knowledge_base
-- This allows creating knowledge base entries for affiliate program questions

-- Update the category constraint to include 'affiliate'
ALTER TABLE knowledge_base DROP CONSTRAINT IF EXISTS knowledge_base_category_check;
ALTER TABLE knowledge_base ADD CONSTRAINT knowledge_base_category_check
  CHECK (category IN ('pricing', 'features', 'proof', 'faq', 'technical', 'escalation', 'mentorship', 'affiliate'));
