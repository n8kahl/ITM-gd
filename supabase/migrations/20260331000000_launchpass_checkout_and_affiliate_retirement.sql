BEGIN;

UPDATE public.pricing_tiers
SET
  monthly_link = CASE id
    WHEN 'core' THEN 'https://www.launchpass.com/tradeitm/core-sniper'
    WHEN 'pro' THEN 'https://www.launchpass.com/tradeitm/pro-sniper'
    WHEN 'executive' THEN 'https://www.launchpass.com/tradeitm/executive-sniper'
    WHEN 'execute' THEN 'https://www.launchpass.com/tradeitm/executive-sniper'
    ELSE monthly_link
  END,
  updated_at = now()
WHERE id IN ('core', 'pro', 'executive', 'execute');

DO $$
BEGIN
  IF to_regclass('public.knowledge_base') IS NOT NULL THEN
    DELETE FROM public.knowledge_base
    WHERE category = 'affiliate';

    ALTER TABLE public.knowledge_base
      DROP CONSTRAINT IF EXISTS knowledge_base_category_check;

    ALTER TABLE public.knowledge_base
      ADD CONSTRAINT knowledge_base_category_check
      CHECK (category IN ('pricing', 'features', 'proof', 'faq', 'technical', 'escalation', 'mentorship'));
  END IF;
END $$;

ALTER TABLE IF EXISTS public.member_profiles
  DROP COLUMN IF EXISTS whop_affiliate_url;

DROP TABLE IF EXISTS public.affiliate_referrals CASCADE;
DROP FUNCTION IF EXISTS public.update_affiliate_referrals_updated_at();

COMMIT;
