# SPX Monitoring Infrastructure

> **Created:** 2026-02-26
> **Status:** Live

## Automated Monitoring (Supabase Edge Functions + pg_cron)

### 1. Daily Health Check
- **Edge Function:** `spx-daily-health-check`
- **Schedule:** Weekdays at 4:30 PM ET (21:30 UTC)
- **Checks:** metadata completeness, optimizer profile drift, gate distribution, confluence distribution, setup type health, data freshness (Massive.com bar count)
- **Stores results in:** `spx_system_health_reports` (report_type = 'daily_health')

### 2. Optimizer Drift Monitor
- **Edge Function:** `spx-optimizer-drift-monitor`
- **Schedule:** Weekdays at 6:00 AM ET (11:00 UTC)
- **Checks:** minPWinCalibrated (0.58), minConfluenceScore (≥3), minEvR (≥0.08), minTradesPerCombo (≥30), atrStopMultiplier (1.8±0.1)
- **Stores results in:** `spx_system_health_reports` (report_type = 'optimizer_drift')

### 3. Health Reports Cleanup
- **Schedule:** Sundays at 3:00 AM UTC
- **Action:** Deletes reports older than 90 days

## Manual / Cowork Scheduled Tasks

### 4. Shadow Gate Analysis (Weekly, after 5+ live sessions)
**Paste this prompt into a Cowork session:**

```
Run the SPX Shadow Gate Analysis. This evaluates whether the quality gate thresholds
are correctly filtering low-quality setups vs accidentally blocking winners.

Steps:
1. cd to the project root
2. Run: npx tsx backend/src/scripts/spxShadowGateAnalysis.ts
3. Capture the JSON output
4. Insert a row into spx_system_health_reports via Supabase with:
   - report_type: 'shadow_gate'
   - status: 'pass' if no flagged gate reasons with >60% T1 win rate, else 'warn'
   - summary: { flaggedGateReasons, productionT1WinRate, shadowT1WinRate, delta }
   - full_report: the complete JSON
5. Analyze the results:
   - If any gate reason has >60% T1 win rate in shadow, that gate is blocking winners
   - Compare production vs shadow cohort win rates
   - Recommend threshold adjustments if delta shows shadow outperforming production
```

### 5. Build Validation (Weekly)
**Paste this prompt into a Cowork session:**

```
Run the full SPX Command Center build validation suite.

Steps:
1. cd to the project root
2. Run: node --version (must be >= 22)
3. Run: pnpm exec tsc --noEmit (TypeScript check)
4. Run: pnpm exec eslint . (Lint check)
5. Run: pnpm run build (Production build)
6. Run: pnpm vitest run lib/spx/__tests__ (SPX unit tests)
7. Run: pnpm vitest run (All unit tests)
8. Insert a row into spx_system_health_reports via Supabase with:
   - report_type: 'build_validation'
   - status: 'pass' if all steps succeed, 'fail' if any fail
   - summary: { nodeVersion, tscExitCode, eslintExitCode, buildExitCode, testsPassed, testsFailed }
   - full_report: complete output from each step
9. Report any failures with specific error messages
```

## Reading Reports

Query the latest reports from the SPX Command Center or directly:

```sql
-- Latest report per type
SELECT DISTINCT ON (report_type)
  report_type, status, summary, created_at
FROM spx_system_health_reports
ORDER BY report_type, created_at DESC;

-- All reports from today
SELECT report_type, status, summary, created_at
FROM spx_system_health_reports
WHERE created_at > now() - interval '24 hours'
ORDER BY created_at DESC;

-- Drift alerts only
SELECT * FROM spx_system_health_reports
WHERE report_type = 'optimizer_drift' AND status = 'warn'
ORDER BY created_at DESC LIMIT 5;
```

## Cron Jobs Registered

| Job ID | Name | Schedule | Description |
|--------|------|----------|-------------|
| 5 | spx-daily-health-check | 30 21 * * 1-5 | Daily health check at 4:30 PM ET |
| 6 | spx-optimizer-drift-monitor | 0 11 * * 1-5 | Optimizer drift at 6:00 AM ET |
| 4 | spx-health-reports-cleanup | 0 3 * * 0 | Weekly cleanup of 90+ day reports |

## Database Schema

```sql
-- spx_system_health_reports
-- RLS: service_role can read/write, authenticated can read
-- Indexed on (report_type, created_at DESC) and (session_date DESC)
CREATE TABLE spx_system_health_reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_type TEXT NOT NULL, -- 'daily_health' | 'shadow_gate' | 'optimizer_drift' | 'build_validation'
  session_date DATE,
  status TEXT NOT NULL,       -- 'pass' | 'warn' | 'fail' | 'info'
  summary JSONB NOT NULL,
  full_report JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
