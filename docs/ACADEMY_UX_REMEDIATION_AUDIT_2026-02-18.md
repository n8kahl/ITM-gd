# Academy UX Remediation Audit (2026-02-18)

## Scope
- Lesson/module UX issues reported from production screenshots and `/Users/natekahl/Desktop/ITM/UX:Audit/4.pdf`.
- Readability, image reliability, and layout behavior for canonical Academy routes.

## Remediation Summary

### Phase 1: Image reliability and fallback behavior
- Added defensive media URL sanitization and safe-host policy in `/Users/natekahl/ITM-gd/components/academy/academy-media.ts`.
- Added runtime fallback behavior for broken module and lesson media in:
  - `/Users/natekahl/ITM-gd/components/academy/academy-module-card.tsx`
  - `/Users/natekahl/ITM-gd/components/academy/academy-lesson-viewer.tsx`
- Expanded Next.js image allowlist for valid Academy media hosts:
  - `/Users/natekahl/ITM-gd/next.config.mjs`

### Phase 2: Typography/contrast hardening
- Tightened Academy markdown heading scale and paragraph readability in:
  - `/Users/natekahl/ITM-gd/components/academy-v3/shared/academy-markdown.tsx`
- Added readability-focused Academy card/markdown utility classes in:
  - `/Users/natekahl/ITM-gd/app/globals.css`
- Increased inactive sub-nav contrast in:
  - `/Users/natekahl/ITM-gd/components/members/feature-sub-nav.tsx`

### Phase 3: Lesson content normalization
- Added normalization for dense multi-scenario drill text into structured markdown sections in:
  - `/Users/natekahl/ITM-gd/components/academy/academy-media.ts`

## Verification
- Added/updated unit coverage in:
  - `/Users/natekahl/ITM-gd/components/academy/__tests__/academy-media.test.ts`
- New tests validate:
  - Scenario drill markdown normalization
  - Unsafe external image fallback behavior
  - Supabase-hosted Academy media acceptance

## Spec Re-Audit vs `ACADEMY_REDESIGN_PLAN.md`
- Full-width lesson reading route: **Pass** (retained and hardened)
- Mobile-first progression controls: **Pass** (retained; readability improved)
- Proper image display and markdown readability in lesson viewer: **Pass after remediation**
- Shared `FeatureSubNav` with clear active/inactive states: **Pass after contrast fix**

## Remaining Follow-up Candidates
- Add a small visual E2E assertion for lesson media fallback state (broken remote image -> default illustration).
- Add image domain telemetry for rejected URLs to identify bad Academy metadata upstream.
