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
      description: 'Get gamma exposure (GEX) profile for SPX or NDX. Returns GEX by strike, flip point, max GEX strike, key levels, and gamma regime.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Index symbol for GEX analysis (SPX or NDX)'
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
                enum: ['call', 'put', 'call_spread', 'put_spread', 'iron_condor', 'stock'],
                description: 'Position type'
              },
              strike: {
                type: 'number',
                description: 'Strike price (for options)'
              },
              strike2: {
                type: 'number',
                description: 'Second strike for spreads'
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
                strike2: { type: 'number' },
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
      name: 'get_trade_history',
      description: 'Get the user\'s recent trade history and performance analytics. Use this when the user asks about their past trades, win rate, P&L history, or trading performance.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Filter by symbol (optional)'
          },
          limit: {
            type: 'number',
            description: 'Number of recent trades to return (default: 10)',
            default: 10
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_alert',
      description: 'Create a price alert for a symbol. Use this when the user asks to be notified when a price level is hit, or wants to set an alert for a specific price target.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'The stock or index symbol to monitor (e.g., SPX, NDX, AAPL)'
          },
          alert_type: {
            type: 'string',
            enum: ['price_above', 'price_below', 'level_approach', 'level_break', 'volume_spike'],
            description: 'Type of alert condition'
          },
          target_value: {
            type: 'number',
            description: 'The target price or value for the alert'
          },
          notes: {
            type: 'string',
            description: 'Optional notes about the alert'
          }
        },
        required: ['symbol', 'alert_type', 'target_value']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_alerts',
      description: 'Get the user\'s active price alerts. Use this when the user asks about their alerts, what alerts they have set, or wants to check alert status.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'triggered', 'cancelled'],
            description: 'Filter by alert status (default: active)'
          },
          symbol: {
            type: 'string',
            description: 'Filter by symbol (optional)'
          }
        }
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
            description: 'Symbols to scan (default: SPX and NDX). Can include any stock or index symbol.'
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
            enum: ['call', 'put', 'call_spread', 'put_spread', 'stock'],
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
      description: 'Get macro-economic context including economic calendar, Fed policy status, sector rotation, and earnings season data. Use this when the user asks about the macro outlook, economic events, Fed meetings, sector performance, or earnings season impact on their positions.',
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
  }
];
