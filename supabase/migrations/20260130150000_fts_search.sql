-- Full-Text Search function for knowledge_base table
-- This uses PostgreSQL's built-in FTS capabilities for better semantic matching

-- First, add a tsvector column and index for efficient full-text search
ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS search_vector tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce(question, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(answer, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(context, '')), 'C')
) STORED;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_knowledge_base_search ON knowledge_base USING GIN (search_vector);

-- Create the RPC function for searching knowledge base
CREATE OR REPLACE FUNCTION search_knowledge_base(
  search_query TEXT,
  match_limit INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  category TEXT,
  question TEXT,
  answer TEXT,
  context TEXT,
  image_urls TEXT[],
  priority INT,
  is_active BOOLEAN,
  relevance_score REAL
)
LANGUAGE plpgsql
AS $$
DECLARE
  search_tsquery tsquery;
BEGIN
  -- Convert the search query to a tsquery with prefix matching
  -- This handles phrases and partial words better
  search_tsquery := plainto_tsquery('english', search_query);

  -- If the query is empty after processing, return empty result
  IF search_tsquery IS NULL OR search_tsquery::text = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    kb.id,
    kb.category,
    kb.question,
    kb.answer,
    kb.context,
    kb.image_urls,
    kb.priority,
    kb.is_active,
    ts_rank_cd(kb.search_vector, search_tsquery, 32) AS relevance_score
  FROM knowledge_base kb
  WHERE
    kb.is_active = true
    AND kb.search_vector @@ search_tsquery
  ORDER BY
    ts_rank_cd(kb.search_vector, search_tsquery, 32) DESC,
    kb.priority DESC
  LIMIT match_limit;
END;
$$;

-- Also create a fallback function that uses ILIKE for simple keyword matching
-- This catches cases where FTS doesn't find matches but keywords exist
CREATE OR REPLACE FUNCTION search_knowledge_base_fallback(
  search_query TEXT,
  match_limit INT DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  category TEXT,
  question TEXT,
  answer TEXT,
  context TEXT,
  image_urls TEXT[],
  priority INT,
  is_active BOOLEAN,
  relevance_score REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.category,
    kb.question,
    kb.answer,
    kb.context,
    kb.image_urls,
    kb.priority,
    kb.is_active,
    -- Calculate a simple relevance score based on keyword presence
    (
      CASE WHEN kb.question ILIKE '%' || search_query || '%' THEN 1.0 ELSE 0.0 END +
      CASE WHEN kb.answer ILIKE '%' || search_query || '%' THEN 0.5 ELSE 0.0 END +
      CASE WHEN kb.context ILIKE '%' || search_query || '%' THEN 0.3 ELSE 0.0 END
    )::REAL AS relevance_score
  FROM knowledge_base kb
  WHERE
    kb.is_active = true
    AND (
      kb.question ILIKE '%' || search_query || '%'
      OR kb.answer ILIKE '%' || search_query || '%'
      OR kb.context ILIKE '%' || search_query || '%'
    )
  ORDER BY
    relevance_score DESC,
    kb.priority DESC
  LIMIT match_limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION search_knowledge_base(TEXT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION search_knowledge_base_fallback(TEXT, INT) TO anon, authenticated;
