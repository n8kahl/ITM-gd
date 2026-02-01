-- Strategic Permissions Migration
-- Replaces generic permissions with tier-aligned, feature-specific permissions

-- 1. Clear existing permissions and mappings
DELETE FROM discord_role_permissions;
DELETE FROM user_permissions;
DELETE FROM app_permissions;

-- 2. Insert strategic permissions aligned with business model
INSERT INTO app_permissions (name, description) VALUES
  -- Tier-based content access
  ('access_core_content', 'Access Core Sniper content (watchlists, day trade setups, alerts, basic education)'),
  ('access_pro_content', 'Access Pro Sniper content (LEAPS, swing trades, position building, advanced strategy)'),
  ('access_execute_content', 'Access Execute Sniper content (full library, premium tools, maximum insights)'),

  -- Feature-specific permissions
  ('access_trading_journal', 'Access trading journal feature to log and track trades'),
  ('access_ai_analysis', 'Access AI-powered trade analysis and coaching feedback'),
  ('access_course_library', 'Access structured courses and educational lessons'),
  ('access_live_alerts', 'Receive live market alerts and notifications'),
  ('access_community_chat', 'Access community chat and discussions'),

  -- Premium features
  ('access_premium_tools', 'Access premium trading tools and calculators'),
  ('access_position_builder', 'Access position building and LEAPS strategy tools'),
  ('access_market_structure', 'Access advanced market structure analysis'),

  -- Admin permissions
  ('admin_dashboard', 'Access admin dashboard and analytics'),
  ('manage_courses', 'Create, edit, and delete courses and lessons'),
  ('manage_members', 'Manage team members and user permissions'),
  ('manage_settings', 'Manage application settings and configurations'),
  ('manage_journal_entries', 'View and manage all user journal entries'),
  ('manage_discord_config', 'Configure Discord bot and role mappings')
ON CONFLICT (name) DO NOTHING;

-- 3. Add helpful comment
COMMENT ON TABLE app_permissions IS 'Strategic permissions aligned with Core/Pro/Execute tier structure and feature access model';
