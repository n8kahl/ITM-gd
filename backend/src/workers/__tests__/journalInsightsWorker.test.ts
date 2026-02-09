import { shouldRunWeeklyJournalInsights } from '../journalInsightsWorker';

describe('journalInsightsWorker', () => {
  it('should run on Sunday after 6:00 PM ET', () => {
    const now = new Date('2026-02-08T23:30:00.000Z'); // Sunday 6:30 PM ET
    const result = shouldRunWeeklyJournalInsights(now, null);

    expect(result.shouldRun).toBe(true);
    expect(result.sundayDate).toBe('2026-02-08');
  });

  it('should not run on non-Sunday days', () => {
    const now = new Date('2026-02-09T23:30:00.000Z'); // Monday
    const result = shouldRunWeeklyJournalInsights(now, null);

    expect(result.shouldRun).toBe(false);
  });

  it('should not run before Sunday target time', () => {
    const now = new Date('2026-02-08T21:00:00.000Z'); // Sunday 4:00 PM ET
    const result = shouldRunWeeklyJournalInsights(now, null);

    expect(result.shouldRun).toBe(false);
  });

  it('should not rerun on same Sunday date', () => {
    const now = new Date('2026-02-08T23:30:00.000Z');
    const result = shouldRunWeeklyJournalInsights(now, '2026-02-08');

    expect(result.shouldRun).toBe(false);
  });
});
