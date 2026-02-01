# Claude Code Development Guidelines for TradeITM

> **CRITICAL**: This file must ALWAYS be maintained and updated. All Claude Code sessions working on this repository MUST read and follow these guidelines.

## Project Overview

**TradeITM** is a full-stack trading education and mentorship platform built entirely by Claude Code with minimal developer intervention. This application is production-grade and serves real users.

### Human Developer Context
- **Development Knowledge**: Minimal - relies on Claude Code for all technical decisions
- **Responsibility**: Claude Code is the primary technical architect and maintainer
- **Production Status**: LIVE - all changes directly impact real users

---

## 🔴 CRITICAL RESPONSIBILITIES

### 1. Production Quality Management
Claude Code is responsible for:
- **Code Quality**: All code must be production-ready, tested, and secure
- **Security**: Implement best practices (OWASP top 10, authentication, authorization, input validation)
- **Performance**: Optimize for speed, minimize bundle sizes, efficient database queries
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Accessibility**: WCAG 2.1 AA compliance where applicable
- **Type Safety**: Strict TypeScript usage, no `any` types without justification
- **Design Consistency**: Maintain "Emerald Standard" brand guidelines (see `docs/BRAND_GUIDELINES.md`)

### 2. Design & Brand Standards
Claude Code MUST follow the **"Emerald Standard"** design system:

#### Required Reading
- **`CLAUDE.md`** - Quick reference for design rules and coding conventions
- **`docs/BRAND_GUIDELINES.md`** - Complete brand and design guidelines

#### Core Design Principles
**Philosophy**: "Private Equity Terminal" — Quiet Luxury, High Density, Professional Stability

**Color Palette**:
- **Primary**: Emerald Elite `#10B981` (emerald-500)
- **Accent**: Champagne `#F3E5AB` (use sparingly)
- **Background**: Onyx `#0A0A0B` (never pure black)
- **🚫 FORBIDDEN**: Old Gold `#D4AF37` - MUST be refactored to Emerald

**Typography**:
- Headings: `Playfair Display` (Serif)
- Body: `Inter` (Sans)
- Data/Terminal: `Geist Mono`

**UI Patterns**:
- **Cards**: Use `glass-card-heavy` class (`bg-[#0A0A0B]/60 backdrop-blur-xl border border-white/5`)
- **Borders**: Standard `border-white/5`, Active `border-emerald-500/50`, Premium `border-champagne/30`
- **Branding**: Always use `public/logo.png`, NEVER `<Sparkles />` as logo substitute
- **Icons**: Lucide React with stroke width `1.5`
- **Loading States**: Use pulsing logo pattern, never generic spinners

**Mobile Requirements**:
- Mobile-first approach
- Navigation: Bottom sheet or Hamburger menu
- Data tables: Convert to card lists on mobile
- Touch targets: Minimum 44px height

**Prohibited Styles** ("The Ban List"):
- ❌ Hex `#D4AF37` (old gold)
- ❌ Yellow spinners
- ❌ Pure white backgrounds
- ❌ Skeuomorphic buttons with 3D bevels

#### Design Change Protocol
When modifying UI components:
1. **Verify brand compliance** against `docs/BRAND_GUIDELINES.md`
2. **Use existing patterns** from similar components
3. **Test mobile responsiveness** (use `hidden md:flex` patterns)
4. **Maintain glassmorphism** aesthetic
5. **Check color usage** - no deprecated colors

### 3. Dependency Management & Impact Analysis
Before making ANY change, Claude Code MUST:

#### Analyze Repository-Wide Implications
```
✓ Check all files that import the modified code
✓ Verify database schema dependencies
✓ Review API endpoint contracts
✓ Identify UI components that depend on the change
✓ Check environment variable requirements
✓ Review authentication/authorization implications
✓ Assess performance impact
✓ Identify potential breaking changes
```

#### Alert Human Requirements
When changes have significant implications, Claude Code MUST:

1. **STOP and create a summary** before implementing
2. **List all affected areas** with file paths and line numbers
3. **Identify risks** including:
   - Potential breaking changes
   - Data migration requirements
   - User-facing changes
   - Security implications
   - Performance impacts
4. **Request explicit approval** for:
   - Database schema changes
   - Authentication/authorization changes
   - API contract changes
   - Payment/billing logic changes
   - User data handling changes
5. **Provide rollback plan** if things go wrong

### 4. Proactive Issue Detection
Claude Code should actively identify and alert on:
- Security vulnerabilities
- Performance bottlenecks
- Deprecated dependencies
- Technical debt accumulation
- Scaling concerns
- Missing error handling
- Inadequate testing coverage
- Accessibility issues

---

## 🗄️ Supabase MCP Configuration

### Active Configuration
This project uses **Supabase MCP (Model Context Protocol)** for database operations and backend services.

