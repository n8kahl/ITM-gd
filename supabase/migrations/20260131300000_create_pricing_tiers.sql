-- Create pricing_tiers table for dynamic pricing management
CREATE TABLE IF NOT EXISTS pricing_tiers (
  id TEXT PRIMARY KEY,  -- 'core', 'pro', 'execute'
  name TEXT NOT NULL,
  description TEXT,
  tagline TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  monthly_price TEXT NOT NULL,  -- '$199'
  yearly_price TEXT NOT NULL,   -- '$1,990'
  monthly_link TEXT NOT NULL,   -- Whop checkout URL
  yearly_link TEXT,             -- Whop checkout URL (nullable until created)
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for ordering
CREATE INDEX IF NOT EXISTS idx_pricing_tiers_order ON pricing_tiers(display_order);

-- Enable RLS
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Everyone can read, service_role can write
CREATE POLICY "Public read access for pricing_tiers" ON pricing_tiers
  FOR SELECT USING (true);

CREATE POLICY "Service role write access for pricing_tiers" ON pricing_tiers
  FOR ALL USING (auth.role() = 'service_role');

-- Seed with current hardcoded values from app/page.tsx
INSERT INTO pricing_tiers (id, name, description, tagline, features, monthly_price, yearly_price, monthly_link, yearly_link, display_order)
VALUES
  (
    'core',
    'Core Sniper',
    'For disciplined traders who want full market exposure',
    'Execution focused education',
    '["👀 Morning Watchlist", "🎯 SPX day trade setups", "🔔 High-volume & momentum alerts", "🧠 Educational commentary & trade rationale"]'::jsonb,
    '$199',
    '$1,990',
    'https://whop.com/joined/trade-in-the-money/trade-itm-core-sniper-access-4SyQGbvEQmLlV7/app/',
    NULL,
    1
  ),
  (
    'pro',
    'Pro Sniper',
    'For traders scaling beyond day trades',
    'More patience & strategy, not just speed',
    '["Everything in Core Sniper, plus:", "🧭 LEAPS", "📈 Advanced swing trade strategy", "🧠 Position building logic", "📊 Longer term market structure insight", "🎯 Capital allocation education"]'::jsonb,
    '$299',
    '$2,990',
    'https://whop.com/joined/trade-in-the-money/trade-itm-pro-sniper-access-N4FxB11gG2c5Zm/app/',
    NULL,
    2
  ),
  (
    'execute',
    'Execute Sniper',
    'For serious traders only',
    'Maximum conviction, maximum execution',
    '["Everything in Pro Sniper, plus:", "🔥 Advanced NDX real time alerts (entries & exits)", "🧭 High-conviction LEAPS framework", "🎯 Higher-level trade commentary", "🧠 Risk scaling & portfolio mindset"]'::jsonb,
    '$499',
    '$4,990',
    'https://whop.com/joined/trade-in-the-money/trade-itm-execute-sniper-access-0AoRousnaGeJzN/app/',
    NULL,
    3
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  tagline = EXCLUDED.tagline,
  features = EXCLUDED.features,
  monthly_price = EXCLUDED.monthly_price,
  yearly_price = EXCLUDED.yearly_price,
  monthly_link = EXCLUDED.monthly_link,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();
