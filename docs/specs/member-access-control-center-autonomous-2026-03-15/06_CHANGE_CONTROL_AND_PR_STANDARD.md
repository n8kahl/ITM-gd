# Change Control And PR Standard

Date: 2026-03-15
Governing spec: `docs/specs/MEMBER_ACCESS_CONTROL_CENTER_EXECUTION_SPEC_2026-03-15.md`

## 1. Required Slice Record

Every slice entry must include:

1. objective
2. status
3. scope
4. out of scope
5. files changed
6. tests added
7. tests run
8. risks introduced
9. mitigations
10. rollback
11. evidence

## 2. PR Requirements

Every PR must state:

1. what spaghetti is being removed
2. what canonical source is being introduced or strengthened
3. what repo-wide consumers were updated
4. what access or profile risks were checked
5. what remains before cutover

## 3. Merge Conditions

No slice merges unless:

1. required tests are green
2. old-vs-new behavior is explained where changed
3. fallback paths added by the slice are zero
4. deletion commitments are tracked explicitly

## 4. Active Slice Plan

### Slice 1
- Objective: Baseline inventory and failing tests
- Status: planned

### Slice 2
- Objective: Canonical schema and backfill
- Status: planned

### Slice 3
- Objective: Shared access domain
- Status: planned

### Slice 4
- Objective: Admin directory and search APIs
- Status: planned

### Slice 5
- Objective: Admin actions and audit-safe mutations
- Status: planned

### Slice 6
- Objective: Admin UI rewrite
- Status: planned

### Slice 7
- Objective: Repo-wide cutover and deletion of legacy access paths
- Status: planned

### Slice 8
- Objective: Validation and release closure
- Status: planned
