import { shouldGenerateAutoJournalDrafts } from '../journalAutoPopulateWorker';

describe('journalAutoPopulateWorker', () => {
  it('should run after 4:15 PM ET on trading day when not yet generated', () => {
    const now = new Date('2026-02-10T21:30:00.000Z'); // 4:30 PM ET (EST)
    const result = shouldGenerateAutoJournalDrafts(now, null);

    expect(result.shouldRun).toBe(true);
    expect(result.marketDate).toBe('2026-02-10');
  });

  it('should not run before target time', () => {
    const now = new Date('2026-02-10T20:00:00.000Z'); // 3:00 PM ET
    const result = shouldGenerateAutoJournalDrafts(now, null);

    expect(result.shouldRun).toBe(false);
  });

  it('should not run twice on same date', () => {
    const now = new Date('2026-02-10T21:45:00.000Z'); // 4:45 PM ET
    const result = shouldGenerateAutoJournalDrafts(now, '2026-02-10');

    expect(result.shouldRun).toBe(false);
  });
});
