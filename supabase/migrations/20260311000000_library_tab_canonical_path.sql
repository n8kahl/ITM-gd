-- Canonicalize Training Library member tab route to academy namespace.
-- Keep /members/library as a redirect alias only.

update public.tab_configurations
set path = '/members/academy/courses',
    updated_at = timezone('utc', now())
where tab_id = 'library'
  and path <> '/members/academy/courses';
