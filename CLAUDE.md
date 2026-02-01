# CLAUDE.md - Project Context & Rules

## Design System: "The Emerald Standard"
* **Primary Theme:** Emerald Green (`#10B981`) & Champagne (`#F3E5AB`).
* **Forbidden:** Do NOT use the old Gold hex `#D4AF37`. If you see it, refactor it to Emerald.
* **Aesthetic:** Private Equity / Terminal / Quiet Luxury. Dark mode only.

## Coding Conventions
* **Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Supabase.
* **Components:** Use Shadcn/UI base, modified with `glass-card-heavy` utility.
* **Icons:** Lucide React.
* **Images:** Always use `next/image`.
* **Imports:** Use `@/` alias for absolute imports.

## Refactoring Rules
1.  **Mobile First:** Always ensure layouts stack correctly on mobile. Check `hidden md:flex` patterns.
2.  **Branding:**
    * Use `<Image src="/logo.png" ... />` for branding.
    * Never use `<Sparkles />` as a logo placeholder.
3.  **Loading States:**
    * Use the "Pulsing Logo" skeleton pattern (`components/ui/skeleton-loader.tsx` variant="screen").
    * Never use a generic browser spinner.

## Global Variables (app/globals.css)
* Use `var(--emerald-elite)` for primary actions.
* Use `var(--champagne)` for subtle accents.
* Use `glass-card-heavy` for containers.

## Development Context
* **Full Documentation:** See `claude.md` for comprehensive development guidelines
* **Brand Guidelines:** See `docs/BRAND_GUIDELINES.md` for complete design system
* **Supabase MCP:** Fully configured - see architecture section in `claude.md`
* **AI-Maintained:** This project is built and maintained by Claude Code with minimal developer intervention
