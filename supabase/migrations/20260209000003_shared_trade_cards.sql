-- V3 Redesign: Shared Trade Cards for Social Sharing
-- Enables verified trade cards with market data overlays

CREATE TABLE IF NOT EXISTS shared_trade_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  template TEXT NOT NULL DEFAULT 'dark-elite',
  card_config JSONB NOT NULL DEFAULT '{}',
  image_url TEXT,
  share_platform TEXT,
  shared_at TIMESTAMPTZ DEFAULT now(),
  is_public BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  likes_count INTEGER DEFAULT 0,

  CONSTRAINT valid_template CHECK (template IN (
    'dark-elite', 'emerald-gradient', 'champagne-premium', 'minimal', 'story'
  ))
);

CREATE INDEX idx_shared_cards_user ON shared_trade_cards(user_id);
CREATE INDEX idx_shared_cards_public ON shared_trade_cards(is_public, shared_at DESC);
CREATE INDEX idx_shared_cards_featured ON shared_trade_cards(is_featured, shared_at DESC)
  WHERE is_featured = true;

-- RLS
ALTER TABLE shared_trade_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own trade cards" ON shared_trade_cards
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public trade cards readable by all" ON shared_trade_cards
  FOR SELECT USING (is_public = true);

CREATE POLICY "Admins manage all trade cards" ON shared_trade_cards
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
  );

COMMENT ON TABLE shared_trade_cards IS 'Social sharing trade cards with verified market data overlays';
