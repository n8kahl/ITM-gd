# Implementation Plan And Priority Model

Date: 2026-03-15
Governing spec: `docs/specs/MEMBER_ACCESS_CONTROL_CENTER_EXECUTION_SPEC_2026-03-15.md`

## 1. Delivery Rule

This effort is release-blocking infrastructure, not optional admin polish.

The plan must:

1. replace fragmented access logic
2. preserve correct member/admin gating at cutover
3. eliminate legacy fallback paths

## 2. Priority Tiers

### Must-Have

1. guild roster table and sync pipeline
2. shared access evaluation service
3. Discord username and nickname search
4. directory view for all guild members
5. member detail view with tab reasoning
6. audited overrides
7. repo-wide migration to shared evaluator
8. deletion of fallback tab paths

### Strong Add

1. Discord role mutation from admin UI
2. bulk sync actions
3. link/unlink workflows
4. shadow diff dashboard for cutover validation

### Later

1. notification campaigns
2. advanced bulk export/reporting
3. richer Discord community analytics

## 3. Slice Plan

### Slice 1: Baseline Inventory And Failing Tests

Objective:

1. freeze desired behavior before changing access code

Scope:

1. enumerate all access evaluators
2. write failing tests for:
   - Discord username lookup
   - directory visibility for Discord-only members
   - shared tab reasoning
   - fallback-tab removal behavior
   - old-vs-new diff checks

Exit criteria:

1. all critical current-state conflicts are documented
2. failing tests exist for target behavior

### Slice 2: Canonical Schema And Backfill

Objective:

1. add the data model needed for guild-wide access operations

Scope:

1. `discord_guild_members`
2. `member_access_overrides`
3. `access_control_settings`
4. search indexes
5. backfill/migration scripts

Exit criteria:

1. roster and override schemas exist
2. backfill is repeatable and idempotent

### Slice 3: Shared Access Domain

Objective:

1. centralize access evaluation

Scope:

1. role resolution
2. tier resolution
3. member/admin gating
4. tab allow/deny reasoning
5. override application
6. health diagnostics

Exit criteria:

1. one evaluator can produce all admin/member access outputs

### Slice 4: Admin Directory And Search APIs

Objective:

1. expose the new data model through clean admin APIs

Scope:

1. directory list endpoint
2. search endpoint
3. member detail endpoint
4. audit endpoint

Exit criteria:

1. admin can browse and search by Discord name, nickname, ID, email, or user ID

### Slice 5: Admin Actions

Objective:

1. support safe operational repair and access changes

Scope:

1. single-member sync
2. bulk sync
3. override create/revoke
4. link/unlink
5. optional Discord role add/remove

Exit criteria:

1. all mutations are audited and reversible where applicable

### Slice 6: Admin UI Rewrite

Objective:

1. replace the current debugger with an operations console

Scope:

1. guild directory
2. member detail workspace
3. filters and search
4. action panels
5. audit surface

Exit criteria:

1. admins no longer need raw queries or multiple pages to manage access

### Slice 7: Repo-Wide Cutover And Cleanup

Objective:

1. move all consumers to the canonical service and delete legacy paths

Scope:

1. auth callback
2. member auth context
3. `isAdminUser`
4. feature access guards
5. profile access displays
6. tab config delivery
7. legacy settings fallbacks

Exit criteria:

1. no production consumer uses old access logic

### Slice 8: Validation And Release Closure

Objective:

1. prove the rewrite is safe to ship

Scope:

1. shadow diff
2. full test matrix
3. admin Playwright flows
4. deployed smoke
5. operator docs

Exit criteria:

1. no unresolved access diffs
2. all release gates green

## 4. Mandatory Deletion List

These are not optional cleanup tasks.

1. `FALLBACK_TAB_CONFIGS` production path in `MemberAuthContext`
2. `DEFAULT_TABS` production path in `/api/config/tabs`
3. `profiles.role` admin fallback if not retained as formal policy
4. `app_settings.role_tier_mapping` fallback
5. split username search behavior across unrelated admin endpoints
6. route-local access evaluators that duplicate the canonical domain service

## 5. Cutover Strategy

### Step 1

Implement new schema and service behind the old UI.

### Step 2

Run shadow evaluation and diff current linked users.

### Step 3

Move admin page to new APIs.

### Step 4

Move auth and member consumers to shared evaluator.

### Step 5

Delete fallbacks and legacy logic in the same release train.

## 6. Release Standard

The system is not considered ready until:

1. guild directory works
2. Discord username search works
3. tab reasoning works
4. role/override actions are audited
5. auth callback and member shell still behave correctly
6. deployed smoke matches local proof
