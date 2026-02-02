-- Security Cleanup: Remove Magic Link System
-- This migration removes the insecure admin_access_tokens table
-- and enforces Discord-only authentication for admin access.

-- Drop the admin_access_tokens table and all associated objects
DROP TABLE IF EXISTS admin_access_tokens CASCADE;

-- Drop any related indexes (CASCADE should handle this, but being explicit)
DROP INDEX IF EXISTS idx_admin_tokens_token;
DROP INDEX IF EXISTS idx_admin_tokens_expires;

-- Note: The verify-token API route has been removed from the codebase
-- Note: Middleware has been updated to use Discord auth only
-- Admins must now authenticate via Discord OAuth to access /admin routes
