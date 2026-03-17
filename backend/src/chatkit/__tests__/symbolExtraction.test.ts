import {
  extractExplicitSymbols,
  extractPromptContextSymbols,
} from '../symbolExtraction'

describe('symbolExtraction', () => {
  it('extracts explicit tickers from plain-language prompts without treating "here" as a symbol', () => {
    expect(extractExplicitSymbols('Explain this SPY move simply.')).toEqual(['SPY'])
    expect(extractExplicitSymbols('What happened here?')).toEqual([])
  })

  it('allows explicit dollar-prefixed symbols even when they are common English words', () => {
    expect(extractExplicitSymbols('Compare $HERE and SPY for me.')).toEqual(['HERE', 'SPY'])
  })

  it('builds prompt-context symbols from user history and active chart context only', () => {
    const history = [
      { role: 'assistant', content: 'The chart for HERE is displayed in the center panel.' },
      { role: 'user', content: 'Explain this move simply.' },
    ]

    expect(extractPromptContextSymbols(history, 'What should I watch next?', 'SPY')).toEqual(['SPY'])
  })
})
