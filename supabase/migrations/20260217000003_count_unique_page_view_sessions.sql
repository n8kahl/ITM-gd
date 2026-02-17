-- Accurate distinct visitor counting for admin analytics period filters.

CREATE OR REPLACE FUNCTION public.count_unique_page_view_sessions(
  p_start TIMESTAMPTZ DEFAULT NULL,
  p_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT pv.session_id)::BIGINT
  FROM public.page_views pv
  WHERE pv.session_id IS NOT NULL
    AND (p_start IS NULL OR pv.created_at >= p_start)
    AND (p_end IS NULL OR pv.created_at <= p_end);
$$;

GRANT EXECUTE ON FUNCTION public.count_unique_page_view_sessions(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
