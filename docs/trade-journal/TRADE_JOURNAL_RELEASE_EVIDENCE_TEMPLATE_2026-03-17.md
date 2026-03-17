# Trade Journal Release Evidence Template

Use this file for every candidate release.

## Candidate

- Date:
- Candidate commit:
- Release owner:
- Staging URL:
- Automated workflow URL:
- Overall decision: PASS | FAIL | HOLD

## Automated Gates

- `pnpm typecheck`:
- `pnpm lint:journal:release`:
- `pnpm test:coverage`:
- `pnpm test:backend:journal-contract`:
- `pnpm build`:
- `pnpm test:journal:e2e`:

## Manual Staging Certification

### Journal CRUD
- Quick Form create:
- Full Form create:
- Edit:
- Delete:
- Notes:

### Screenshot Processing
- Single-position screenshot:
- Multi-position screenshot:
- No-position or low-confidence screenshot:
- Invalid file rejection:
- Screenshot view in detail sheet:
- Notes:

### CSV Processing
- Valid CSV preview:
- Valid CSV import:
- Duplicate re-import:
- Malformed CSV handling:
- Notes:

### Filters, Views, and Pagination
- Filters:
- Sorting:
- Cards/Table:
- Totals and pagination:
- Notes:

### Analytics and AI Grading
- Analytics load:
- AI grade request:
- AI grade render after refresh:
- Graceful failure behavior:
- Notes:

### Share and Review Operations
- Share trade card:
- Coach review request:
- Admin draft/publish:
- Member feedback view:
- Notes:

### Mobile Check
- Quick entry:
- Screenshot:
- CSV import:
- Filters:
- Notes:

## Defects

| Severity | Summary | Owner | Status | Blocking |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## Final Sign-Off

- Release owner sign-off:
- QE sign-off:
- Follow-up actions after release:
