# Phase 1-3 Testing & Validation Guide

This guide provides step-by-step testing procedures for all implemented features.

---

## 🔧 **Prerequisites**

### 1. Database Setup
```bash
# Apply migrations (if using Supabase CLI)
supabase db reset

# Or apply manually in Supabase Dashboard:
# - 20260301000000_cleanup_security.sql
# - 20260302000000_simple_rbac.sql
# - 20260303000000_journal_full.sql
```

### 2. Environment Variables
Ensure these are set:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
OPENAI_API_KEY=your_openai_key  # For AI analysis
```

### 3. Run Automated Tests
```bash
# Execute the test suite
./scripts/test-rbac.sh

# Or manually:
npx playwright test e2e/rbac-security.spec.ts
```

---

## 🧪 **Testing Checklist**

### **Phase 1: Security Hardening** ✓

#### Test 1.1: Magic Link Removed
- [ ] Navigate to `/api/admin/verify-token?token=test`
- [ ] **Expected:** 404 Not Found
- [ ] **Pass/Fail:** ____

#### Test 1.2: Cookie Bypass Blocked
```bash
# Try setting old admin cookie
document.cookie = "titm_admin=true; path=/"

# Then navigate to /admin
# Expected: Still redirects to /login
```
- [ ] Cookie doesn't grant access
- [ ] **Pass/Fail:** ____

#### Test 1.3: Discord Auth Required
- [ ] Log out completely
- [ ] Try accessing `/admin`
- [ ] **Expected:** Redirect to `/login?redirect=/admin`
- [ ] Log in via Discord
- [ ] **Expected:** Access granted (if admin role)
- [ ] **Pass/Fail:** ____

---

### **Phase 2: Simple RBAC System** ✓

#### Test 2.1: Admin Permissions Page Loads
- [ ] Navigate to `/admin/permissions`
- [ ] **Expected:** See "Role Permissions" heading
- [ ] **Expected:** "Sync Discord Roles" button visible
- [ ] **Pass/Fail:** ____

#### Test 2.2: Discord Role Sync
- [ ] Click "Sync Discord Roles" button
- [ ] **Expected:** Success toast notification
- [ ] **Expected:** Table populates with Discord roles
- [ ] **Expected:** Roles show colored dots
- [ ] **Pass/Fail:** ____

#### Test 2.3: Permission Toggling
- [ ] Check a box (e.g., "Core Sniper" → "dashboard")
- [ ] Wait for success toast
- [ ] Refresh the page
- [ ] **Expected:** Checkbox remains checked
- [ ] **Pass/Fail:** ____

#### Test 2.4: Database Verification
```sql
-- Run in Supabase SQL Editor
SELECT * FROM app_config.role_permissions;

-- Expected: See roles with allowed_tabs arrays
-- Example: {"dashboard", "profile"}
```
- [ ] Table exists in `app_config` schema
- [ ] Roles have `allowed_tabs` array
- [ ] **Pass/Fail:** ____

#### Test 2.5: RPC Function Test
```sql
-- Test the RPC function (replace UUID with real user ID)
SELECT * FROM get_user_allowed_tabs('your-user-uuid');

-- Expected: Returns array of tab IDs
-- Example: {"dashboard", "journal", "library", "profile"}
```
- [ ] Function returns array
- [ ] Tabs match role permissions
- [ ] **Pass/Fail:** ____

---

### **Phase 2: Member Area Integration** ✓

#### Test 2.6: Member Sidebar Filtering
- [ ] Log in as member (non-admin)
- [ ] Navigate to `/members`
- [ ] Check sidebar navigation
- [ ] **Expected:** Only see tabs you have permission for
- [ ] **Pass/Fail:** ____

#### Test 2.7: Debug Panel (Dev Mode Only)
```bash
# Set NODE_ENV=development
# Restart dev server if needed
```
- [ ] Scroll to bottom of member sidebar
- [ ] **Expected:** See "My Allowed Tabs:" section
- [ ] **Expected:** Tabs displayed as green badges
- [ ] **Pass/Fail:** ____

#### Test 2.8: Real-Time Permission Updates
**As Admin:**
- [ ] Go to `/admin/permissions`
- [ ] Remove "journal" permission from your role
- [ ] Save changes

**As Member (same user):**
- [ ] Go to `/members`
- [ ] Click "Sync Roles" button (in user card)
- [ ] Refresh page
- [ ] **Expected:** Journal tab disappears
- [ ] **Pass/Fail:** ____

#### Test 2.9: Cross-Tab Sync
- [ ] Open `/members` in two browser tabs
- [ ] In Tab 1: Click "Sync Roles"
- [ ] **Expected:** Tab 2 updates automatically (via BroadcastChannel)
- [ ] **Pass/Fail:** ____

---

### **Phase 3: Trade Journal Backend** ✓

#### Test 3.1: Database Schema Validation
```sql
-- Check table exists
SELECT * FROM journal_entries LIMIT 1;

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'journal_entries';

