-- Seed permission for member-initiated coach review requests.

INSERT INTO public.app_permissions (name, description)
VALUES ('flag_for_coach_review', 'Allows member to flag trades for coach review')
ON CONFLICT (name) DO NOTHING;
