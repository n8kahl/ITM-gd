# Quality Protocol And Test Gates

Date: 2026-03-15
Governing spec: `docs/specs/MEMBER_ACCESS_CONTROL_CENTER_EXECUTION_SPEC_2026-03-15.md`

## 1. Standard

No slice may merge on inspection alone.

Every slice must:

1. add or update tests first when feasible
2. prove repo-wide access behavior did not regress
3. record evidence in the tracker

## 2. Required Test Layers

### Unit

Required for:

1. role normalization
2. tier resolution
3. override precedence
4. tab allow/deny reasoning
5. identity-link resolution
6. stale roster health logic

### Integration

Required for:

1. admin APIs
2. guild roster queries
3. link/unlink flows
4. override persistence
5. sync action contracts
6. auth callback consumer behavior

### Component

Required for:

1. guild directory
2. member detail workspace
3. search behavior
4. override forms
5. health and drift warnings

### End-to-End

Required for:

1. admin opens Member Access and sees directory rows
2. admin searches by Discord username
3. admin opens Discord-only member detail
4. admin opens linked member detail and sees resolved tabs
5. admin creates and revokes an override
6. admin forces a sync
7. admin performs a Discord role mutation if this slice ships role edits

### Shadow Validation

Required before cutover:

1. old-vs-new member gate diff
2. old-vs-new admin diff
3. old-vs-new tab diff

## 3. Release-Blocking Assertions

The release fails if any of the following are true:

1. Discord username search is missing
2. directory omits Discord-only members
3. tab reasoning is inconsistent across routes
4. fallback tabs remain active in production
5. access writes are unaudited
6. shadow diff has unresolved mismatches

## 4. Minimum Commands

```bash
pnpm exec eslint <touched frontend/app/shared files>
pnpm --dir backend exec eslint <touched backend files>
pnpm exec tsc --noEmit
pnpm --dir backend exec tsc --noEmit
pnpm exec vitest run <targeted admin/member access suites>
pnpm --dir backend exec jest <targeted access suites> --runInBand
pnpm exec playwright test e2e/specs/admin/member-access*.spec.ts --project=chromium --workers=1
pnpm build
```

## 5. Production Smoke

Required after deploy:

1. open Member Access
2. verify directory loads
3. search by Discord username
4. open one Discord-only member
5. open one linked member
6. verify tabs match expectation
7. execute one safe sync action

## 6. No-Slop Rule

Reject implementation if it:

1. adds another fallback source
2. leaves old and new evaluators side by side without planned deletion
3. adds UI without audit-safe write paths
4. hides config failures behind fake defaults
