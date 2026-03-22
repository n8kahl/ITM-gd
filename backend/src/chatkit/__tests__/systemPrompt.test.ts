import { getSystemPrompt } from '../systemPrompt';

describe('systemPrompt', () => {
  it('contains required day-trader structured contract fields', () => {
    const prompt = getSystemPrompt();

    expect(prompt).toContain('DAY-TRADER RESPONSE CONTRACT');
    expect(prompt).toContain('Bias');
    expect(prompt).toContain('Setup');
    expect(prompt).toContain('Entry');
    expect(prompt).toContain('Stop');
    expect(prompt).toContain('Targets');
    expect(prompt).toContain('Invalidation');
    expect(prompt).toContain('Risk');
    expect(prompt).toContain('Confidence');
    expect(prompt).toContain('LOW-CONFIDENCE BEHAVIOR');
    expect(prompt).toContain('ONE-TAP FOLLOW-UP INTENTS');
  });

  it('adds pre-market intraday mode guidance when context is pre-market', () => {
    const prompt = getSystemPrompt({
      intradayMode: 'pre-market',
      sessionPhase: 'pre-market',
      sessionPhaseNote: 'Pre-market session. Thin liquidity and wider spreads.',
    });

    expect(prompt).toContain('## INTRADAY COACH MODE');
    expect(prompt).toContain('Active mode: pre-market.');
    expect(prompt).toContain('Session phase detail: pre-market.');
    expect(prompt).toContain('Session phase note: Pre-market session. Thin liquidity and wider spreads.');
  });

  it('adds live intraday mode guidance when context is live', () => {
    const prompt = getSystemPrompt({
      intradayMode: 'live',
      sessionPhase: 'mid-morning',
    });

    expect(prompt).toContain('## INTRADAY COACH MODE');
    expect(prompt).toContain('Active mode: live session.');
    expect(prompt).toContain('Session phase detail: mid-morning.');
  });

  it('does not inject intraday mode block for unknown mode values', () => {
    const prompt = getSystemPrompt({
      intradayMode: 'overnight',
      sessionPhase: 'mid-morning',
    });

    expect(prompt).not.toContain('## INTRADAY COACH MODE');
  });
});
