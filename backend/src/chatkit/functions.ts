import { ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * Function definitions for OpenAI function calling
 * These tell the AI what functions it can call and what parameters they accept
 */

export const AI_FUNCTIONS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_key_levels',
      description: 'Get support and resistance levels for a symbol. Returns PDH/PDL/PDC, PMH/PML, pivots, VWAP, and ATR.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock or index symbol (e.g., SPX, NDX, AAPL, MSFT, QQQ)'
          },
          timeframe: {
            type: 'string',
            enum: ['intraday', 'daily', 'weekly'],
            description: 'The timeframe for level calculations',
            default: 'intraday'
          }
        },
        required: ['symbol']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_fibonacci_levels',
      description: 'Calculate Fibonacci retracement levels for a symbol using recent swing high/low.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock or index symbol (e.g., SPX, NDX, AAPL, QQQ)'
          },
          timeframe: {
            type: 'string',
            enum: ['daily', '1h', '15m', '5m'],
            description: 'Timeframe label for Fibonacci calculation',
            default: 'daily'
          },
          lookback: {
            type: 'number',
            description: 'Number of bars to scan for swing points (2-100, default: 20)',
            default: 20
          }
        },
        required: ['symbol']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_current_price',
      description: 'Get the current real-time price for a symbol.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock or index symbol (e.g., SPX, NDX, AAPL, MSFT, QQQ)'
          }
        },
        required: ['symbol']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_market_status',
      description: 'Get current market status (pre-market, open, after-hours, closed) and time since market open.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_ticker_news',
      description: 'Get the latest company-specific headlines and catalysts for a symbol.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Ticker symbol (e.g., AAPL, NVDA, SPY)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of headlines to return (default: 5)',
            default: 5,
          },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_company_profile',
      description: 'Get company fundamentals/profile including sector, market cap, employees, and description.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Ticker symbol (e.g., AAPL, MSFT, TSLA)',
          },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_market_breadth',
      description: 'Get market breadth stats (advancers/decliners, highs/lows) for the US market.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_dividend_info',
      description: 'Get dividend schedule and assignment-risk context for a symbol.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Ticker symbol (e.g., AAPL, XOM, T)',
          },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_unusual_activity',
      description: 'Get unusual options activity summary for a symbol using volume/open-interest signals.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Ticker symbol (e.g., AAPL, NVDA, TSLA)',
          },
          minRatio: {
            type: 'number',
            description: 'Minimum volume/open-interest ratio threshold (default: 2)',
            default: 2,
          },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_symbols',
      description: 'Compare multiple symbols across current price, daily change, and quick risk context.',
      parameters: {
        type: 'object',
        properties: {
          symbols: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of symbols to compare (2-6 symbols)',
          },
        },
        required: ['symbols'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_options_chain',
      description: 'Get options chain with calls and puts for a symbol. Returns strikes, prices, Greeks (delta, gamma, theta, vega), IV, and volume for options near current price.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The underlying stock or index symbol (e.g., SPX, NDX, AAPL, MSFT, QQQ)'
          },
          expiry: {
            type: 'string',
            description: 'Specific expiry date (YYYY-MM-DD) or omit for nearest expiration'
          },
          strikeRange: {
            type: 'number',
            description: 'Number of strikes above/below current price to return (default: 10)',
            default: 10
          }
        },
        required: ['symbol']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_gamma_exposure',
      description: 'Get gamma exposure (GEX) profile for a symbol. Returns GEX by strike, flip point, max GEX strike, key levels, and gamma regime.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Symbol for GEX analysis (e.g., SPX, NDX, SPY, QQQ, AAPL)'
          },
          expiry: {
            type: 'string',
            description: 'Optional specific expiry date (YYYY-MM-DD). If omitted, analyzes multiple nearby expirations.'
          },
          strikeRange: {
            type: 'number',
            description: 'Number of strikes above/below spot to include per expiration (default: 30)',
            default: 30
          },
          maxExpirations: {
            type: 'number',
            description: 'Maximum nearby expirations to aggregate when expiry is omitted (default: 6)',
            default: 6
          },
          forceRefresh: {
            type: 'boolean',
            description: 'Bypass cache and force fresh calculation (default: false)',
            default: false
          }
        },
        required: ['symbol']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_zero_dte_analysis',
      description: 'Analyze 0DTE option structure for a symbol. Returns expected move usage, remaining move, theta decay projections, and gamma risk profile.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Symbol for 0DTE analysis (e.g., SPX, NDX, SPY, QQQ)'
          },
          strike: {
            type: 'number',
            description: 'Optional strike to focus the theta/gamma analysis. If omitted, uses ATM.'
          },
          type: {
            type: 'string',
            enum: ['call', 'put'],
            description: 'Optional contract type to focus the analysis.'
          }
        },
        required: ['symbol']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_iv_analysis',
      description: 'Analyze implied volatility structure for a symbol. Returns IV rank/percentile, put-call skew, and term structure shape.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Symbol for IV analysis (e.g., SPX, NDX, AAPL, QQQ)'
          },
          expiry: {
            type: 'string',
            description: 'Optional expiry date (YYYY-MM-DD) to focus skew analysis.'
          },
          strikeRange: {
            type: 'number',
            description: 'Number of strikes above/below spot for each expiry (default: 20)',
            default: 20
          },
          maxExpirations: {
            type: 'number',
            description: 'Max expirations for term-structure analysis when expiry is omitted (default: 6)',
            default: 6
          },
          forceRefresh: {
            type: 'boolean',
            description: 'Bypass cache and force fresh calculation (default: false)',
            default: false
          }
        },
        required: ['symbol']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_spx_game_plan',
      description: 'Get a comprehensive SPX game plan: key levels, GEX profile, 0DTE structure, expected move, and SPY correlation. Use this when the user asks for SPX analysis, game plan, levels overview, or what to watch in SPX today.',
      parameters: {
        type: 'object',
        properties: {
          include_spy: {
            type: 'boolean',
            description: 'Include SPY correlation and translation (default: true)',
            default: true
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_earnings_calendar',
      description: 'Get upcoming earnings events for a watchlist. Returns symbol, date, timing (BMO/AMC/DURING), and confirmation status.',
      parameters: {
        type: 'object',
        properties: {
          watchlist: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional symbols to check (e.g., [AAPL, NVDA, TSLA]). If omitted, uses the default watchlist.'
          },
          days_ahead: {
            type: 'number',
            description: 'Days forward to scan for earnings events (default: 14, max: 60).',
            default: 14
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_earnings_analysis',
      description: 'Analyze a symbol into earnings with expected move, historical earnings moves, IV context, and suggested strategies.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Symbol for earnings analysis (e.g., AAPL, NVDA, TSLA, SPY)'
          }
        },
        required: ['symbol']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'analyze_position',
      description: 'Analyze an options position or portfolio. Calculates P&L, Greeks, max gain/loss, breakeven, and risk assessment. Use this when the user asks about their position performance or risk.',
      parameters: {
        type: 'object',
        properties: {
          position: {
            type: 'object',
            description: 'Single position to analyze',
            properties: {
              symbol: {
                type: 'string',
                description: 'The underlying stock or index symbol (e.g., SPX, NDX, AAPL)'
              },
              type: {
                type: 'string',
                enum: ['call', 'put', 'stock'],
                description: 'Position type'
              },
              strike: {
                type: 'number',
                description: 'Strike price (for options)'
              },
              expiry: {
                type: 'string',
                description: 'Expiry date YYYY-MM-DD (for options)'
              },
              quantity: {
                type: 'number',
                description: 'Quantity (positive = long, negative = short)'
              },
              entryPrice: {
                type: 'number',
                description: 'Entry price per contract'
              },
              entryDate: {
                type: 'string',
                description: 'Entry date YYYY-MM-DD'
              }
            },
            required: ['symbol', 'type', 'quantity', 'entryPrice', 'entryDate']
          },
          positions: {
            type: 'array',
            description: 'Array of positions for portfolio analysis',
            items: {
              type: 'object',
              properties: {
                symbol: { type: 'string' },
                type: { type: 'string' },
                strike: { type: 'number' },
                expiry: { type: 'string' },
                quantity: { type: 'number' },
                entryPrice: { type: 'number' },
                entryDate: { type: 'string' }
              }
            }
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_position_advice',
      description: 'Get proactive management advice for open positions, including profit-taking, stop-loss, and theta decay risk.',
      parameters: {
        type: 'object',
        properties: {
          position_id: {
            type: 'string',
            description: 'Optional position ID. If omitted, advice is generated for all open positions.'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_journal_insights',
      description: 'Get AI-generated journal pattern insights (time-of-day edge, setup performance, behavioral/risk patterns) for the selected period.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['7d', '30d', '90d'],
            description: 'Analysis lookback window (default: 30d)',
            default: '30d',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_trade_history_for_symbol',
      description: 'Get the user\'s historical trade performance for a specific ticker symbol from the journal. Use this when discussing a ticker the user has traded before.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Ticker symbol (e.g., SPX, AAPL, NDX)'
          },
          limit: {
            type: 'number',
            description: 'Number of recent trades to return (default: 10)',
            default: 10
          }
        },
        required: ['symbol'],
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'show_chart',
      description: 'Display a candlestick chart with key levels for a symbol in the center panel. Use this when the user asks to see a chart, visualize price action, or view levels on a chart.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock or index symbol to chart (e.g., SPX, NDX, AAPL, MSFT)'
          },
          timeframe: {
            type: 'string',
            enum: ['1m', '5m', '15m', '1h', '4h', '1D'],
            description: 'Chart timeframe (default: 1D for daily)',
            default: '1D'
          }
        },
        required: ['symbol']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'scan_opportunities',
      description: 'Scan the market for trading opportunities using technical and options analysis. Use this when the user asks to find setups, scan for opportunities, look for trades, or wants to know what setups are available.',
      parameters: {
        type: 'object',
        properties: {
          symbols: {
            type: 'array',
            items: { type: 'string' },
            description: 'Symbols to scan (defaults to a popular multi-symbol watchlist). Can include any stock, ETF, or index symbol.'
          },
          include_options: {
            type: 'boolean',
            description: 'Include options-based scans (default: true)',
            default: true
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_long_term_trend',
      description: 'Analyze the long-term trend of a symbol using weekly or monthly charts. Returns EMA status, trend direction, key support/resistance levels, and interpretation. Use this when the user asks about the big picture, long-term trend, weekly/monthly chart analysis, or multi-year outlook.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock or index symbol to analyze (e.g., SPX, NDX, AAPL, MSFT)'
          },
          timeframe: {
            type: 'string',
            enum: ['weekly', 'monthly'],
            description: 'Timeframe for analysis (default: weekly)',
            default: 'weekly'
          }
        },
        required: ['symbol']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'analyze_leaps_position',
      description: 'Analyze a LEAPS (long-term options) position with Greeks projection, macro context, and management recommendations. Use this when the user asks about their LEAPS position, long-term options, or wants a comprehensive analysis of a multi-month options holding.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The underlying stock or index symbol (e.g., SPX, NDX, AAPL)'
          },
          option_type: {
            type: 'string',
            enum: ['call', 'put'],
            description: 'Option type'
          },
          strike: {
            type: 'number',
            description: 'Strike price'
          },
          entry_price: {
            type: 'number',
            description: 'Entry price per contract'
          },
          entry_date: {
            type: 'string',
            description: 'Entry date (YYYY-MM-DD)'
          },
          expiry_date: {
            type: 'string',
            description: 'Expiry date (YYYY-MM-DD)'
          },
          quantity: {
            type: 'number',
            description: 'Number of contracts',
            default: 1
          },
          current_iv: {
            type: 'number',
            description: 'Current implied volatility (decimal, e.g. 0.25)',
            default: 0.25
          }
        },
        required: ['symbol', 'option_type', 'strike', 'entry_price', 'entry_date', 'expiry_date']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'analyze_swing_trade',
      description: 'Analyze a multi-day swing trade position with technical continuation analysis, targets, and management suggestions. Use this when the user asks about a swing trade, multi-day hold, or wants advice on managing a position held for several days.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock or index symbol being traded (e.g., SPX, NDX, AAPL)'
          },
          position_type: {
            type: 'string',
            enum: ['call', 'put', 'stock'],
            description: 'Type of position'
          },
          entry_price: {
            type: 'number',
            description: 'Entry price'
          },
          current_price: {
            type: 'number',
            description: 'Current price of the underlying'
          },
          entry_date: {
            type: 'string',
            description: 'Entry date (YYYY-MM-DD)'
          },
          direction: {
            type: 'string',
            enum: ['long', 'short'],
            description: 'Trade direction'
          }
        },
        required: ['symbol', 'entry_price', 'current_price', 'entry_date', 'direction']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calculate_roll_decision',
      description: 'Calculate whether to roll a LEAPS position to a new strike and/or expiry. Shows cost analysis, pros/cons, and recommendation. Use this when the user asks about rolling options, extending duration, adjusting strikes, or managing a LEAPS position.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The underlying stock or index symbol (e.g., SPX, NDX, AAPL)'
          },
          option_type: {
            type: 'string',
            enum: ['call', 'put'],
            description: 'Option type'
          },
          current_strike: {
            type: 'number',
            description: 'Current strike price'
          },
          current_expiry: {
            type: 'string',
            description: 'Current expiry date (YYYY-MM-DD)'
          },
          new_strike: {
            type: 'number',
            description: 'Proposed new strike price'
          },
          new_expiry: {
            type: 'string',
            description: 'Proposed new expiry date (YYYY-MM-DD, optional)'
          },
          current_price: {
            type: 'number',
            description: 'Current underlying price'
          },
          implied_volatility: {
            type: 'number',
            description: 'Current implied volatility (decimal)',
            default: 0.25
          },
          quantity: {
            type: 'number',
            description: 'Number of contracts',
            default: 1
          }
        },
        required: ['symbol', 'option_type', 'current_strike', 'current_expiry', 'new_strike', 'current_price']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_macro_context',
      description: 'Get macro-economic context including economic calendar, policy backdrop, sector rotation, and earnings season data. Use this when the user asks about macro outlook, upcoming market-moving releases, policy risk, sector performance, or earnings-season impact on positions.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Symbol to assess macro impact for (optional, omit for general context)'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_economic_calendar',
      description: 'Get upcoming economic releases that could impact market volatility and options pricing. Use when trader asks about upcoming macro catalysts, what may move the market this week, or before recommending trades near major releases.',
      parameters: {
        type: 'object',
        properties: {
          days_ahead: {
            type: 'number',
            description: 'Number of days to look ahead (default 7, max 60)',
          },
          impact_filter: {
            type: 'string',
            enum: ['HIGH', 'MEDIUM', 'ALL'],
            description: 'Filter by impact level (default HIGH).',
          },
        },
      },
    },
  }
];
