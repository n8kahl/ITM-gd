# Academy V3 Cleanup API Audit

Date: February 16, 2026  
Branch: `codex/academy-v3-phase0`

## Scope
Validate academy-v2 API decommission status and identify remaining legacy references.

## Retired Academy V2 API Routes
The entire `app/api/academy/**` surface has been removed. There are no remaining runtime academy-v2 API route files.

## Remaining Non-Docs Legacy References
`rg -n "app/api/academy/|/api/academy/" --glob '!docs/**' --glob '!coverage/**' -S`

1. No runtime references to `/api/academy/*` remain outside archival docs.
2. `proxy.ts` no longer includes `/api/academy` auth/bypass compatibility checks.

## Current Risk/Action
1. Reduce historical non-doc legacy strings in archival specs at repo root (`TITM_ACADEMY_CODEX_SPEC.md`, etc.) if desired.
