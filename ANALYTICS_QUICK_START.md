# 🚀 Analytics Dashboard - Quick Start

## ⚡ 3-Step Setup

### 1️⃣ Run SQL Migration
```sql
-- Go to Supabase SQL Editor and run:
-- Copy all contents from supabase-analytics-schema.sql
```

### 2️⃣ Start Dev Server
```bash
npm run dev
```

### 3️⃣ Access Dashboard
1. Go to: http://localhost:3000
2. Scroll to footer
3. Click the ❤️‍🔥 emoji
4. Password: `billions`

---

## 📊 What You Get

### Metrics Tracked:
- ✅ Page views (total & unique visitors)
- ✅ Subscribers (email, phone, socials)
- ✅ Contact form submissions
- ✅ Device breakdown (Desktop/Mobile/Tablet)
- ✅ Browser analytics (Chrome, Safari, etc.)
- ✅ Click tracking (CTAs, pricing cards, nav)
- ✅ Session tracking (new vs returning visitors)

### Dashboard Features:
- 📈 Real-time metrics
- 📊 Beautiful charts (Pie, Bar)
- 📋 Data tables (sortable, searchable)
- 💾 CSV export for all data
- 🎛️ Date range filters (Today, 7d, 30d, All)
- 🔒 Password protected

---

## 🔑 Access Details

**URL**: `/admin/analytics`
**Password**: `billions`
**Emoji**: ❤️‍🔥 (in footer after "Always trade responsibly.")

---

## 📁 Files Created

```
app/admin/analytics/page.tsx         # Dashboard
app/api/analytics/track/route.ts     # Tracking API
components/ui/admin-login-modal.tsx  # Password modal
lib/analytics.ts                     # Tracking utils
supabase-analytics-schema.sql        # Database schema
```

---

## 🛠️ Quick Customization

### Change Password
`components/ui/admin-login-modal.tsx` → Line 11
```typescript
const ADMIN_PASSWORD = "your-new-password"
```

### Add Custom Tracking
```typescript
import { Analytics } from "@/lib/analytics";

Analytics.trackCTAClick('Button Name')
Analytics.trackEvent('event_name', 'value')
```

---

## ✅ Verify It's Working

1. Visit homepage
2. Click around (CTAs, pricing cards)
3. Open subscribe modal
4. Access dashboard (❤️‍🔥 → `billions`)
5. See your activity tracked in real-time!

---

## 🎯 What's Automatically Tracked

- Every page visit ✅
- Device & browser info ✅
- "JOIN NOW" CTA clicks ✅
- Pricing card clicks ✅
- Subscribe modal interactions ✅
- Form submissions ✅
- Session duration ✅

---

**Need help?** Check `ANALYTICS_SETUP_GUIDE.md` for full documentation.
