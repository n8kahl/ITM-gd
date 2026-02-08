-- V3 Redesign: Admin-managed Quick Tags for Trade Journal
-- Provides consistent tag vocabulary across all members

CREATE TABLE IF NOT EXISTS journal_quick_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(category, label)
);

-- Seed default tags
INSERT INTO journal_quick_tags (category, label, sort_order) VALUES
  -- Strategy tags
  ('strategy', 'Breakout', 0),
  ('strategy', 'Reversal', 1),
  ('strategy', 'Support Bounce', 2),
  ('strategy', 'Momentum', 3),
  ('strategy', 'Scalp', 4),
  ('strategy', 'Swing', 5),
  ('strategy', 'Gap Fill', 6),
  -- Pattern tags
  ('pattern', 'Double Top', 0),
  ('pattern', 'Double Bottom', 1),
  ('pattern', 'Head & Shoulders', 2),
  ('pattern', 'Triangle', 3),
  ('pattern', 'Flag', 4),
  ('pattern', 'Channel', 5),
  -- Condition tags
  ('condition', 'High Volume', 0),
  ('condition', 'Low Volume', 1),
  ('condition', 'News Catalyst', 2),
  ('condition', 'Earnings', 3),
  ('condition', 'FOMC', 4),
  ('condition', 'Expiration Day', 5)
ON CONFLICT (category, label) DO NOTHING;

-- RLS: all authenticated users can read, admins can write
ALTER TABLE journal_quick_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read quick tags" ON journal_quick_tags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage quick tags" ON journal_quick_tags
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  );

CREATE INDEX idx_quick_tags_category ON journal_quick_tags(category, sort_order);

COMMENT ON TABLE journal_quick_tags IS 'Admin-managed quick tag vocabulary for trade journal entries';
