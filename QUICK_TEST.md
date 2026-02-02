# 🚀 Quick Test Checklist (5 minutes)

Run these essential tests to verify the system is working:

## 1️⃣ Security Test (30 seconds)
```bash
# Should return 404
curl http://localhost:3000/api/admin/verify-token?token=test
```
✅ Pass if: 404 response

---

## 2️⃣ Permissions UI Test (1 minute)
1. Visit `/admin/permissions`
2. Click "Sync Discord Roles"
3. Check a box
4. Refresh page - box should stay checked

✅ Pass if: Permissions persist

---

## 3️⃣ Member Tab Filtering (1 minute)
1. Visit `/members` (as non-admin member)
2. Scroll to bottom sidebar (dev mode)
3. Check "My Allowed Tabs" section

✅ Pass if: Shows green badges with tab names

---

## 4️⃣ Database Schema (1 minute)
```sql
-- In Supabase SQL Editor
SELECT COUNT(*) FROM app_config.role_permissions;
SELECT COUNT(*) FROM journal_entries;
```
✅ Pass if: Both queries succeed

---

## 5️⃣ RPC Functions (1 minute)
```sql
-- Test permissions function
SELECT * FROM get_user_allowed_tabs('your-user-id');

-- Test stats function
SELECT * FROM get_journal_stats('your-user-id');
```
✅ Pass if: Both return results (even if empty)

---

## 6️⃣ AI API Health Check (30 seconds)
```bash
# Should return 401 (auth required) not 404
curl -X POST http://localhost:3000/api/members/journal/analyze \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "test"}'
```
✅ Pass if: 401 Unauthorized (route exists)

---

## ✅ All Pass?
**System is ready for full testing!** See `TESTING_GUIDE.md` for comprehensive tests.

## ❌ Something Failed?
Check:
- Migrations applied? `supabase db reset`
- Dev server running? `npm run dev`
- Environment variables set? Check `.env.local`
