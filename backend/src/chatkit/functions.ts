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
      description: 'Get support and resistance levels for a symbol (SPX or NDX). Returns PDH/PDL/PDC, PMH/PML, pivots, VWAP, and ATR.',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            enum: ['SPX', 'NDX'],
            description: 'The symbol to get levels for (SPX or NDX)'
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
            enum: ['SPX', 'NDX'],
            description: 'The symbol to get price for'
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
            enum: ['SPX', 'NDX'],
            description: 'The underlying symbol'
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
                enum: ['SPX', 'NDX'],
                description: 'Underlying symbol'
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
            enum: ['SPX', 'NDX'],
            description: 'The symbol to monitor'
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
            enum: ['SPX', 'NDX'],
            description: 'The symbol to chart'
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
            items: { type: 'string', enum: ['SPX', 'NDX'] },
            description: 'Symbols to scan (default: SPX and NDX)'
          },
          include_options: {
            type: 'boolean',
            description: 'Include options-based scans (default: true)',
            default: true
          }
        }
      }
    }
  }
];
