BEGIN;

CREATE TABLE public.affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_email TEXT,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'signed_up', 'subscribed', 'churned', 'expired'
  )),

  -- WHOP data
  whop_checkout_id TEXT,
  whop_membership_id TEXT,
  referral_code TEXT NOT NULL,

  -- Earnings
  commission_amount NUMERIC(10,2) DEFAULT 0,
  commission_currency TEXT DEFAULT 'USD',
  commission_paid BOOLEAN DEFAULT false,
  commission_paid_at TIMESTAMPTZ,

  -- Timestamps
  clicked_at TIMESTAMPTZ DEFAULT now(),
  signed_up_at TIMESTAMPTZ,
  subscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_referrals_referrer ON public.affiliate_referrals(referrer_id);
CREATE INDEX idx_referrals_code ON public.affiliate_referrals(referral_code);
CREATE INDEX idx_referrals_status ON public.affiliate_referrals(referrer_id, status);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_affiliate_referrals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_affiliate_referrals_updated_at
  BEFORE UPDATE ON public.affiliate_referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_affiliate_referrals_updated_at();

-- RLS
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own referrals"
  ON public.affiliate_referrals FOR SELECT
  USING (auth.uid() = referrer_id);

CREATE POLICY "Service role manages referrals"
  ON public.affiliate_referrals FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins view all referrals"
  ON public.affiliate_referrals FOR SELECT
  USING ((auth.jwt()->'app_metadata'->>'is_admin')::boolean = true);

COMMENT ON TABLE public.affiliate_referrals IS 'WHOP affiliate referral tracking';

COMMIT;
