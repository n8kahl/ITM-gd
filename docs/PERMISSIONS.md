# Strategic Permissions Guide

This document outlines the permission structure for Trade In The Money (TITM) platform.

## Overview

The permission system is designed to align with the three-tier pricing model (Core, Pro, Execute) and provide granular control over feature access.

## Permission Categories

### 🎯 Tier-Based Content Access

These permissions control access to tier-specific content:

| Permission | Description | Tier |
|-----------|-------------|------|
| `access_core_content` | Watchlists, day trade setups, alerts, basic education | Core Sniper |
| `access_pro_content` | LEAPS, swing trades, position building, advanced strategy | Pro Sniper |
| `access_execute_content` | Full library, premium tools, maximum insights | Execute Sniper |

**Implementation:**
- Core users get `access_core_content` only
- Pro users get `access_core_content` + `access_pro_content`
- Execute users get all three

### 📊 Feature-Specific Permissions

Control access to specific platform features:

| Permission | Feature |
|-----------|---------|
| `access_trading_journal` | Trading journal to log and track trades |
| `access_ai_analysis` | AI-powered trade analysis and coaching |
| `access_course_library` | Structured courses and educational lessons |
| `access_live_alerts` | Real-time market alerts and notifications |
| `access_community_chat` | Community discussions and chat |

### 💎 Premium Features

Advanced tools and capabilities:

| Permission | Feature |
|-----------|---------|
| `access_premium_tools` | Advanced trading tools and calculators |
| `access_position_builder` | LEAPS and position building tools |
| `access_market_structure` | Advanced market structure analysis |

### 🛠️ Admin Permissions

Platform administration:

| Permission | Capability |
|-----------|-----------|
| `admin_dashboard` | Access admin dashboard and analytics |
| `manage_courses` | Create, edit, delete courses and lessons |
| `manage_members` | Manage users and permissions |
| `manage_settings` | Configure application settings |
| `manage_journal_entries` | View/manage all user journal entries |
| `manage_discord_config` | Configure Discord integration |

## Recommended Permission Sets

### Core Sniper Package
```json
[
  "access_core_content",
  "access_trading_journal",
  "access_course_library",
  "access_live_alerts"
]
```

**Value Proposition:** Foundation for disciplined trading with full market exposure

### Pro Sniper Package
```json
[
  "access_core_content",
  "access_pro_content",
  "access_trading_journal",
  "access_ai_analysis",
  "access_course_library",
  "access_live_alerts",
  "access_position_builder",
  "access_community_chat"
]
```

**Value Proposition:** Scaling beyond day trades with patience and strategy

### Execute Sniper Package
```json
[
  "access_core_content",
  "access_pro_content",
  "access_execute_content",
  "access_trading_journal",
  "access_ai_analysis",
  "access_course_library",
  "access_live_alerts",
  "access_position_builder",
  "access_market_structure",
  "access_premium_tools",
  "access_community_chat"
]
```

**Value Proposition:** Maximum conviction, maximum execution, full platform access

## Implementation Guide

### 1. Assign Permissions to Discord Roles

Navigate to **Admin → Roles** and:

1. Click "Add New Mapping" or use a template
2. Select the Discord role from the dropdown
3. Toggle the appropriate permissions
4. Save the mapping

### 2. Link Pricing Tiers to Discord Roles

Navigate to **Admin → Packages** and:

1. Edit each pricing tier
2. Select the corresponding Discord role
3. Save changes

This creates a direct link: `Pricing Tier → Discord Role → Permissions`

### 3. Sync User Permissions

When users authenticate:
1. System fetches their Discord roles
2. Looks up associated permissions
3. Grants access based on permission checks

### 4. Check Permissions in Code

```typescript
import { checkUserPermission } from '@/lib/permissions'

// Check single permission
const hasAccess = await checkUserPermission(userId, 'access_trading_journal')

// Check multiple permissions (ANY)
const hasAnyAccess = await checkUserPermissions(userId, [
  'access_core_content',
  'access_pro_content'
], 'any')

// Check multiple permissions (ALL)
const hasAllAccess = await checkUserPermissions(userId, [
  'access_trading_journal',
  'access_ai_analysis'
], 'all')
```

### 5. Protect Routes and Components

```typescript
// In page components
export default async function TradingJournalPage() {
  const user = await getCurrentUser()
  const hasAccess = await checkUserPermission(user.id, 'access_trading_journal')

  if (!hasAccess) {
    return <UpgradePrompt requiredTier="core" />
  }

  // Render journal...
}

// In API routes
export async function POST(request: Request) {
  const user = await getAuthUser(request)

  if (!await checkUserPermission(user.id, 'manage_courses')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Handle request...
}
```

## Migration Notes

The `20260206000000_strategic_permissions.sql` migration:
- **Clears** all existing permissions and mappings
- **Inserts** the new strategic permission structure
- **Requires** re-mapping Discord roles to new permissions

⚠️ **Important:** After running this migration, you must:
1. Re-configure all Discord role mappings
2. Test permission checks throughout the application
3. Update any hardcoded permission references

## Gradual Rollout Strategy

If you want to migrate gradually:

1. **Phase 1:** Run migration to create new permissions
2. **Phase 2:** Update Discord role mappings in admin panel
3. **Phase 3:** Update codebase to use new permission names
4. **Phase 4:** Test thoroughly before removing old permission checks

## Support

For questions about the permission system:
- Check existing mappings in Admin → Roles
- Review Discord role assignments
- Check server logs for permission check failures
