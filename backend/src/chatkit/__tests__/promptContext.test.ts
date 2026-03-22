import { getSessionContext } from '../promptContext';
import type { MarketStatus } from '../../services/marketHours';

function makeMarketStatus(overrides: Partial<MarketStatus>): MarketStatus {
  return {
    status: 'closed',
    session: 'none',
    message: 'Markets are closed',
    ...overrides,
  };
}

describe('promptContext session context', () => {
  it('maps weekend closures to a closed planning phase', () => {
    const context = getSessionContext(
      new Date('2026-03-21T15:00:00.000Z'),
      makeMarketStatus({
        status: 'closed',
        session: 'weekend',
        message: 'Markets are closed for the weekend',
      }),
    );

    expect(context.phase).toBe('closed');
    expect(context.phaseNote).toContain('Weekend market closure');
  });

  it('maps holiday closures with holiday-specific context', () => {
    const context = getSessionContext(
      new Date('2026-12-25T16:00:00.000Z'),
      makeMarketStatus({
        status: 'closed',
        session: 'holiday',
        message: 'Markets are closed for the holiday',
        holidayName: 'Christmas',
      }),
    );

    expect(context.phase).toBe('closed');
    expect(context.phaseNote).toContain('Christmas closure');
  });

  it('keeps pre-market phase when market status reports pre-market', () => {
    const context = getSessionContext(
      new Date('2026-03-23T12:00:00.000Z'),
      makeMarketStatus({
        status: 'pre-market',
        session: 'extended',
        message: 'Pre-market session is active',
      }),
    );

    expect(context.phase).toBe('pre-market');
    expect(context.phaseNote).toContain('Pre-market session');
  });

  it('uses early-close-aware note in after-hours context', () => {
    const context = getSessionContext(
      new Date('2026-11-27T20:00:00.000Z'),
      makeMarketStatus({
        status: 'after-hours',
        session: 'extended',
        message: 'After-hours session is active',
        closingTime: '1:00 PM ET',
      }),
    );

    expect(context.phase).toBe('after-hours');
    expect(context.phaseNote).toContain('closed early at 1:00 PM ET');
  });
});
