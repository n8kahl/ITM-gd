# Trade ITM Admin Backend System
## Comprehensive Development Plan & Claude Code Prompts

---

## Executive Summary

This document outlines the complete development plan for building a comprehensive admin backend system for the Trade In The Money landing page. The system will allow your admin to easily update all content including colors, text, images, testimonials, pricing packages, and links through a secure, password-protected interface.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Schema Design](#2-data-schema-design)
3. [File Structure](#3-file-structure)
4. [Implementation Phases](#4-implementation-phases)
5. [Claude Code Prompts](#5-claude-code-prompts)
6. [Security Considerations](#6-security-considerations)
7. [Deployment Notes](#7-deployment-notes)

---

## 1. Architecture Overview

### Technology Stack
- **Framework**: Next.js 16 (App Router)
- **Database**: JSON file-based storage (simple, no external DB needed)
- **Authentication**: Simple password protection with session cookies
- **Image Storage**: Local `/public/uploads/` directory
- **State Management**: React Server Components + Client Components where needed

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        PUBLIC WEBSITE                           │
│  (Reads from siteConfig.json - no database queries needed)      │
└─────────────────────────────────────────────────────────────────┘
                                ▲
                                │ Reads
                                │
┌─────────────────────────────────────────────────────────────────┐
│                      siteConfig.json                            │
│  (Single source of truth for all editable content)              │
└─────────────────────────────────────────────────────────────────┘
                                ▲
                                │ Writes
                                │
┌─────────────────────────────────────────────────────────────────┐
│                       ADMIN BACKEND                             │
│  /admin/* routes (Password: "fancy")                            │
│  - Dashboard                                                    │
│  - Content Editors                                              │
│  - Media Manager                                                │
│  - Settings                                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Schema Design

### Master Configuration File: `data/siteConfig.json`

```json
{
  "meta": {
    "lastUpdated": "2026-01-28T12:00:00Z",
    "version": "1.0.0"
  },

  "seo": {
    "title": "Trade In The Money - Premium Trading Signals & Education",
    "description": "Join the elite trading community. Get real-time signals...",
    "ogTitle": "Trade In The Money - Premium Trading Signals",
    "ogDescription": "3 Guaranteed 100%+ Trades Every Week...",
    "ogImage": "/og-image.png",
    "baseUrl": "https://trade-itm-prod.up.railway.app"
  },

  "branding": {
    "logo": "/hero-logo.png",
    "favicon": "/favicon.png",
    "companyName": "Trade ITM",
    "tagline": "Premium Trading Signals",
    "contactEmail": "support@tradeinthemoney.com"
  },

  "colors": {
    "primary": {
      "emerald": "#059669",
      "emeraldLight": "#10B981",
      "emeraldDark": "#065F46"
    },
    "accent": {
      "champagne": "#E8E4D9",
      "champagneLight": "#F5F3ED",
      "champagneDark": "#B8B5AD"
    },
    "neutral": {
      "onyx": "#0A0A0B",
      "onyxLight": "#141416",
      "ivory": "#F5F5F0"
    }
  },

  "navigation": [
    { "label": "Features", "href": "#features" },
    { "label": "Pricing", "href": "#pricing" },
    { "label": "Reviews", "href": "#testimonials" }
  ],

  "hero": {
    "headline": "3 High-Probability Trade Setups Every Week",
    "subheadline": "Targeting 100%+ returns per trade with our elite trading community",
    "ctaText": "JOIN NOW",
    "ctaLink": "https://whop.com/trade-in-the-money/itm-elite-access/",
    "backgroundImage": "/hero-bg.jpg",
    "logo": "/hero-logo.png"
  },

  "stats": [
    { "id": "1", "label": "Win Rate", "value": "87%", "icon": "target" },
    { "id": "2", "label": "Avg. Weekly Gain", "value": "127%", "icon": "trending-up" },
    { "id": "3", "label": "Signals Daily", "value": "15+", "icon": "zap" },
    { "id": "4", "label": "Years Experience", "value": "8+", "icon": "award" }
  ],

  "features": {
    "sectionTitle": "Everything You Need To Succeed",
    "sectionSubtitle": "Comprehensive tools and resources to transform your trading",
    "items": [
      {
        "id": "1",
        "title": "Real-Time Signals",
        "description": "Get instant trade alerts with exact entry points, stop losses, and profit targets",
        "icon": "bell",
        "image": null
      },
      {
        "id": "2",
        "title": "87% Success Rate",
        "description": "Detailed market analysis backed by years of proven track record",
        "icon": "chart-bar",
        "image": null
      },
      {
        "id": "3",
        "title": "Active Community",
        "description": "Join thousands of traders sharing insights and strategies daily",
        "icon": "users",
        "image": null
      },
      {
        "id": "4",
        "title": "Educational Content",
        "description": "Access exclusive courses and tutorials to level up your trading skills",
        "icon": "book-open",
        "image": "/icon-education.png"
      },
      {
        "id": "5",
        "title": "Lightning Fast",
        "description": "Receive signals instantly via Discord, SMS, and email notifications",
        "icon": "zap",
        "image": "/icon-lightning.png"
      },
      {
        "id": "6",
        "title": "Risk Management",
        "description": "Learn proper position sizing and risk management strategies",
        "icon": "shield",
        "image": "/icon-shield.png"
      }
    ]
  },

  "pricing": {
    "sectionTitle": "Choose Your Membership",
    "sectionSubtitle": "Select the plan that fits your trading goals",
    "guaranteeText": "Action-Based Money-Back Guarantee*",
    "guaranteeDescription": "Follow our signals for 30 days. If you're not profitable, we'll refund your membership.",
    "trustBadges": ["SSL Secured", "Powered by Stripe", "Cancel Anytime"],
    "tiers": [
      {
        "id": "starter",
        "name": "Starter",
        "price": "$49",
        "period": "/month",
        "description": "Perfect for beginners looking to learn the ropes",
        "features": [
          "5 Daily Signals",
          "Basic Market Analysis",
          "Community Discord Access",
          "Weekly Market Recap",
          "Email Support"
        ],
        "whopLink": "https://whop.com/checkout/plan_starter",
        "highlighted": false,
        "badge": null,
        "spotsLeft": null,
        "cardImage": "/card-starter.png",
        "cardColor": "glass"
      },
      {
        "id": "pro",
        "name": "Pro",
        "price": "$99",
        "period": "/month",
        "description": "Our most popular plan for serious traders",
        "features": [
          "15+ Daily Signals",
          "Advanced Technical Analysis",
          "Priority Discord Access",
          "1-on-1 Weekly Coaching",
          "Options Flow Data",
          "Priority Support"
        ],
        "whopLink": "https://whop.com/checkout/plan_pro",
        "highlighted": true,
        "badge": "Most Popular",
        "spotsLeft": null,
        "cardImage": "/card-pro.png",
        "cardColor": "metal"
      },
      {
        "id": "elite",
        "name": "Elite",
        "price": "$200",
        "period": "/month",
        "description": "For traders who demand the absolute best",
        "features": [
          "3+ High-Probability Setups/Week",
          "Targeting 100%+ Returns Per Trade",
          "VIP Discord Channel",
          "Direct Mentorship Access",
          "Custom Alert Settings",
          "Portfolio Review Sessions",
          "Early Access to New Features"
        ],
        "whopLink": "https://whop.com/trade-in-the-money/itm-elite-access/",
        "highlighted": false,
        "badge": "Limited",
        "spotsLeft": 7,
        "cardImage": "/card-elite.png",
        "cardColor": "gold"
      }
    ]
  },

  "testimonials": {
    "sectionTitle": "Trusted By Traders Worldwide",
    "sectionSubtitle": "See what our community members have to say about their experience",
    "items": [
      {
        "id": "1",
        "name": "Michael C.",
        "role": "Day Trader",
        "content": "Turned $2,500 into $11,200 in my first month. The signals are incredibly accurate and the community support is unmatched.",
        "avatar": "/trader-avatar.png",
        "initials": "MC",
        "rating": 5
      },
      {
        "id": "2",
        "name": "Sarah R.",
        "role": "Options Trader",
        "content": "Finally found a service that actually delivers. The win rate speaks for itself. Best investment I've made in my trading career.",
        "avatar": "/trader-avatar.png",
        "initials": "SR",
        "rating": 5
      },
      {
        "id": "3",
        "name": "David P.",
        "role": "Swing Trader",
        "content": "The educational content alone is worth the price. I've learned more in 3 months than I did in 2 years of trading on my own.",
        "avatar": "/trader-avatar.png",
        "initials": "DP",
        "rating": 5
      },
      {
        "id": "4",
        "name": "Emily W.",
        "role": "Part-time Trader",
        "content": "As someone with a full-time job, the alerts make it possible to trade successfully without being glued to my screen all day.",
        "avatar": "/trader-avatar.png",
        "initials": "EW",
        "rating": 5
      },
      {
        "id": "5",
        "name": "James M.",
        "role": "Forex Trader",
        "content": "The risk management strategies taught here saved my account. I went from losing money to consistent profits.",
        "avatar": "/trader-avatar.png",
        "initials": "JM",
        "rating": 5
      },
      {
        "id": "6",
        "name": "Alex T.",
        "role": "Crypto Trader",
        "content": "Best trading community I've been part of. The mentors actually care about your success and are always available to help.",
        "avatar": "/trader-avatar.png",
        "initials": "AT",
        "rating": 5
      },
      {
        "id": "7",
        "name": "Lisa K.",
        "role": "Stock Trader",
        "content": "Skeptical at first, but the results speak for themselves. Up 340% on my portfolio since joining 6 months ago.",
        "avatar": "/trader-avatar.png",
        "initials": "LK",
        "rating": 5
      },
      {
        "id": "8",
        "name": "Robert G.",
        "role": "Retired Investor",
        "content": "At 62, I thought it was too late to learn trading. This community proved me wrong. Now I'm generating supplemental retirement income.",
        "avatar": "/trader-avatar.png",
        "initials": "RG",
        "rating": 5
      },
      {
        "id": "9",
        "name": "Jennifer L.",
        "role": "Healthcare Worker",
        "content": "The alerts are so timely and accurate. I can check during my breaks and execute trades that actually work.",
        "avatar": "/trader-avatar.png",
        "initials": "JL",
        "rating": 5
      },
      {
        "id": "10",
        "name": "Marcus B.",
        "role": "Student Trader",
        "content": "Started with just $500 in college. Now I'm paying my own tuition through trading profits. Life changing!",
        "avatar": "/trader-avatar.png",
        "initials": "MB",
        "rating": 5
      }
    ]
  },

  "liveWins": [
    { "id": "1", "trader": "M. Chen", "ticker": "NVDA", "gain": "+142%" },
    { "id": "2", "trader": "S. Rodriguez", "ticker": "TSLA", "gain": "+87%" },
    { "id": "3", "trader": "D. Park", "ticker": "SPY", "gain": "+156%" },
    { "id": "4", "trader": "A. Thompson", "ticker": "AAPL", "gain": "+94%" },
    { "id": "5", "trader": "R. Martinez", "ticker": "AMD", "gain": "+203%" },
    { "id": "6", "trader": "K. Wilson", "ticker": "META", "gain": "+78%" },
    { "id": "7", "trader": "J. Lee", "ticker": "GOOGL", "gain": "+112%" },
    { "id": "8", "trader": "T. Brown", "ticker": "AMZN", "gain": "+167%" },
    { "id": "9", "trader": "L. Davis", "ticker": "MSFT", "gain": "+89%" },
    { "id": "10", "trader": "N. Garcia", "ticker": "QQQ", "gain": "+134%" }
  ],

  "postPurchase": {
    "sectionTitle": "What Happens After Purchase?",
    "sectionDescription": "Getting started is quick and easy. Here's your path to trading success.",
    "supportText": "Need help? Contact us at support@tradeinthemoney.com",
    "steps": [
      {
        "id": "1",
        "stepNumber": 1,
        "title": "Complete Your Purchase",
        "description": "Secure checkout through our trusted payment processor. Your information is always protected."
      },
      {
        "id": "2",
        "stepNumber": 2,
        "title": "Receive Instant Access",
        "description": "Check your email for login credentials and setup instructions within minutes."
      },
      {
        "id": "3",
        "stepNumber": 3,
        "title": "Join Our Discord Community",
        "description": "Connect with thousands of traders, get real-time signals, and start learning."
      },
      {
        "id": "4",
        "stepNumber": 4,
        "title": "Start Trading",
        "description": "Follow our signals, implement risk management, and begin your journey to consistent profits."
      }
    ]
  },

  "finalCta": {
    "headline": "Stop Missing Winning Trades",
    "description": "Every day you wait is another opportunity lost. Join the traders who are already profiting.",
    "ctaText": "START WINNING TODAY",
    "ctaLink": "https://whop.com/trade-in-the-money/itm-elite-access/",
    "urgencyBadge": "Only 7 Elite spots remaining this month"
  },

  "footer": {
    "copyright": "2026 Trade In The Money. All rights reserved.",
    "disclaimer": "Trading involves risk. Past performance does not guarantee future results.",
    "links": [
      { "label": "Privacy Policy", "href": "/privacy-policy" },
      { "label": "Terms of Service", "href": "/terms-of-service" }
    ]
  }
}
```

---

## 3. File Structure

### New Files to Create

```
app/
├── admin/
│   ├── layout.tsx                 # Admin layout with sidebar
│   ├── page.tsx                   # Admin dashboard
│   ├── login/
│   │   └── page.tsx               # Login page
│   ├── hero/
│   │   └── page.tsx               # Hero section editor
│   ├── stats/
│   │   └── page.tsx               # Stats editor
│   ├── features/
│   │   └── page.tsx               # Features editor
│   ├── pricing/
│   │   └── page.tsx               # Pricing tiers editor
│   ├── testimonials/
│   │   └── page.tsx               # Testimonials manager
│   ├── live-wins/
│   │   └── page.tsx               # Live wins editor
│   ├── post-purchase/
│   │   └── page.tsx               # Post-purchase steps editor
│   ├── cta/
│   │   └── page.tsx               # Final CTA editor
│   ├── branding/
│   │   └── page.tsx               # Logo, colors, branding
│   ├── seo/
│   │   └── page.tsx               # SEO & metadata
│   ├── navigation/
│   │   └── page.tsx               # Navigation links
│   ├── footer/
│   │   └── page.tsx               # Footer editor
│   └── media/
│       └── page.tsx               # Media/image manager
│
├── api/
│   └── admin/
│       ├── auth/
│       │   ├── login/route.ts     # Login endpoint
│       │   └── logout/route.ts    # Logout endpoint
│       ├── config/
│       │   └── route.ts           # Get/Update config
│       ├── upload/
│       │   └── route.ts           # Image upload
│       └── media/
│           └── route.ts           # List/delete media
│
components/
├── admin/
│   ├── AdminSidebar.tsx           # Navigation sidebar
│   ├── AdminHeader.tsx            # Header with user info
│   ├── ColorPicker.tsx            # Color selection component
│   ├── ImageUploader.tsx          # Drag-drop image upload
│   ├── RichTextEditor.tsx         # Text editing component
│   ├── ArrayEditor.tsx            # For editing lists
│   ├── IconPicker.tsx             # Lucide icon selector
│   └── PreviewPane.tsx            # Live preview component
│
data/
├── siteConfig.json                # Main config file
└── siteConfig.backup.json         # Auto-backup before saves
│
lib/
├── config.ts                      # Config read/write utilities
├── auth.ts                        # Auth utilities
└── upload.ts                      # File upload utilities
│
middleware.ts                      # Auth middleware for /admin routes
```

---

## 4. Implementation Phases

### Phase 1: Foundation (Core Infrastructure)
1. Create data directory and siteConfig.json
2. Build config utility functions (read/write)
3. Set up authentication system
4. Create middleware for route protection
5. Build admin layout with sidebar

### Phase 2: API Layer
1. Auth endpoints (login/logout)
2. Config CRUD endpoints
3. Image upload endpoint
4. Media management endpoint

### Phase 3: Admin UI Components
1. Admin sidebar navigation
2. Form components (inputs, color pickers, etc.)
3. Image uploader component
4. Array/list editor component
5. Preview pane component

### Phase 4: Admin Pages
1. Dashboard with quick stats
2. Hero section editor
3. Stats editor
4. Features editor
5. Pricing editor
6. Testimonials manager
7. Live wins editor
8. Post-purchase steps editor
9. CTA editor
10. Branding/colors editor
11. SEO settings
12. Navigation editor
13. Footer editor
14. Media library

### Phase 5: Integration
1. Update main page.tsx to read from config
2. Update all components to use config data
3. Add admin link to footer
4. Testing and refinements

---

## 5. Claude Code Prompts

Below are the prompts to give Claude Code to build each component. Run these in order.

---

### PROMPT 1: Create Data Layer & Configuration System

```
Create the data layer for the admin system:

1. Create a new directory `data/` at the project root

2. Create `data/siteConfig.json` with the complete schema I'll provide (copy the full JSON schema from the development plan)

3. Create `lib/config.ts` with these functions:
   - `getSiteConfig()` - reads and returns the config, with caching
   - `updateSiteConfig(updates: Partial<SiteConfig>)` - merges updates and saves
   - `backupConfig()` - creates a timestamped backup
   - `restoreConfig(backupFile: string)` - restores from backup

4. Create TypeScript types in `types/config.ts` for the entire config schema with proper interfaces for:
   - SiteConfig (root type)
   - SEOConfig
   - BrandingConfig
   - ColorsConfig
   - NavigationItem
   - HeroConfig
   - StatItem
   - FeaturesConfig, FeatureItem
   - PricingConfig, PricingTier
   - TestimonialsConfig, TestimonialItem
   - LiveWinItem
   - PostPurchaseConfig, PostPurchaseStep
   - FinalCtaConfig
   - FooterConfig

Make sure to handle file reading/writing safely with proper error handling and atomic writes (write to temp file then rename).
```

---

### PROMPT 2: Create Authentication System

```
Create a simple password-based authentication system for the admin panel:

1. Create `lib/auth.ts` with:
   - ADMIN_PASSWORD constant set to "fancy"
   - `verifyPassword(password: string)` - returns boolean
   - `createSession()` - generates a session token
   - `verifySession(token: string)` - validates session
   - Use a simple in-memory session store (Map) that expires after 24 hours

2. Create `app/api/admin/auth/login/route.ts`:
   - POST endpoint
   - Accepts { password: string }
   - Returns session token in HTTP-only cookie
   - Returns { success: true } or { error: "Invalid password" }

3. Create `app/api/admin/auth/logout/route.ts`:
   - POST endpoint
   - Clears the session cookie
   - Returns { success: true }

4. Create `middleware.ts` at the project root:
   - Protect all /admin/* routes EXCEPT /admin/login
   - Check for valid session cookie
   - Redirect to /admin/login if not authenticated
   - Allow API routes under /api/admin/auth/* without auth

Use Next.js cookies() API for cookie management. Session cookie should be named "admin_session".
```

---

### PROMPT 3: Create Admin Layout & Login Page

```
Create the admin layout and login page:

1. Create `app/admin/login/page.tsx`:
   - Clean, centered login form
   - Single password input field
   - "Enter Admin Panel" button
   - Use the existing site's dark theme (onyx background, emerald accents)
   - Show error message if password is wrong
   - Redirect to /admin on successful login
   - Use client-side form submission to /api/admin/auth/login

2. Create `app/admin/layout.tsx`:
   - Dark sidebar on the left (240px wide)
   - Main content area on the right
   - Header with "Admin Panel" title and logout button
   - Sidebar navigation with links to all admin sections:
     * Dashboard (/)
     * Hero Section
     * Stats
     * Features
     * Pricing
     * Testimonials
     * Live Wins
     * Post Purchase
     * Final CTA
     * Branding & Colors
     * SEO Settings
     * Navigation
     * Footer
     * Media Library
   - Use Lucide icons for each nav item
   - Highlight active section
   - Style matching the main site's luxury aesthetic

3. Create `app/admin/page.tsx` (Dashboard):
   - Welcome message
   - Quick stats cards showing:
     * Number of testimonials
     * Number of pricing tiers
     * Number of features
     * Last updated timestamp
   - Quick links to common actions
   - "View Site" button that opens main site in new tab
```

---

### PROMPT 4: Create API Routes for Config Management

```
Create the API routes for reading and updating the site configuration:

1. Create `app/api/admin/config/route.ts`:

   GET handler:
   - Returns the full siteConfig.json
   - Includes proper caching headers

   PUT handler:
   - Accepts partial config updates
   - Validates the incoming data
   - Creates a backup before saving
   - Merges with existing config (deep merge)
   - Saves to siteConfig.json
   - Returns the updated config

   PATCH handler:
   - For updating specific sections (hero, pricing, etc.)
   - Accepts { section: string, data: any }
   - Updates only that section
   - Returns updated config

2. Create `app/api/admin/config/[section]/route.ts`:
   - Dynamic route for getting/updating specific sections
   - GET: Returns just that section of config
   - PUT: Updates just that section

Add proper error handling, validation, and return appropriate HTTP status codes.
All routes should be protected (check for valid session).
```

---

### PROMPT 5: Create Image Upload System

```
Create the image upload system:

1. Create `app/api/admin/upload/route.ts`:
   - POST endpoint accepting multipart form data
   - Accept image files (png, jpg, jpeg, gif, webp, svg)
   - Maximum file size: 10MB
   - Save to `public/uploads/` directory
   - Generate unique filename with timestamp
   - Return { url: "/uploads/filename.ext", filename: "..." }

2. Create `app/api/admin/media/route.ts`:

   GET handler:
   - List all files in public/uploads/
   - Return array of { filename, url, size, uploadedAt }

   DELETE handler:
   - Accept { filename: string }
   - Delete the specified file
   - Return { success: true }

3. Create `components/admin/ImageUploader.tsx`:
   - Drag and drop zone
   - Click to browse
   - Show upload progress
   - Preview uploaded image
   - Option to remove/replace
   - Props: { value: string, onChange: (url: string) => void, label?: string }

4. Create `app/admin/media/page.tsx`:
   - Grid view of all uploaded images
   - Upload new images button
   - Click to copy URL
   - Delete button for each image
   - Show file size and upload date
   - Search/filter functionality
```

---

### PROMPT 6: Create Reusable Admin Form Components

```
Create reusable form components for the admin panel:

1. Create `components/admin/FormField.tsx`:
   - Wrapper with label, input, and error message
   - Props: { label, name, error, children }

2. Create `components/admin/TextInput.tsx`:
   - Standard text input with dark theme styling
   - Props: { value, onChange, placeholder, type?, multiline? }

3. Create `components/admin/ColorPicker.tsx`:
   - Color input with hex value display
   - Preview swatch
   - Props: { value, onChange, label }

4. Create `components/admin/IconPicker.tsx`:
   - Dropdown/modal with Lucide icon grid
   - Search functionality
   - Preview selected icon
   - Common icons: bell, chart-bar, users, book-open, zap, shield, target, trending-up, award, etc.
   - Props: { value, onChange, label }

5. Create `components/admin/ArrayEditor.tsx`:
   - For editing arrays of items (testimonials, features, etc.)
   - Add/remove/reorder items
   - Drag and drop reordering
   - Props: { items, onAdd, onRemove, onReorder, onUpdate, renderItem }

6. Create `components/admin/RichTextEditor.tsx`:
   - Simple textarea with character count
   - Optional markdown preview
   - Props: { value, onChange, maxLength?, showPreview? }

7. Create `components/admin/SwitchToggle.tsx`:
   - Boolean toggle switch
   - Props: { value, onChange, label }

8. Create `components/admin/SaveButton.tsx`:
   - Shows "Save Changes" / "Saving..." / "Saved!" states
   - Disabled when no changes
   - Props: { onSave, isDirty, isLoading }

Style all components with the dark theme (onyx backgrounds, emerald accents, proper focus states).
```

---

### PROMPT 7: Create Hero Section Editor

```
Create the Hero section editor page:

Create `app/admin/hero/page.tsx`:

1. Form fields for:
   - Headline (text input)
   - Subheadline (textarea)
   - CTA Button Text (text input)
   - CTA Button Link (text input with URL validation)
   - Hero Logo (ImageUploader)
   - Background Image (ImageUploader)

2. Features:
   - Load current values from config on mount
   - Track dirty state (unsaved changes)
   - Save button that updates config via API
   - Success/error toast notifications
   - Live preview panel showing how hero will look

3. Layout:
   - Two-column layout on desktop (form left, preview right)
   - Stack on mobile
   - Sticky save button at bottom

Use React Hook Form for form state management and Zod for validation.
```

---

### PROMPT 8: Create Stats Editor

```
Create the Stats section editor:

Create `app/admin/stats/page.tsx`:

1. Display current 4 stats as editable cards
2. Each stat card has:
   - Label input
   - Value input
   - Icon picker (using IconPicker component)
   - Delete button (if more than 1 stat)

3. Features:
   - Add new stat button (if less than 6)
   - Drag and drop reorder
   - Live preview showing stats bar
   - Save all changes button

4. Validation:
   - Label required, max 20 chars
   - Value required, max 10 chars
   - Icon required
```

---

### PROMPT 9: Create Features Editor

```
Create the Features section editor:

Create `app/admin/features/page.tsx`:

1. Section settings:
   - Section Title input
   - Section Subtitle textarea

2. Feature items as expandable cards:
   - Title input
   - Description textarea
   - Icon picker OR custom image upload
   - Delete button
   - Collapse/expand toggle

3. Features:
   - Add new feature button
   - Drag and drop reorder
   - Maximum 8 features
   - Preview of feature cards grid

4. Each feature card in the list shows:
   - Icon/image preview
   - Title
   - Truncated description
   - Edit/Delete actions
```

---

### PROMPT 10: Create Pricing Editor

```
Create the Pricing section editor - this is one of the most important pages:

Create `app/admin/pricing/page.tsx`:

1. Section settings:
   - Section Title
   - Section Subtitle
   - Guarantee Text
   - Guarantee Description
   - Trust Badges (array of strings)

2. Pricing Tiers (show as large cards):
   For each tier:
   - Tier Name
   - Price (e.g., "$99")
   - Period (e.g., "/month")
   - Description
   - Features list (array editor with add/remove)
   - Whop Checkout Link (URL input)
   - Is Highlighted? (toggle)
   - Badge Text (optional, e.g., "Most Popular")
   - Spots Left (optional number for scarcity)
   - Card Background Image (ImageUploader)
   - Card Color Theme (dropdown: glass, metal, gold)

3. Features:
   - Add new tier button (max 4 tiers)
   - Delete tier (min 1 tier)
   - Reorder tiers
   - Preview showing pricing cards side by side

4. Important: Make the Whop links very prominent since these drive revenue
```

---

### PROMPT 11: Create Testimonials Manager

```
Create the Testimonials manager page:

Create `app/admin/testimonials/page.tsx`:

1. Section settings:
   - Section Title
   - Section Subtitle

2. Testimonials list as a sortable grid:
   Each testimonial card shows:
   - Avatar (ImageUploader or auto-generate from initials)
   - Name input
   - Role/Title input
   - Testimonial content (textarea, max 280 chars)
   - Star rating (1-5 clickable stars)
   - Initials (auto-generated from name, or custom)
   - Delete button

3. Features:
   - Add new testimonial button
   - Bulk import from CSV (name, role, content)
   - Duplicate testimonial
   - Drag and drop reorder
   - Search/filter testimonials
   - Show character count for content

4. Preview:
   - Show marquee preview with current testimonials
   - Toggle between Row 1 and Row 2 preview
```

---

### PROMPT 12: Create Live Wins Editor

```
Create the Live Wins ticker editor:

Create `app/admin/live-wins/page.tsx`:

1. Live wins as a compact editable list:
   Each entry has:
   - Trader name/initials (e.g., "M. Chen")
   - Ticker symbol (e.g., "NVDA")
   - Gain percentage (e.g., "+142%")
   - Delete button

2. Features:
   - Add new win button
   - Quick add form (all 3 fields in one row)
   - Reorder by drag and drop
   - Bulk add multiple wins
   - Clear all button (with confirmation)

3. Validation:
   - Ticker should be uppercase
   - Gain should start with + or -
   - Max 20 wins

4. Preview:
   - Show live ticker animation preview
```

---

### PROMPT 13: Create Post-Purchase Steps Editor

```
Create the Post-Purchase section editor:

Create `app/admin/post-purchase/page.tsx`:

1. Section settings:
   - Section Title
   - Section Description
   - Support Email/Text

2. Steps as numbered cards:
   Each step has:
   - Step Number (auto-assigned, reorderable)
   - Title
   - Description
   - Delete button (min 2 steps)

3. Features:
   - Add new step (max 6 steps)
   - Drag and drop reorder (auto-updates step numbers)
   - Preview of the steps section

4. Include helpful text explaining this section appears after users scroll past pricing
```

---

### PROMPT 14: Create Final CTA Editor

```
Create the Final CTA section editor:

Create `app/admin/cta/page.tsx`:

1. Form fields:
   - Headline (text input)
   - Description (textarea)
   - CTA Button Text
   - CTA Button Link
   - Urgency Badge Text (e.g., "Only 7 Elite spots remaining")
   - Show Urgency Badge (toggle)

2. Features:
   - Character limits with counters
   - Live preview of the CTA section
   - Suggestions for high-converting copy

3. Preview shows the full-width CTA section as it appears on site
```

---

### PROMPT 15: Create Branding & Colors Editor

```
Create the Branding and Colors editor:

Create `app/admin/branding/page.tsx`:

1. Branding section:
   - Main Logo (ImageUploader)
   - Favicon (ImageUploader)
   - Company Name
   - Tagline
   - Contact Email

2. Color Palette section with ColorPickers:
   Primary Colors:
   - Emerald (main)
   - Emerald Light
   - Emerald Dark

   Accent Colors:
   - Champagne
   - Champagne Light
   - Champagne Dark

   Neutral Colors:
   - Onyx (dark background)
   - Onyx Light
   - Ivory (light text)

3. Features:
   - Reset to defaults button
   - Color palette preview showing all colors together
   - Preview components (buttons, cards) with current colors
   - Export/Import color scheme as JSON

4. When colors are saved, they should update CSS variables in globals.css
   (Create an API endpoint that updates the CSS file or use CSS-in-JS approach)
```

---

### PROMPT 16: Create SEO Settings Editor

```
Create the SEO Settings editor:

Create `app/admin/seo/page.tsx`:

1. Meta Tags section:
   - Page Title (with character counter, recommend < 60)
   - Meta Description (with character counter, recommend < 160)

2. Open Graph section:
   - OG Title
   - OG Description
   - OG Image (ImageUploader with 1200x630 recommendation)

3. Site Settings:
   - Base URL
   - Canonical URL override (optional)

4. Features:
   - Preview how the page will appear in Google search results
   - Preview how the page will appear when shared on social media
   - Validate meta tags (warnings for too long/short)

5. Include helpful tips for SEO best practices
```

---

### PROMPT 17: Create Navigation Editor

```
Create the Navigation links editor:

Create `app/admin/navigation/page.tsx`:

1. Navigation items as a sortable list:
   Each item has:
   - Label (display text)
   - Link/Href (internal anchor like #features or external URL)
   - Delete button

2. Features:
   - Add new nav item (max 6 items)
   - Drag and drop reorder
   - Preview of the navigation bar
   - Toggle between internal anchors (#section) and external links
   - Dropdown to quickly select from existing page sections

3. Validation:
   - Label required, max 20 chars
   - Href required, must start with # or http
```

---

### PROMPT 18: Create Footer Editor

```
Create the Footer editor:

Create `app/admin/footer/page.tsx`:

1. Content section:
   - Copyright text (with {year} placeholder support)
   - Disclaimer text
   - Contact email

2. Footer links as editable list:
   Each link has:
   - Label
   - URL (internal or external)
   - Delete button

3. Features:
   - Add new link (max 6)
   - Reorder links
   - Preview of footer

4. Quick toggles:
   - Show "Admin" link in footer (for accessing admin panel)
   - Show disclaimer
   - Show social links (future feature placeholder)
```

---

### PROMPT 19: Update Main Site to Use Config

```
Now update the main landing page to read all content from siteConfig.json:

1. Create `lib/getConfig.ts`:
   - Server-side function to read config with caching
   - Handle file not found gracefully (return defaults)

2. Update `app/page.tsx`:
   - Import and use getSiteConfig()
   - Pass config data to all sections as props
   - Remove all hardcoded content

3. Update each component to accept props instead of hardcoded values:
   - Hero section
   - Stats section
   - Features section (bento cards)
   - Pricing section (pricing cards)
   - Testimonials section (testimonial marquee)
   - Live wins ticker
   - Post-purchase section
   - Final CTA section
   - Footer

4. Update `app/layout.tsx`:
   - Read SEO config for metadata
   - Dynamic page title and description

5. Add admin link to footer:
   - Small "Admin" text link
   - Only visible, links to /admin/login

Make sure to maintain all existing styling and animations. Only the data source changes.
```

---

### PROMPT 20: Create Color System Integration

```
Create a system to dynamically apply color changes from the admin panel:

1. Create `app/api/admin/colors/route.ts`:
   - Endpoint to update colors
   - Generates CSS with updated variables
   - Writes to a special `public/theme.css` file

2. Update `app/layout.tsx`:
   - Add link to `/theme.css` for dynamic colors
   - Fallback to default colors if file doesn't exist

3. Alternative approach - CSS Variables in `<style>` tag:
   - Read colors from config
   - Inject as CSS variables in layout
   - This avoids file system writes

4. Create `lib/colorUtils.ts`:
   - `generateCSSVariables(colors)` - generates CSS string
   - `hexToRGB(hex)` - for rgba colors
   - `adjustBrightness(hex, percent)` - for hover states

Choose the approach that works best with the current setup (likely the CSS variables injection approach for simplicity).
```

---

### PROMPT 21: Testing and Polish

```
Final testing and polish for the admin system:

1. Add loading states to all admin pages:
   - Skeleton loaders while fetching config
   - Disable form during save
   - Show saving indicator

2. Add toast notifications:
   - Success: "Changes saved successfully"
   - Error: "Failed to save. Please try again."
   - Warning: "You have unsaved changes"

3. Add unsaved changes warning:
   - Prompt before leaving page with unsaved changes
   - Browser beforeunload event

4. Add keyboard shortcuts:
   - Ctrl/Cmd + S to save
   - Escape to cancel/close modals

5. Mobile responsiveness:
   - Collapsible sidebar on mobile
   - Touch-friendly inputs
   - Proper spacing

6. Error boundaries:
   - Catch and display errors gracefully
   - "Something went wrong" fallback UI

7. Create `app/admin/not-found.tsx`:
   - Custom 404 for admin routes
   - Link back to dashboard

8. Final testing checklist:
   - Test all CRUD operations
   - Test image uploads
   - Test color changes
   - Test on mobile
   - Verify changes appear on main site
   - Test logout/login flow
```

---

## 6. Security Considerations

### Current Implementation (Simple)
- Password-only auth with "fancy" password
- Session stored in HTTP-only cookie
- 24-hour session expiry
- Protected by middleware

### Future Enhancements (Optional)
- Add rate limiting to login endpoint
- Add CSRF protection
- Implement proper password hashing if storing passwords
- Add audit log for changes
- Add two-factor authentication
- IP whitelist for admin access

---

## 7. Deployment Notes

### Railway Deployment
1. Ensure `data/` directory is in `.gitignore` (or use environment-based storage)
2. Consider using Railway's persistent storage for uploads
3. Set appropriate file permissions

### Environment Variables (Optional)
```env
ADMIN_PASSWORD=fancy
SESSION_SECRET=your-random-secret
```

### File Permissions
- `data/siteConfig.json` needs read/write
- `public/uploads/` needs read/write
- All other files read-only

---

## Summary

This development plan provides a complete blueprint for building a comprehensive admin backend. The system is designed to be:

- **Simple**: JSON file storage, no database needed
- **Secure**: Password protection with session management
- **Comprehensive**: Every editable element has an admin interface
- **User-Friendly**: Clean UI matching your site's aesthetic
- **Maintainable**: Well-organized code structure

Run the Claude Code prompts in order (1-21) to build the complete system. Each prompt builds on the previous ones, so they should be executed sequentially.

Total estimated development time: 4-6 hours with Claude Code.
