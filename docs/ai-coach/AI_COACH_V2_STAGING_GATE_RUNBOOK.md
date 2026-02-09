# AI Coach V2 Staging Gate Runbook

**Last Updated:** 2026-02-09  
**Owner:** Nate + Codex  
**Scope:** Execute and document the staging quality gate before production cutover.

This runbook is the operational next phase after implementation on `Aiupgrade`.
It validates the staging deployment path using the live backend-integrated E2E lane.

## 1) Gate Objective

Pass a deterministic staging workflow that proves:

1. AI Coach backend is healthy in staging.
2. Authenticated watchlist/scanner/brief endpoints work.
3. Detector auto-track flow works through `setup_detected` event simulation.
4. Tracked setup lifecycle actions are functional.
5. Morning brief path is functional.

Primary workflow:

- `.github/workflows/ai-coach-live-e2e.yml`

## 2) Required Inputs

Set these repository secrets before running the workflow:

1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `E2E_BYPASS_TOKEN`
4. `E2E_BYPASS_USER_ID` (optional)
5. `E2E_BYPASS_SHARED_SECRET` (optional, but recommended if shared-secret bypass mode is enabled)

Workflow input required at run time:

1. `backend_url` (staging backend URL, for example `https://<staging-api-host>`)

Secret setup commands (run once per repo):

```bash
gh secret set NEXT_PUBLIC_SUPABASE_URL --repo n8kahl/ITM-gd
gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY --repo n8kahl/ITM-gd
gh secret set E2E_BYPASS_TOKEN --repo n8kahl/ITM-gd
gh secret set E2E_BYPASS_USER_ID --repo n8kahl/ITM-gd
gh secret set E2E_BYPASS_SHARED_SECRET --repo n8kahl/ITM-gd
```

One-command alternative (loads values from `.env.local` and writes required secrets):

```bash
cd /Users/natekahl/ITM-gd
pnpm ai-coach:staging:secrets
```

Custom env file path:

```bash
cd /Users/natekahl/ITM-gd
scripts/ai-coach/configure-staging-gate-secrets.sh n8kahl/ITM-gd .env.save
```

## 3) Preflight Command

Run this before dispatching the workflow:

```bash
cd /Users/natekahl/ITM-gd
pnpm ai-coach:staging:preflight
```

The preflight checks:

1. GitHub CLI authentication.
2. Presence of the live E2E workflow on target branch.
3. Required repository secrets.
4. Supabase migration drift versus `origin/main`.

## 4) Execution Steps

1. Open GitHub Actions for this repo.
2. Select workflow `AI Coach Live E2E`.
3. Click `Run workflow`.
4. Choose branch `Aiupgrade` (or release candidate branch).
5. Enter `backend_url` for staging.
6. Start run.
7. Wait for completion and confirm all required jobs are green.

CLI alternative (recommended for repeatable runs):

```bash
cd /Users/natekahl/ITM-gd
pnpm ai-coach:staging:run https://<staging-api-host>
```

## 5) Required Pass Criteria

The gate passes only if all are true:

1. Workflow completes with success state.
2. Live authenticated API checks pass (or strict-mode-valid failure reason is not present).
3. Live workflow spec passes scanner -> detector simulation -> tracked management -> brief.
4. No critical backend startup/auth bypass bootstrap failures in workflow logs.

## 6) Evidence Capture

After a successful run, update:

- `docs/ai-coach/AI_COACH_V2_PRODUCTION_STATUS.md`

Capture:

1. Workflow run URL.
2. Commit SHA tested.
3. Date/time (ET).
4. Pass/fail summary per live spec file.
5. Any skips and reason text.

Use this evidence block template:

```md
### Staging Live Gate Evidence
- Date: YYYY-MM-DD HH:MM ET
- Commit: <sha>
- Workflow: <url>
- Backend URL: <staging-url>
- Result: PASS | FAIL
- Specs:
  - e2e/specs/ai-coach/ai-coach-api.spec.ts: PASS/FAIL/SKIP
  - e2e/specs/ai-coach/ai-coach-workflow-live.spec.ts: PASS/FAIL/SKIP
- Notes: <important log notes or skip reasons>
```

## 7) If Gate Fails

1. Do not proceed to production.
2. Create a fix branch from the failing SHA.
3. Patch only failing surface area.
4. Re-run the same workflow with same `backend_url`.
5. Replace evidence block with newest run details.

## 8) Exit Criteria For Production Cut

All required conditions must be met:

1. Latest staging live gate run is green.
2. Evidence block is recorded in `AI_COACH_V2_PRODUCTION_STATUS.md`.
3. No unresolved P0/P1 issues in staging validation logs.