#### Supabase Architecture
```
supabase/
├── migrations/          # Database schema versions (NEVER modify directly)
├── functions/          # Edge Functions (serverless API endpoints)
│   ├── handle-chat-message/
│   ├── analyze-trade-screenshot/
│   ├── create-team-member/
│   ├── notify-team-lead/
│   ├── send-chat-transcript/
│   ├── send-push-notification/
│   ├── cron-archive-conversations/
│   └── sync-discord-roles/
└── config.toml         # Supabase project configuration
```

#### Database Tables (via Supabase)
- **Authentication**: `auth.users`, `team_members`, `admin_access_tokens`
- **Chat System**: `conversations`, `messages`, `typing_indicators`
- **Content**: `courses`, `packages`, `knowledge_base`
- **Roles & Permissions**: `roles`, `user_permissions`, `strategic_permissions`
- **Trading**: `trading_journal`, `trade_screenshots`
- **Applications**: `cohort_applications`, `contact_submissions`
- **Settings**: `app_settings`, `pricing_tiers`

#### Supabase Rules
1. **NEVER modify migrations directly** - Always create new migration files
2. **Row Level Security (RLS)** is enforced - All policies must be tested
3. **Edge Functions** require explicit deployment
4. **Real-time subscriptions** are enabled on specific tables
5. **Storage buckets** require public/private access configuration

#### Database Change Protocol
When modifying database schema:
```bash
# 1. Create new migration
supabase migration new descriptive_name

# 2. Write SQL in the new migration file

# 3. Test locally
supabase db reset

# 4. Verify RLS policies
# Check affected tables for proper access controls

# 5. Alert human about:
   - Tables affected
   - Existing data migration needs
   - Potential downtime
   - Rollback strategy
```

### Supabase MCP Best Practices
- **Always use parameterized queries** to prevent SQL injection
- **Implement RLS policies** for every table
- **Test authentication flows** after any auth changes
- **Monitor Edge Function logs** for errors
- **Use TypeScript types** generated from Supabase schema
- **Implement proper error handling** for all database operations
- **Use transactions** for multi-step operations
- **Cache frequently accessed data** appropriately

---

## 📦 Key Dependencies to Monitor

### Critical Dependencies (Breaking changes = major issues)
- `next` (16.0.10) - Framework core
- `react` (19.2.0) - UI library
- `@supabase/supabase-js` (^2.93.3) - Database/Auth
- `@radix-ui/*` - UI components
- `typescript` (^5) - Type system

### Dependency Update Protocol
1. **Check changelog** for breaking changes
2. **Test locally** before committing
3. **Run full test suite** (`npm run test:e2e`)
4. **Verify build** (`npm run build`)
5. **Alert human** if major version bump or breaking changes

---

## 🏗️ Architecture Overview

### Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4, Radix UI components
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Real-time**: Supabase Realtime subscriptions
- **3D Graphics**: Three.js, React Three Fiber
- **Forms**: React Hook Form + Zod validation
- **State**: React Context API
- **Testing**: Playwright (E2E)

### Directory Structure
```
app/                    # Next.js App Router pages
├── admin/             # Admin dashboard (protected)
├── members/           # Member portal (protected)
├── auth/              # Authentication flows
└── (public pages)     # Landing, login, etc.

components/            # Reusable React components
contexts/              # React Context providers
lib/                   # Utilities, helpers, Supabase client
supabase/             # Backend configuration
e2e/                  # Playwright tests
public/               # Static assets
```

### Authentication Flow
1. Supabase Auth handles user authentication
2. Middleware (`middleware.ts`) protects routes
3. Role-based access control (RBAC) via `user_permissions`
4. Admin access tokens for API operations

---

## 🚨 Critical Files - Handle with Extreme Care

### Do Not Modify Without Explicit Approval
- `supabase/migrations/*` - Database schema history
- `middleware.ts` - Route protection and auth
- `lib/supabase/server.ts` - Server-side Supabase client
- `lib/supabase/client.ts` - Client-side Supabase client
- `app/auth/callback/page.tsx` - OAuth callback handler

### High-Risk Changes Requiring Human Alert
- Any file in `app/admin/*` - Admin functionality
- Any file with `auth` in the name - Authentication
- Any file in `supabase/functions/*` - Serverless functions
- Payment/billing related code
- User data handling logic
- Role/permission management

---

## ✅ Pre-Commit Checklist

Before committing ANY change, verify:

- [ ] **TypeScript compiles** without errors (`tsc --noEmit`)
- [ ] **Build succeeds** (`npm run build`)
- [ ] **No console errors** in browser console
- [ ] **Tests pass** (if applicable)
- [ ] **No security vulnerabilities** introduced
- [ ] **Dependencies analyzed** for implications
- [ ] **Documentation updated** (if public API changed)
- [ ] **Human alerted** (if high-risk change)

---

## 🔄 Change Impact Template

When making significant changes, use this template to alert the human:

```markdown
## Proposed Change: [Brief Description]

### Files Modified
- path/to/file1.ts:123-145
- path/to/file2.tsx:67-89

### Dependencies Affected
- Component X relies on this change
- API endpoint Y will need updates
- Database table Z has related fields

### Risks Identified
1. **Breaking Change**: [Description]
2. **Data Migration**: [Required steps]
3. **User Impact**: [How users are affected]

### Testing Plan
- [ ] Test case 1
- [ ] Test case 2

### Rollback Strategy
[How to undo this change if needed]

### Recommendation
[Proceed/Hold/Alternative approach]
```

---

## 🎯 Development Workflow

### 1. Understand the Request
- Read the full context
- Ask clarifying questions if needed
- Identify all affected areas

### 2. Analyze Impact
- Use grep/search to find dependencies
- Check database schema implications
- Review authentication/authorization
- Assess performance impact

### 3. Alert if Necessary
- High-risk changes require human approval
- Provide impact analysis template
- Wait for explicit go-ahead

### 4. Implement with Quality
- Write clean, documented code
- Add error handling
- Include TypeScript types
- Follow existing patterns

### 5. Test Thoroughly
- Run build process
- Test user flows
- Check edge cases
- Verify security

### 6. Commit & Document
- Clear commit messages
- Update documentation
- Note any follow-up items

---

## 🛡️ Security Guidelines

### Authentication & Authorization
- **Never** bypass authentication checks
- **Always** verify user permissions before data access
- **Use** Supabase RLS policies for data security
- **Validate** all user inputs
- **Sanitize** data before database operations

### Secrets & Environment Variables
- **Never** commit secrets to git
- **Use** environment variables for sensitive data
- **Rotate** API keys regularly (alert human)
- **Follow** principle of least privilege

### Common Vulnerabilities to Prevent
- SQL Injection (use parameterized queries)
- XSS (sanitize user content)
- CSRF (use Supabase CSRF protection)
- Broken Authentication (test auth flows)
- Sensitive Data Exposure (encrypt at rest/transit)
- Broken Access Control (enforce RLS)
- Security Misconfiguration (review Supabase settings)

---

## 📞 When to Alert Human

### MUST Alert (Stop and wait for approval)
- Database schema changes
- Authentication/authorization changes
- Payment/billing logic
- User data handling changes
- Breaking API changes
- Security vulnerability fixes
- Major dependency upgrades
- Production deployment issues

### SHOULD Alert (Inform but can proceed)
- New feature completions
- Bug fixes in critical areas
- Performance optimizations
- Significant refactoring
- Test coverage improvements

### CAN Proceed Without Alert
- Minor UI tweaks
- Documentation updates
- Code comments
- Non-breaking bug fixes
- Style/formatting changes

---

## 🔧 Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build           # Production build
npm run start           # Start production server
npm run lint            # Lint code

# Testing
npm run test:e2e        # Run Playwright tests
npm run test:e2e:ui     # Run tests with UI
npm run test:e2e:headed # Run tests headed mode

# Supabase (if needed)
supabase start          # Start local Supabase
supabase db reset       # Reset local database
supabase migration new  # Create new migration
supabase functions deploy # Deploy edge functions
```

---

## 📚 Additional Resources

### Documentation Files in Repo

#### Critical References (Read First)
- **`CLAUDE.md`** - Quick AI instructions, design rules, coding conventions
- **`docs/BRAND_GUIDELINES.md`** - Complete Emerald Standard design system

#### Feature Documentation
- `ADMIN_SETUP_COMPLETE.md` - Admin panel setup guide
- `AI_Chat_System_Architecture.md` - Chat system details
- `ANALYTICS_SETUP_GUIDE.md` - Analytics implementation
- `CHAT_IMPLEMENTATION_GUIDE.md` - Chat feature guide
- `DEPLOYMENT_CHECKLIST.md` - Deployment procedures
- `Custom_Chat_Widget_Technical_Plan.md` - Chat widget specs

### External Resources
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Radix UI Docs](https://www.radix-ui.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)

---

## 🎓 Learning from This Codebase

Since the human has minimal development knowledge, Claude Code should:

- **Explain decisions** in comments and commit messages
- **Document patterns** for future reference
- **Provide context** for complex implementations
- **Teach principles** through code examples
- **Build maintainability** into every change

---

## 📝 Version History

| Date | Change | Reason |
|------|--------|--------|
| 2026-02-01 | Initial creation | Establish Claude Code guidelines and Supabase MCP documentation |
| 2026-02-01 | Add Emerald Standard design system | Integrate brand guidelines and enforce "Private Equity Terminal" aesthetic |

---

## 🤝 Communication Principles

1. **Be Transparent**: Always explain what you're doing and why
2. **Be Thorough**: Don't skip steps or make assumptions
3. **Be Cautious**: When in doubt, ask before proceeding
4. **Be Proactive**: Identify issues before they become problems
5. **Be Clear**: Use simple language to explain technical concepts

---

**Remember**: This is a production application with real users. Every change matters. Quality, security, and stability are paramount. When in doubt, ALERT THE HUMAN.

---

_This file should be updated whenever significant architectural decisions are made or new critical patterns are established._
