import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../../../../');

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('SPX schema contracts', () => {
  it('uses reported_by_user_id for PDT fill ownership filtering', () => {
    const pdtTrackerSource = readRepoFile('backend/src/services/spx/pdtTracker.ts');
    expect(pdtTrackerSource).toContain(".eq('reported_by_user_id', userId)");
  });

  it('defines reported_by_user_id on execution fill schema', () => {
    const reconciliationMigration = readRepoFile('supabase/migrations/20260323070000_spx_execution_reconciliation.sql');
    expect(reconciliationMigration).toContain('reported_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL');
  });

  it('hardens execution RLS policies to service_role and owner scopes', () => {
    const hardeningMigration = readRepoFile('supabase/migrations/20260328040000_spx_execution_rls_and_setup_type_hardening.sql');

    expect(hardeningMigration).toMatch(
      /CREATE POLICY\s+spx_exec_states_service_all[\s\S]*FOR ALL TO service_role/i,
    );
    expect(hardeningMigration).toMatch(
      /CREATE POLICY\s+spx_setup_execution_fills_service_all[\s\S]*FOR ALL TO service_role/i,
    );
    expect(hardeningMigration).toMatch(
      /CREATE POLICY\s+select_spx_setup_execution_fills_owner[\s\S]*reported_by_user_id = auth\.uid\(\)/i,
    );
    expect(hardeningMigration).toMatch(
      /CREATE POLICY\s+insert_spx_setup_execution_fills_owner[\s\S]*FOR INSERT TO authenticated[\s\S]*reported_by_user_id = auth\.uid\(\)/i,
    );
  });
});
