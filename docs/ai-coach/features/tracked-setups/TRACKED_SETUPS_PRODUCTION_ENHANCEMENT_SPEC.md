# Tracked Setups - Production Enhancement Spec

**Status**: Implemented  
**Last Updated**: 2026-02-11  
**Version**: 1.0

---

## Objective

Improve tracked setup lifecycle UX so active execution focus is clean, history is preserved, and multi-setup management is fast.

---

## Requirements

1. Invalidated setups must leave active tracked lists immediately.
2. Manual status updates must emit realtime `setup_update` events to all subscribed sessions/devices for the same user.
3. The tracked setups panel must support two views:
   - `Active`: active + triggered setups only
   - `History`: invalidated + archived setups only
4. Users must be able to multi-select setups and run bulk actions:
   - Active view: archive selected, delete selected
   - History view: reopen selected, delete selected
5. Invalidating a setup must surface an undo action window of 5-10 seconds.
6. Sort mode must support:
   - Newest
   - Highest Score
   - Closest to Trigger
7. Sort/view/filter preferences must persist per user.

---

## API Contract

### `GET /api/tracked-setups`

Query:
- `status` (optional): `active | triggered | invalidated | archived`
- `view` (optional): `active | history`

Behavior:
- If `status` is present, filter strictly by `status`.
- Else if `view=active`, include `active` + `triggered`.
- Else if `view=history`, include `invalidated` + `archived`.
- Else (legacy default), include all except `invalidated`.

### `PATCH /api/tracked-setups/:id`

On status change, publish `setup_update` with:
- `previousStatus`
- `status`
- `reason: manual_update`
- `currentPrice: null`

---

## UX Contract

1. Active/History segmented controls are always visible.
2. Status filters are contextual to the selected view.
3. Sort controls are visible and sticky in panel header.
4. Bulk action bar appears when one or more rows are selected.
5. Undo invalidation toast includes:
   - setup context
   - explicit `Undo` action
   - 8 second timeout

---

## Acceptance Criteria

1. Marking a setup invalidated in Active view removes it from the list without manual refresh.
2. Clicking Undo within toast duration restores prior status and returns setup to the appropriate list.
3. Archiving selected setups in Active view moves them to History view.
4. Reopening selected setups in History view moves them back to Active view.
5. Sort mode change is retained after panel remount/reload for the same user.
6. Backend emits manual `setup_update` events and websocket subscribers receive them.

---

## Test Plan

### Backend (Jest)
- Route unit tests for:
  - `GET /api/tracked-setups?view=active`
  - `GET /api/tracked-setups?view=history`
  - `PATCH /api/tracked-setups/:id` publishes `manual_update` on status change
  - notes-only PATCH does not publish `setup_update`

### Frontend (Vitest)
- Helper tests for:
  - view/status filtering rules
  - score + proximity sorting behavior
  - preference normalization fallbacks

### E2E (Playwright)
- Scanner -> track -> invalidate + undo -> bulk archive -> history -> bulk reopen workflow.

