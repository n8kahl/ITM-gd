import {
  extractMentionedPrices,
  extractSessionDraftCandidates,
  extractSetupType,
} from '../autoPopulate';

describe('journal autoPopulate helpers', () => {
  describe('extractMentionedPrices', () => {
    it('extracts up to two valid price candidates in order', () => {
      const text = 'SPX ORB long idea: entry $5234.50 and trim near 5251.25 with invalidation 5220';
      const prices = extractMentionedPrices(text, 2);

      expect(prices).toEqual([5234.5, 5251.25]);
    });

    it('ignores invalid numeric candidates', () => {
      const text = 'Watch SPY at $0 and 999999 while the real entry is 499.8';
      const prices = extractMentionedPrices(text, 3);

      expect(prices).toEqual([499.8]);
    });
  });

  describe('extractSetupType', () => {
    it('detects ORB setup keywords', () => {
      expect(extractSetupType('ORB breakout over morning high')).toBe('ORB');
    });

    it('returns null when no known setup keyword is present', () => {
      expect(extractSetupType('General market chatter')).toBeNull();
    });
  });

  describe('extractSessionDraftCandidates', () => {
    it('deduplicates by symbol and preserves first entry/exit prices', () => {
      const candidates = extractSessionDraftCandidates([
        {
          session_id: 'session-1',
          content: 'SPY breakout long over $500 with target 505',
          created_at: '2026-02-10T14:30:00.000Z',
        },
        {
          session_id: 'session-1',
          content: 'If it fails, consider a short on SPY below 498',
          created_at: '2026-02-10T14:32:00.000Z',
        },
        {
          session_id: 'session-1',
          content: 'Also watching NDX pullback from 21000',
          created_at: '2026-02-10T14:34:00.000Z',
        },
      ]);

      expect(candidates).toHaveLength(2);

      const spy = candidates.find((candidate) => candidate.symbol === 'SPY');
      expect(spy).toBeDefined();
      expect(spy?.direction).toBe('short');
      expect(spy?.entryPrice).toBe(500);
      expect(spy?.exitPrice).toBe(505);

      const ndx = candidates.find((candidate) => candidate.symbol === 'NDX');
      expect(ndx).toBeDefined();
      expect(ndx?.direction).toBe('long');
      expect(ndx?.entryPrice).toBe(21000);
    });

    it('respects candidate limit', () => {
      const candidates = extractSessionDraftCandidates([
        {
          session_id: 'session-1',
          content: 'SPY long',
          created_at: '2026-02-10T14:30:00.000Z',
        },
        {
          session_id: 'session-1',
          content: 'QQQ long',
          created_at: '2026-02-10T14:31:00.000Z',
        },
      ], 1);

      expect(candidates).toHaveLength(1);
      expect(candidates[0].symbol).toBe('SPY');
    });
  });
});