-- Expected indexes:
-- - idx_journal_entries_user_id
-- - idx_journal_entries_trade_date
-- - idx_journal_entries_symbol
-- - idx_journal_entries_tags
-- - idx_journal_entries_is_winner
```
- [ ] Table exists
- [ ] All indexes created
- [ ] **Pass/Fail:** ____

#### Test 3.2: RLS Policies Test
```sql
-- As authenticated user, try to insert
INSERT INTO journal_entries (user_id, symbol, direction, entry_price)
VALUES (auth.uid(), 'AAPL', 'long', 150.00);

-- Expected: Success (user owns entry)

-- Try to select another user's data
SELECT * FROM journal_entries WHERE user_id != auth.uid();

-- Expected: Empty result (RLS blocks)
```
- [ ] Can insert own entries
- [ ] Cannot see other users' entries
- [ ] **Pass/Fail:** ____

#### Test 3.3: AI Analysis API Test
```bash
# Test with curl (replace token and image URL)
curl -X POST http://localhost:3000/api/members/journal/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -d '{"imageUrl": "https://example.com/trade-screenshot.png"}'

# Expected Response:
# {
#   "symbol": "SPY",
#   "direction": "long",
#   "entry_price": 450.50,
#   "exit_price": 455.25,
#   "pnl": 475.00,
#   "pnl_percentage": 4.75,
#   "analysis_summary": "Strong bullish trade on SPY..."
# }
```
- [ ] API returns 401 if not authenticated
- [ ] API returns structured JSON
- [ ] Numeric values are numbers (not strings)
- [ ] **Pass/Fail:** ____

#### Test 3.4: Server Actions Test
```typescript
// In browser console on /members page:
const { createEntry } = await import('/app/actions/journal.ts')

const result = await createEntry({
  symbol: 'TSLA',
  direction: 'long',
  entry_price: 200,
  exit_price: 220,
  pnl: 2000,
  is_winner: true
})

console.log(result)
// Expected: { success: true, data: {...} }
```
- [ ] Can create entries
- [ ] Entry saved to database
- [ ] **Pass/Fail:** ____

#### Test 3.5: Journal Stats Function
```sql
-- Test the stats function
SELECT * FROM get_journal_stats(auth.uid());

-- Expected columns:
-- - total_trades
-- - winning_trades
-- - losing_trades
-- - win_rate (percentage)
-- - total_pnl
-- - avg_pnl
-- - best_trade
-- - worst_trade
-- - unique_symbols
-- - last_trade_date
```
- [ ] Function returns stats
- [ ] Win rate calculated correctly
- [ ] **Pass/Fail:** ____

---

## 🐛 **Common Issues & Fixes**

### Issue: "Schema app_config does not exist"
**Fix:**
```sql
-- Run in Supabase SQL Editor
CREATE SCHEMA IF NOT EXISTS app_config;
```

### Issue: "Function get_user_allowed_tabs does not exist"
**Fix:** Re-run migration `20260302000000_simple_rbac.sql`

### Issue: "OpenAI API key not configured"
**Fix:** Add `OPENAI_API_KEY` to `.env.local` and restart dev server

### Issue: "allowedTabs is always empty"
**Fix:**
1. Sync Discord roles in admin panel
2. Assign permissions via checkboxes
3. Click "Sync Roles" in member area

### Issue: "Middleware redirects to login in infinite loop"
**Fix:** Check that Discord OAuth is working and setting `is_admin` in `app_metadata`

---

## ✅ **Success Criteria**

Your system is fully working if:

- ✅ All magic link routes return 404
- ✅ Admin access requires Discord OAuth
- ✅ Permissions matrix loads and syncs
- ✅ Checkboxes update database in real-time
- ✅ Member sidebar filters tabs correctly
- ✅ Debug panel shows allowed tabs
- ✅ Journal table and RLS policies work
- ✅ AI analysis API returns structured data
- ✅ Server Actions create/update/delete entries
- ✅ Stats function returns aggregated data

---

## 📊 **Testing Metrics**

Track your test results:

| Phase | Test | Status | Notes |
|-------|------|--------|-------|
| Phase 1 | Magic Link Removed | ⬜ | |
| Phase 1 | Cookie Bypass Blocked | ⬜ | |
| Phase 1 | Discord Auth Required | ⬜ | |
| Phase 2 | Admin Page Loads | ⬜ | |
| Phase 2 | Discord Sync Works | ⬜ | |
| Phase 2 | Permission Toggling | ⬜ | |
| Phase 2 | Member Sidebar Filtering | ⬜ | |
| Phase 2 | Debug Panel Shows Tabs | ⬜ | |
| Phase 2 | Real-Time Updates | ⬜ | |
| Phase 3 | Database Schema Valid | ⬜ | |
| Phase 3 | RLS Policies Work | ⬜ | |
| Phase 3 | AI Analysis API | ⬜ | |
| Phase 3 | Server Actions | ⬜ | |
| Phase 3 | Stats Function | ⬜ | |

---

## 🎯 **Next Steps After Testing**

Once all tests pass:

1. **Create a Pull Request** for code review
2. **Run in staging environment** if available
3. **Continue to Phase 3 UI** (journal entry form, table, modal)
4. **Continue to Phase 4** (premium dashboard)

---

## 📞 **Need Help?**

If tests fail:
1. Check browser console for errors
2. Check Supabase logs
3. Review migration files
4. Verify environment variables
5. Check Discord role IDs match database

---

**Happy Testing! 🧪**
