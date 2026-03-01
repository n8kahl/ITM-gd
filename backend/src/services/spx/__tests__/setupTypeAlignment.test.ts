import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../../../../');

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function extractSetupTypeUnion(source: string): string[] {
  const lines = source.split('\n');
  const declarationIndex = lines.findIndex((line) => line.includes('export type SetupType'));
  if (declarationIndex < 0) {
    throw new Error('Unable to locate SetupType union');
  }

  const values: string[] = [];
  for (let index = declarationIndex + 1; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed.startsWith('|')) break;
    const capture = trimmed.match(/'([a-z_]+)'/);
    if (capture) values.push(capture[1]);
  }

  return Array.from(new Set(values)).sort();
}

function extractSetupTypesFromSetupTypeChecks(sql: string): string[] {
  const values = new Set<string>();
  for (const clause of sql.matchAll(/setup_type\s+IN\s*\(([\s\S]*?)\)/gim)) {
    for (const value of clause[1].matchAll(/'([a-z_]+)'/g)) {
      values.add(value[1]);
    }
  }
  return Array.from(values).sort();
}

describe('SetupType alignment contract', () => {
  it('keeps backend and frontend SetupType unions aligned', () => {
    const backendTypes = extractSetupTypeUnion(
      readRepoFile('backend/src/services/spx/types.ts'),
    );
    const frontendTypes = extractSetupTypeUnion(
      readRepoFile('lib/types/spx-command-center.ts'),
    );

    expect(frontendTypes).toEqual(backendTypes);
  });

  it('keeps DB setup_type constraints aligned with backend SetupType', () => {
    const backendTypes = extractSetupTypeUnion(
      readRepoFile('backend/src/services/spx/types.ts'),
    );
    const migrationTypes = extractSetupTypesFromSetupTypeChecks(
      readRepoFile('supabase/migrations/20260328040000_spx_execution_rls_and_setup_type_hardening.sql'),
    );

    expect(migrationTypes).toEqual(backendTypes);
  });
});
